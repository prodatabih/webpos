using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;
using WebPos.WebApi.Services;

namespace WebPos.WebApi.Controllers;

[Route("api/pos")]
[Authorize]
public class PosController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;
    private readonly KepLedgerWriter _kepWriter;

    public PosController(IWebPosDbContext db, KepLedgerWriter kepWriter)
    {
        _db = db;
        _kepWriter = kepWriter;
    }

    public sealed record CreatePosReceiptLineRequest(
        Guid ItemId,
        decimal Quantity,
        decimal UnitPriceInclVat2,
        decimal DiscountPct,
        decimal VatRatePercent);

    public sealed record CreatePosReceiptPaymentRequest(
        PaymentMethod PaymentMethod,
        decimal Amount2,
        string? ReferenceNumber);

    public sealed record CreatePosReceiptRequest(
        Guid StoreId,
        Guid CashRegisterId,
        Guid FiscalYearId,
        Guid? CustomerId,
        string ReceiptNumber,
        string? FiscalReceiptNumber,
        PaymentMethod PaymentMethod,
        List<CreatePosReceiptLineRequest> Lines,
        List<CreatePosReceiptPaymentRequest>? Payments);

    [HttpGet("receipts")]
    public async Task<IActionResult> GetReceipts(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? storeId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var query = _db.PosReceipts.AsNoTracking()
            .Where(r => r.TenantId == tid)
            .Include(r => r.Lines)
            .Include(r => r.Payments)
            .AsQueryable();

        if (storeId.HasValue) query = query.Where(r => r.StoreId == storeId.Value);
        if (fromUtc.HasValue) query = query.Where(r => r.IssuedAtUtc >= fromUtc.Value);
        if (toUtc.HasValue) query = query.Where(r => r.IssuedAtUtc <= toUtc.Value);

        var list = await query.OrderByDescending(r => r.IssuedAtUtc).Take(200).ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("receipts")]
    public async Task<IActionResult> CreateReceipt([FromBody] CreatePosReceiptRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (req.Lines.Count == 0) return BadRequest(new { message = "At least one line is required." });

        var receipt = new PosReceipt
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = req.StoreId,
            CashRegisterId = req.CashRegisterId,
            CashierUserId = CurrentUserId ?? Guid.Empty,
            CustomerId = req.CustomerId,
            ReceiptNumber = req.ReceiptNumber.Trim(),
            FiscalReceiptNumber = req.FiscalReceiptNumber?.Trim(),
            IssuedAtUtc = DateTime.UtcNow,
            Status = DocumentStatus.Posted,
            PaymentMethod = req.PaymentMethod,
            IsSynced = true,
            SyncedAtUtc = DateTime.UtcNow
        };

        var lineNo = 1;
        foreach (var l in req.Lines)
        {
            var grossBeforeDiscount = CalculationMath.Round2(l.UnitPriceInclVat2 * l.Quantity);
            var discountAmt = CalculationMath.Round2(grossBeforeDiscount * (l.DiscountPct / 100m));
            var gross2 = CalculationMath.Round2(grossBeforeDiscount - discountAmt);
            var vat2 = CalculationMath.CalculateVatFromGross2(gross2, l.VatRatePercent);
            var net2 = CalculationMath.Round2(gross2 - vat2);

            receipt.Lines.Add(new PosReceiptLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                PosReceiptId = receipt.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                UnitPriceInclVat2 = CalculationMath.Round2(l.UnitPriceInclVat2),
                DiscountPct = l.DiscountPct,
                VatRatePercent = l.VatRatePercent,
                NetAmount2 = net2,
                VatAmount2 = vat2,
                GrossAmount2 = gross2
            });

            var bomLines = await _db.ItemBomLines
                .AsNoTracking()
                .Where(b => b.TenantId == tid && b.ParentItemId == l.ItemId)
                .ToListAsync(ct);

            if (bomLines.Count > 0)
            {
                foreach (var bom in bomLines)
                {
                    var targetStoreId = bom.SourceStoreId ?? req.StoreId;
                    var compPrice = await _kepWriter.GetOrCreateStorePriceAsync(tid, targetStoreId, bom.ComponentItemId, ct);
                    compPrice.StockQty -= l.Quantity * bom.Quantity;
                }
            }
            else
            {
                var price = await _kepWriter.GetOrCreateStorePriceAsync(tid, req.StoreId, l.ItemId, ct);
                price.StockQty -= l.Quantity;
            }
        }

        receipt.TotalNetAmount2 = CalculationMath.Round2(receipt.Lines.Sum(x => x.NetAmount2));
        receipt.TotalVatAmount2 = CalculationMath.Round2(receipt.Lines.Sum(x => x.VatAmount2));
        receipt.TotalGrossAmount2 = CalculationMath.Round2(receipt.Lines.Sum(x => x.GrossAmount2));

        if (req.Payments is { Count: > 0 })
        {
            foreach (var p in req.Payments)
            {
                receipt.Payments.Add(new PosReceiptPayment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tid,
                    PosReceiptId = receipt.Id,
                    PaymentMethod = p.PaymentMethod,
                    Amount2 = CalculationMath.Round2(p.Amount2),
                    ReferenceNumber = p.ReferenceNumber?.Trim()
                });
            }
        }
        else
        {
            receipt.Payments.Add(new PosReceiptPayment
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                PosReceiptId = receipt.Id,
                PaymentMethod = req.PaymentMethod,
                Amount2 = receipt.TotalGrossAmount2
            });
        }

        _db.PosReceipts.Add(receipt);

        await _kepWriter.AppendEntryAsync(
            tid,
            req.StoreId,
            req.FiscalYearId,
            receipt.IssuedAtUtc,
            "POS_RECEIPT",
            receipt.Id,
            receipt.ReceiptNumber,
            $"POS receipt {receipt.ReceiptNumber}",
            LedgerDirection.Credit,
            receipt.TotalGrossAmount2,
            ct);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "POS_SALE",
            EntityName = nameof(PosReceipt),
            EntityId = receipt.Id.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(receipt);
    }
}
