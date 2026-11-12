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

        var byPayment = receipts
            .GroupBy(r => r.PaymentMethod.ToString())
            .Select(g => new
            {
                PaymentMethod = g.Key,
                Count = g.Count(),
                GrossAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalGrossAmount2)),
                VatAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalVatAmount2)),
                NetAmount2 = CalculationMath.Round2(g.Sum(x => x.TotalNetAmount2))
            })
            .ToList();

        return Ok(new
        {
            DateUtc = targetDate,
            ReceiptCount = receipts.Count,
            TotalGrossAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalGrossAmount2)),
            TotalVatAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalVatAmount2)),
            TotalNetAmount2 = CalculationMath.Round2(receipts.Sum(r => r.TotalNetAmount2)),
            ByPaymentMethod = byPayment
        });
    }

    [HttpGet("audit-log")]
    public async Task<IActionResult> GetAuditLog(
        [FromQuery] Guid? tenantId,
        [FromQuery] int take = 100,
        CancellationToken ct = default)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var clampedTake = Math.Clamp(take, 1, 500);
        var entries = await _db.AuditLogEntries.AsNoTracking()
            .Where(a => a.TenantId == tid)
            .OrderByDescending(a => a.OccurredAtUtc)
            .Take(clampedTake)
            .ToListAsync(ct);

        return Ok(entries);
    }
}
