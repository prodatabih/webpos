using System.Text.Json;
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
        List<CreatePosReceiptPaymentRequest>? Payments,
        Guid? Id = null);

    public sealed record FiscalizeReceiptRequest(string FiscalReceiptNumber);

    private async Task<IActionResult?> ValidatePeriodOpenAsync(
        Guid tid,
        Guid fiscalYearId,
        DateTime docDate,
        CancellationToken ct)
    {
        var fiscalYear = await _db.FiscalYears.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fiscalYearId && f.TenantId == tid, ct);
        if (fiscalYear is null)
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi." });

        if (fiscalYear.IsClosed)
            return BadRequest(new { message = "Poslovna godina je zatvorena. Knjiženje nije dozvoljeno." });

        var period = await _db.FiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == tid && p.FiscalYearId == fiscalYearId && p.Month == docDate.Month, ct);
        if (period is not null && period.IsLocked)
            return BadRequest(new { message = $"Poslovni period ({period.Name}) je zaključan. Knjiženje nije dozvoljeno." });

        return null;
    }

    private async Task<TenantSetting> GetTenantSettingsAsync(Guid tid, CancellationToken ct)
    {
        var setting = await _db.TenantSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tid, ct);

        return setting ?? new TenantSetting
        {
            TenantId = tid,
            AllowNegativeStock = false,
            AllowPriceChangeWithoutLeveling = false,
            AutoCreatePriceLevelingOnInbound = true,
            DefaultCurrency = "BAM"
        };
    }

    private async Task<StoreItemPrice> GetOrCreateStorePriceCachedAsync(
        Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice> cache,
        Guid tid,
        Guid storeId,
        Guid itemId,
        CancellationToken ct)
    {
        var key = (storeId, itemId);
        if (cache.TryGetValue(key, out var cached)) return cached;

        var price = await _kepWriter.GetOrCreateStorePriceAsync(tid, storeId, itemId, ct);
        cache[key] = price;
        return price;
    }

    private void AddAuditLog(
        Guid tid,
        string action,
        Guid entityId,
        string entityCode,
        string summary,
        string? previousState = null,
        string? newState = null)
    {
        var details = JsonSerializer.Serialize(new
        {
            entityCode,
            summary,
            previousState,
            newState
        });

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = action,
            EntityName = nameof(PosReceipt),
            EntityId = entityId.ToString(),
            DetailsJson = details,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });
    }

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
        if (req.Lines is null || req.Lines.Count == 0)
            return BadRequest(new { message = "Račun mora sadržavati najmanje jednu stavku." });

        var receiptNumber = req.ReceiptNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(receiptNumber))
            return BadRequest(new { message = "Broj računa je obavezan." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        var cashRegister = await _db.CashRegisters
            .FirstOrDefaultAsync(r => r.Id == req.CashRegisterId && r.TenantId == tid, ct);
        if (cashRegister is null)
            return BadRequest(new { message = "Odabrana kasa ne postoji u bazi." });

        if (req.CustomerId.HasValue && req.CustomerId.Value != Guid.Empty)
        {
            var customerExists = await _db.Partners.AnyAsync(p => p.Id == req.CustomerId.Value && p.TenantId == tid, ct);
            if (!customerExists)
                return BadRequest(new { message = "Odabrani kupac ne postoji u bazi." });
        }

        var nowUtc = DateTime.UtcNow;
        var periodErr = await ValidatePeriodOpenAsync(tid, req.FiscalYearId, nowUtc, ct);
        if (periodErr is not null) return periodErr;

        var duplicateNumber = await _db.PosReceipts.AsNoTracking()
            .AnyAsync(r => r.TenantId == tid && r.StoreId == req.StoreId && r.ReceiptNumber == receiptNumber, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Račun sa brojem '{receiptNumber}' već postoji u ovoj poslovnici." });

        var receiptId = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid();
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            var idExists = await _db.PosReceipts.AsNoTracking().AnyAsync(r => r.Id == receiptId, ct);
            if (idExists)
                return BadRequest(new { message = "Račun sa zadanim ID-om već postoji." });
        }

        if (req.Lines.Any(l => l.ItemId == Guid.Empty || l.Quantity <= 0m))
            return BadRequest(new { message = "Sve stavke računa moraju imati ispravan artikal i količinu veću od nule." });

        var lineItemIds = req.Lines.Select(l => l.ItemId).Distinct().ToList();
        var itemsMap = await _db.Items.AsNoTracking()
            .Where(i => i.TenantId == tid && lineItemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);
        if (itemsMap.Count != lineItemIds.Count)
            return BadRequest(new { message = "Jedan ili više artikala sa računa ne postoji u bazi." });

        var allBomLines = await _db.ItemBomLines.AsNoTracking()
            .Where(b => b.TenantId == tid && lineItemIds.Contains(b.ParentItemId))
            .ToListAsync(ct);
        var bomByParent = allBomLines
            .GroupBy(b => b.ParentItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Compute stock deductions per (storeId, itemId)
        var stockDeductions = new Dictionary<(Guid StoreId, Guid ItemId), decimal>();
        foreach (var l in req.Lines)
        {
            var item = itemsMap[l.ItemId];
            if (item.ItemType == ItemType.Service) continue;

            if (bomByParent.TryGetValue(l.ItemId, out var bomLines) && bomLines.Count > 0)
            {
                foreach (var bom in bomLines)
                {
                    var targetStoreId = bom.SourceStoreId ?? req.StoreId;
                    var wasteFactor = 1m + (bom.WastePercent / 100m);
                    var qty = CalculationMath.Round4(l.Quantity * bom.Quantity * wasteFactor);
                    var key = (targetStoreId, bom.ComponentItemId);
                    stockDeductions[key] = stockDeductions.GetValueOrDefault(key) + qty;
                }
            }
            else
            {
                var key = (req.StoreId, l.ItemId);
                stockDeductions[key] = stockDeductions.GetValueOrDefault(key) + l.Quantity;
            }
        }

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();

        if (!settings.AllowNegativeStock)
        {
            foreach (var (key, neededQty) in stockDeductions)
            {
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, key.StoreId, key.ItemId, ct);
                var available = price.StockQty;
                if (available < neededQty)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha na skladištu za prodaju (raspoloživo: {available:0.##})."
                    });
                }
            }
        }

        var trimmedFiscal = req.FiscalReceiptNumber?.Trim();
        var receipt = new PosReceipt
        {
            Id = receiptId,
            TenantId = tid,
            StoreId = req.StoreId,
            CashRegisterId = req.CashRegisterId,
            FiscalYearId = req.FiscalYearId,
            CashierUserId = CurrentUserId ?? Guid.Empty,
            CashierName = CurrentUsername,
            CustomerId = req.CustomerId.HasValue && req.CustomerId.Value != Guid.Empty ? req.CustomerId : null,
            ReceiptNumber = receiptNumber,
            FiscalReceiptNumber = string.IsNullOrWhiteSpace(trimmedFiscal) ? null : trimmedFiscal,
            ReceiptType = "SALE",
            IsFiscalized = !string.IsNullOrWhiteSpace(trimmedFiscal),
            IssuedAtUtc = nowUtc,
            Status = DocumentStatus.Posted,
            PaymentMethod = req.PaymentMethod,
            IsSynced = true,
            SyncedAtUtc = nowUtc
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
        }

        // Apply stock deductions
        foreach (var (key, qtyToDeduct) in stockDeductions)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, key.StoreId, key.ItemId, ct);
            price.StockQty -= qtyToDeduct;
            price.UpdatedAtUtc = nowUtc;
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

        cashRegister.LastSequenceNumber += 1;
        _db.PosReceipts.Add(receipt);

        await _kepWriter.AppendEntryAsync(
            tid,
            req.StoreId,
            req.FiscalYearId,
            receipt.IssuedAtUtc,
            "POS_RECEIPT",
            receipt.Id,
            receipt.ReceiptNumber,
            $"POS račun {receipt.ReceiptNumber}",
            LedgerDirection.Credit,
            receipt.TotalGrossAmount2,
            ct);

        AddAuditLog(
            tid,
            "POS_SALE",
            receipt.Id,
            receipt.ReceiptNumber,
            $"Izdat POS račun {receipt.ReceiptNumber}",
            null,
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(receipt);
    }

    [HttpPost("receipts/{id:guid}/refund")]
    public async Task<IActionResult> RefundReceipt(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var orig = await _db.PosReceipts
            .Include(r => r.Lines)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);

        if (orig is null) return NotFound(new { message = "POS račun nije pronađen." });
        if (orig.Status != DocumentStatus.Posted || !string.Equals(orig.ReceiptType, "SALE", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Samo proknjižen prodajni račun se može reklamirati (stornirati)." });

        var fiscalYearId = orig.FiscalYearId;
        if (!fiscalYearId.HasValue || fiscalYearId.Value == Guid.Empty)
        {
            var storeCompanyId = await _db.Stores.AsNoTracking()
                .Where(s => s.Id == orig.StoreId && s.TenantId == tid)
                .Select(s => (Guid?)s.CompanyId)
                .FirstOrDefaultAsync(ct);

            fiscalYearId = await _db.FiscalYears.AsNoTracking()
                .Where(f => f.TenantId == tid && (!storeCompanyId.HasValue || f.CompanyId == storeCompanyId.Value) && !f.IsClosed)
                .OrderByDescending(f => f.Year)
                .Select(f => (Guid?)f.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (!fiscalYearId.HasValue || fiscalYearId.Value == Guid.Empty)
            return BadRequest(new { message = "Nije pronađena otvorena poslovna godina za storno računa." });

        var nowUtc = DateTime.UtcNow;
        var periodErr = await ValidatePeriodOpenAsync(tid, fiscalYearId.Value, nowUtc, ct);
        if (periodErr is not null) return periodErr;

        // Generate unique refund receipt number
        var baseRefundNumber = $"ST-{orig.ReceiptNumber}";
        var refundNumber = baseRefundNumber;
        var suffix = 2;
        while (await _db.PosReceipts.AsNoTracking()
            .AnyAsync(r => r.TenantId == tid && r.StoreId == orig.StoreId && r.ReceiptNumber == refundNumber, ct))
        {
            refundNumber = $"{baseRefundNumber}-{suffix++}";
        }

        orig.Status = DocumentStatus.Canceled;

        var refundFiscal = string.IsNullOrWhiteSpace(orig.FiscalReceiptNumber)
            ? null
            : $"BF-ST-{orig.FiscalReceiptNumber}";

        var refund = new PosReceipt
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = orig.StoreId,
            CashRegisterId = orig.CashRegisterId,
            FiscalYearId = fiscalYearId.Value,
            CashierUserId = CurrentUserId ?? Guid.Empty,
            CashierName = CurrentUsername,
            CustomerId = orig.CustomerId,
            ReceiptNumber = refundNumber,
            FiscalReceiptNumber = refundFiscal,
            ReceiptType = "REFUND",
            ReferenceReceiptId = orig.Id,
            IsFiscalized = !string.IsNullOrWhiteSpace(refundFiscal),
            IssuedAtUtc = nowUtc,
            Status = DocumentStatus.Posted,
            PaymentMethod = orig.PaymentMethod,
            TotalNetAmount2 = orig.TotalNetAmount2,
            TotalVatAmount2 = orig.TotalVatAmount2,
            TotalGrossAmount2 = orig.TotalGrossAmount2,
            IsSynced = true,
            SyncedAtUtc = nowUtc
        };

        foreach (var l in orig.Lines.OrderBy(x => x.LineNumber))
        {
            refund.Lines.Add(new PosReceiptLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                PosReceiptId = refund.Id,
                LineNumber = l.LineNumber,
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                UnitPriceInclVat2 = l.UnitPriceInclVat2,
                DiscountPct = l.DiscountPct,
                VatRatePercent = l.VatRatePercent,
                NetAmount2 = l.NetAmount2,
                VatAmount2 = l.VatAmount2,
                GrossAmount2 = l.GrossAmount2
            });
        }

        foreach (var p in orig.Payments)
        {
            refund.Payments.Add(new PosReceiptPayment
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                PosReceiptId = refund.Id,
                PaymentMethod = p.PaymentMethod,
                Amount2 = p.Amount2,
                ReferenceNumber = p.ReferenceNumber
            });
        }

        // Restore stock (or BOM components), skipping Service items
        var lineItemIds = orig.Lines.Select(l => l.ItemId).Distinct().ToList();
        var itemsMap = await _db.Items.AsNoTracking()
            .Where(i => i.TenantId == tid && lineItemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        var allBomLines = await _db.ItemBomLines.AsNoTracking()
            .Where(b => b.TenantId == tid && lineItemIds.Contains(b.ParentItemId))
            .ToListAsync(ct);
        var bomByParent = allBomLines
            .GroupBy(b => b.ParentItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        foreach (var l in orig.Lines)
        {
            if (itemsMap.TryGetValue(l.ItemId, out var item) && item.ItemType == ItemType.Service)
                continue;

            if (bomByParent.TryGetValue(l.ItemId, out var bomLines) && bomLines.Count > 0)
            {
                foreach (var bom in bomLines)
                {
                    var targetStoreId = bom.SourceStoreId ?? orig.StoreId;
                    var wasteFactor = 1m + (bom.WastePercent / 100m);
                    var qty = CalculationMath.Round4(l.Quantity * bom.Quantity * wasteFactor);
                    var compPrice = await GetOrCreateStorePriceCachedAsync(priceCache, tid, targetStoreId, bom.ComponentItemId, ct);
                    compPrice.StockQty += qty;
                    compPrice.UpdatedAtUtc = nowUtc;
                }
            }
            else
            {
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, orig.StoreId, l.ItemId, ct);
                price.StockQty += l.Quantity;
                price.UpdatedAtUtc = nowUtc;
            }
        }

        var cashRegister = await _db.CashRegisters
            .FirstOrDefaultAsync(r => r.Id == orig.CashRegisterId && r.TenantId == tid, ct);
        if (cashRegister is not null)
        {
            cashRegister.LastSequenceNumber += 1;
        }

        _db.PosReceipts.Add(refund);

        await _kepWriter.AppendEntryAsync(
            tid,
            refund.StoreId,
            fiscalYearId.Value,
            refund.IssuedAtUtc,
            "POS_REFUND",
            refund.Id,
            refund.ReceiptNumber,
            $"Storno POS računa {orig.ReceiptNumber}",
            LedgerDirection.Debit,
            refund.TotalGrossAmount2,
            ct);

        AddAuditLog(
            tid,
            "POS_REFUND",
            refund.Id,
            refund.ReceiptNumber,
            $"Reklamiran POS račun {orig.ReceiptNumber} -> {refund.ReceiptNumber}",
            "POSTED",
            "REVERSED");

        await _db.SaveChangesAsync(ct);
        return Ok(refund);
    }

    [HttpPatch("receipts/{id:guid}/fiscalize")]
    [HttpPost("receipts/{id:guid}/fiscalize")]
    public async Task<IActionResult> FiscalizeReceipt(Guid id, [FromBody] FiscalizeReceiptRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.FiscalReceiptNumber))
            return BadRequest(new { message = "Broj fiskalnog računa je obavezan." });

        var receipt = await _db.PosReceipts
            .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);

        if (receipt is null) return NotFound(new { message = "POS račun nije pronađen." });

        var trimmed = req.FiscalReceiptNumber.Trim();
        receipt.FiscalReceiptNumber = trimmed;
        receipt.IsFiscalized = true;

        AddAuditLog(
            tid,
            "FISCALIZE",
            receipt.Id,
            receipt.ReceiptNumber,
            $"Fiskalizovan POS račun {receipt.ReceiptNumber} (BF: {trimmed})",
            null,
            trimmed);

        await _db.SaveChangesAsync(ct);
        return Ok(new
        {
            id = receipt.Id,
            fiscalReceiptNumber = receipt.FiscalReceiptNumber,
            isFiscalized = true
        });
    }
}
