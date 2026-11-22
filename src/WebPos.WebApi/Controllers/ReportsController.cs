using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;

namespace WebPos.WebApi.Controllers;

[Route("api/reports")]
[Authorize]
public class ReportsController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;

    public ReportsController(IWebPosDbContext db)
    {
        _db = db;
    }

    [HttpGet("kep")]
    public async Task<IActionResult> GetKepLedger(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? storeId,
        [FromQuery] Guid? fiscalYearId,
        CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var query = _db.KepLedgerEntries.AsNoTracking()
            .Where(e => e.TenantId == tid);

        if (storeId.HasValue) query = query.Where(e => e.StoreId == storeId.Value);
        if (fiscalYearId.HasValue) query = query.Where(e => e.FiscalYearId == fiscalYearId.Value);

        var entries = await query
            .OrderBy(e => e.StoreId)
            .ThenBy(e => e.EntryNumber)
            .ToListAsync(ct);

        return Ok(entries);
    }

    [HttpGet("daily-turnover")]
    public async Task<IActionResult> GetDailyTurnover(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? storeId,
        [FromQuery] DateTime? dateUtc,
        CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var targetDate = (dateUtc ?? DateTime.UtcNow).Date;
        var nextDate = targetDate.AddDays(1);

        var query = _db.PosReceipts.AsNoTracking()
            .Where(r => r.TenantId == tid && r.IssuedAtUtc >= targetDate && r.IssuedAtUtc < nextDate);

        if (storeId.HasValue) query = query.Where(r => r.StoreId == storeId.Value);

        var receipts = await query.ToListAsync(ct);

        static decimal SignFor(string? receiptType) =>
            string.Equals(receiptType, "REFUND", StringComparison.OrdinalIgnoreCase) ? -1m : 1m;

        var byPayment = receipts
            .GroupBy(r => r.PaymentMethod.ToString())
            .Select(g => new
            {
                PaymentMethod = g.Key,
                Count = g.Count(),
                GrossAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalGrossAmount2 * SignFor(x.ReceiptType))),
                VatAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalVatAmount2 * SignFor(x.ReceiptType))),
                NetAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalNetAmount2 * SignFor(x.ReceiptType)))
            })
            .ToList();

        var saleCount = receipts.Count(r => !string.Equals(r.ReceiptType, "REFUND", StringComparison.OrdinalIgnoreCase));
        var refundCount = receipts.Count - saleCount;

        return Ok(new
        {
            DateUtc = targetDate,
            ReceiptCount = receipts.Count,
            SaleCount = saleCount,
            RefundCount = refundCount,
            TotalGrossAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalGrossAmount2 * SignFor(r.ReceiptType))),
            TotalVatAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalVatAmount2 * SignFor(r.ReceiptType))),
            TotalNetAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalNetAmount2 * SignFor(r.ReceiptType))),
            ByPaymentMethod = byPayment
        });
    }

    [HttpGet("audit-log")]
    public async Task<IActionResult> GetAuditLog(
        [FromQuery] Guid? tenantId,
        [FromQuery] string? entityName,
        [FromQuery] string? action,
        [FromQuery] int take = 100,
        CancellationToken ct = default)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var clampedTake = Math.Clamp(take, 1, 500);
        var query = _db.AuditLogEntries.AsNoTracking()
            .Where(a => a.TenantId == tid);

        if (!string.IsNullOrWhiteSpace(entityName))
        {
            var eName = entityName.Trim();
            query = query.Where(a => a.EntityName == eName);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            var act = action.Trim();
            query = query.Where(a => a.Action == act);
        }

        var entries = await query
            .OrderByDescending(a => a.OccurredAtUtc)
            .Take(clampedTake)
            .ToListAsync(ct);

        return Ok(entries);
    }
}
