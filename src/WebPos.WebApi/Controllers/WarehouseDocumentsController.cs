using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;
using WebPos.WebApi.Contracts;
using WebPos.WebApi.Services;

namespace WebPos.WebApi.Controllers;

[Route("api/warehouse-documents")]
[Authorize]
public class WarehouseDocumentsController : ApiControllerBase
{
    private const string WarehouseWriteRoles = "SuperAdmin,TenantAdmin,Manager,Accountant";

    private readonly IWebPosDbContext _db;
    private readonly KepLedgerWriter _kepWriter;

    public WarehouseDocumentsController(IWebPosDbContext db, KepLedgerWriter kepWriter)
    {
        _db = db;
        _kepWriter = kepWriter;
    }

    // -------------------------------------------------------------------------
    // Shared helpers: Period Lock, Tenant Settings, Validation, Audit
    // -------------------------------------------------------------------------

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

    private async Task<IActionResult?> ValidateItemsExistAsync(Guid tid, IEnumerable<Guid> itemIds, CancellationToken ct)
    {
        var distinct = itemIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (distinct.Count == 0) return null;

        var existingCount = await _db.Items.AsNoTracking()
            .CountAsync(i => i.TenantId == tid && distinct.Contains(i.Id), ct);
        if (existingCount != distinct.Count)
            return BadRequest(new { message = "Jedan ili više odabranih artikala ne postoji u bazi." });

        return null;
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

    private async Task<string?> TryReadReasonAsync(CancellationToken ct)
    {
        if (Request.HasJsonContentType())
        {
            try
            {
                var body = await Request.ReadFromJsonAsync<ReverseDocumentRequest>(cancellationToken: ct);
                if (!string.IsNullOrWhiteSpace(body?.Reason))
                    return body.Reason.Trim();
            }
            catch (JsonException)
            {
                // Optional body may be empty or omitted
            }
        }

        var queryReason = Request.Query["reason"].FirstOrDefault();
        return string.IsNullOrWhiteSpace(queryReason) ? null : queryReason.Trim();
    }

    private void AddAuditLog(
        Guid tid,
        string action,
        string entityName,
        Guid entityId,
        string entityCode,
        string summary,
        string? previousState = null,
        string? newState = null,
        string? reason = null)
    {
        var details = JsonSerializer.Serialize(new
        {
            entityCode,
            summary,
            previousState,
            newState,
            reason
        });

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = action,
            EntityName = entityName,
            EntityId = entityId.ToString(),
            DetailsJson = details,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });
    }

    private static bool IsOutgoingOtherDoc(OtherWarehouseDocSubtype subtype) =>
        subtype is OtherWarehouseDocSubtype.WriteoffKalorastur
            or OtherWarehouseDocSubtype.InternalIssue
            or OtherWarehouseDocSubtype.SupplierReturn;

    private static (decimal VatDiff, decimal MarginDiff) ComputeLevelingVatAndMargin(decimal totalDiff, decimal vatRatePercent)
    {
        if (vatRatePercent <= 0m)
        {
            return (0m, CalculationMath.Round2(totalDiff));
        }

        var netDiff = CalculationMath.Round2(totalDiff / (1m + (vatRatePercent / 100m)));
        var vatDiff = CalculationMath.Round2(totalDiff - netDiff);
        var marginDiff = CalculationMath.Round2(totalDiff - vatDiff);
        return (vatDiff, marginDiff);
    }

    // -------------------------------------------------------------------------
    // 1. Inbound Calculations
    // -------------------------------------------------------------------------

    [HttpGet("calculations")]
    public async Task<IActionResult> GetCalculations([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.InboundCalculations.AsNoTracking()
            .Where(d => d.TenantId == tid)
            .Include(d => d.Lines)
            .OrderByDescending(d => d.DocumentDate)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("calculations")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> CreateCalculation([FromBody] CreateCalculationRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var docNumber = req.DocumentNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(docNumber))
            return BadRequest(new { message = "Broj dokumenta kalkulacije je obavezan." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        if (!await _db.Partners.AnyAsync(p => p.Id == req.SupplierId && p.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrani dobavljač ne postoji u bazi." });

        if (!await _db.FiscalYears.AnyAsync(f => f.Id == req.FiscalYearId && f.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi." });

        var validLines = (req.Lines ?? new List<CreateCalculationLineRequest>())
            .Where(l => l.ItemId != Guid.Empty)
            .ToList();

        var itemsErr = await ValidateItemsExistAsync(tid, validLines.Select(l => l.ItemId), ct);
        if (itemsErr is not null) return itemsErr;

        if (validLines.Any(l => l.Quantity <= 0m))
            return BadRequest(new { message = "Količina na stavci kalkulacije mora biti veća od nule." });

        InboundCalculation? doc = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            doc = await _db.InboundCalculations
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == req.Id.Value && d.TenantId == tid, ct);
        }

        var isNew = doc is null;
        var targetId = doc?.Id ?? (req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid());

        var duplicateNumber = await _db.InboundCalculations.AsNoTracking()
            .AnyAsync(d => d.TenantId == tid && d.FiscalYearId == req.FiscalYearId && d.DocumentNumber == docNumber && d.Id != targetId, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Kalkulacija sa brojem '{docNumber}' već postoji u odabranoj poslovnoj godini." });

        if (doc is not null)
        {
            if (doc.Status != DocumentStatus.Draft)
                return BadRequest(new { message = "Proknjižena ili stornirana kalkulacija se ne može mijenjati." });

            doc.StoreId = req.StoreId;
            doc.SupplierId = req.SupplierId;
            doc.FiscalYearId = req.FiscalYearId;
            doc.DocumentNumber = docNumber;
            doc.DocumentDate = req.DocumentDate;
            doc.InvoiceNumber = req.InvoiceNumber?.Trim();
            doc.InvoiceDate = req.InvoiceDate;
            doc.OrderNumber = req.OrderNumber?.Trim();
            doc.DeliveryNoteNumber = req.DeliveryNoteNumber?.Trim();
            doc.Note = req.Note?.Trim();

            _db.InboundCalculationLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();
        }
        else
        {
            doc = new InboundCalculation
            {
                Id = targetId,
                TenantId = tid,
                StoreId = req.StoreId,
                SupplierId = req.SupplierId,
                FiscalYearId = req.FiscalYearId,
                DocumentNumber = docNumber,
                DocumentDate = req.DocumentDate,
                InvoiceNumber = req.InvoiceNumber?.Trim(),
                InvoiceDate = req.InvoiceDate,
                OrderNumber = req.OrderNumber?.Trim(),
                DeliveryNoteNumber = req.DeliveryNoteNumber?.Trim(),
                Status = DocumentStatus.Draft,
                Note = req.Note?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAtUtc = DateTime.UtcNow
            };
        }

        var lineNo = 1;
        foreach (var l in validLines)
        {
            var calc = CalculationMath.CalculateInboundLine(
                l.Quantity,
                l.InvoicePriceExclVat4,
                l.DiscountPct,
                l.DependentCostPct,
                l.MarginPct,
                l.VatRatePercent);

            var lineEntity = new InboundCalculationLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                InboundCalculationId = doc.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                InvoicePriceExclVat4 = CalculationMath.Round4(l.InvoicePriceExclVat4),
                DiscountPct = l.DiscountPct,
                DiscountAmount4 = calc.DiscountAmount4,
                DependentCostPct = l.DependentCostPct,
                DependentCostAmount4 = calc.DependentCostAmount4,
                PurchasePriceExclVat4 = calc.PurchasePriceExclVat4,
                MarginPct = l.MarginPct,
                WholesalePriceExclVat4 = calc.WholesalePriceExclVat4,
                VatRatePercent = l.VatRatePercent,
                RetailPriceInclVat2 = calc.RetailPriceInclVat2,
                LineTotalPurchase4 = calc.LineTotalPurchase4,
                LineTotalRetail2 = calc.LineTotalRetail2,
                LineVatAmount2 = calc.LineVatAmount2
            };

            doc.Lines.Add(lineEntity);
            if (!isNew)
            {
                _db.InboundCalculationLines.Add(lineEntity);
            }
        }

        doc.TotalPurchaseExclVat = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotalPurchase4));
        doc.TotalDependentCosts = CalculationMath.Round2(doc.Lines.Sum(x => x.DependentCostAmount4 * x.Quantity));
        doc.TotalRetailInclVat = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotalRetail2));
        doc.TotalVatAmount = CalculationMath.Round2(doc.Lines.Sum(x => x.LineVatAmount2));

        if (isNew)
        {
            _db.InboundCalculations.Add(doc);
        }

        AddAuditLog(
            tid,
            isNew ? "CREATE" : "UPDATE",
            nameof(InboundCalculation),
            doc.Id,
            doc.DocumentNumber,
            isNew ? $"Kreiran nacrt kalkulacije {doc.DocumentNumber}" : $"Ažuriran nacrt kalkulacije {doc.DocumentNumber}",
            isNew ? null : "DRAFT",
            "DRAFT");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("calculations/{id:guid}/post")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> PostCalculation(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.InboundCalculations
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Kalkulacija nije pronađena." });
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Kalkulacija je već proknjižena." });
        if (doc.Status == DocumentStatus.Canceled) return BadRequest(new { message = "Stornirana kalkulacija se ne može proknjižiti." });
        if (doc.Lines.Count == 0) return BadRequest(new { message = "Kalkulacija nema stavki za knjiženje." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        string? autoLevelingDocNumber = null;

        // Pass 1: Auto-create & post PriceLeveling BEFORE adding incoming quantity
        if (settings.AutoCreatePriceLevelingOnInbound)
        {
            var autoLines = new List<PriceLevelingLine>();
            var autoLineNo = 1;
            var autoLevelingId = Guid.NewGuid();

            // Evaluate distinct items by final incoming retail price before mutating any stock
            var distinctIncomingByItem = doc.Lines
                .OrderBy(l => l.LineNumber)
                .GroupBy(l => l.ItemId)
                .Select(g => g.Last())
                .ToList();

            foreach (var line in distinctIncomingByItem)
            {
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
                if (price.StockQty > 0m && price.RetailPriceInclVat2 != line.RetailPriceInclVat2)
                {
                    var oldPrice = price.RetailPriceInclVat2;
                    var newPrice = line.RetailPriceInclVat2;
                    var diffPerUnit = CalculationMath.Round2(newPrice - oldPrice);
                    var totalDiff = CalculationMath.Round2(diffPerUnit * price.StockQty);
                    var (vatDiff, marginDiff) = ComputeLevelingVatAndMargin(totalDiff, line.VatRatePercent);

                    autoLines.Add(new PriceLevelingLine
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tid,
                        PriceLevelingId = autoLevelingId,
                        LineNumber = autoLineNo++,
                        ItemId = line.ItemId,
                        StockQty = price.StockQty,
                        OldRetailPriceInclVat2 = oldPrice,
                        NewRetailPriceInclVat2 = newPrice,
                        PriceDifference2 = diffPerUnit,
                        TotalDifference2 = totalDiff,
                        VatRatePercent = line.VatRatePercent,
                        VatDifference2 = vatDiff,
                        MarginDifference2 = marginDiff
                    });
                }
            }

            if (autoLines.Count > 0)
            {
                var baseAutoNumber = $"NIV-AUTO-{doc.DocumentNumber}";
                var candidateNumber = baseAutoNumber;
                var suffix = 2;
                while (await _db.PriceLevelings.AsNoTracking()
                    .AnyAsync(p => p.TenantId == tid && p.FiscalYearId == doc.FiscalYearId && p.DocumentNumber == candidateNumber, ct))
                {
                    candidateNumber = $"{baseAutoNumber}-{suffix++}";
                }

                autoLevelingDocNumber = candidateNumber;
                var autoDoc = new PriceLeveling
                {
                    Id = autoLevelingId,
                    TenantId = tid,
                    StoreId = doc.StoreId,
                    FiscalYearId = doc.FiscalYearId,
                    DocumentNumber = candidateNumber,
                    DocumentDate = doc.DocumentDate,
                    Status = DocumentStatus.Posted,
                    Reason = $"Automatska nivelacija uz kalkulaciju {doc.DocumentNumber}",
                    TotalDifferenceAmount2 = CalculationMath.Round2(autoLines.Sum(x => x.TotalDifference2)),
                    TotalVatDifference2 = CalculationMath.Round2(autoLines.Sum(x => x.VatDifference2)),
                    TotalMarginDifference2 = CalculationMath.Round2(autoLines.Sum(x => x.MarginDifference2)),
                    CreatedByUserId = CurrentUserId,
                    PostedByUserId = CurrentUserId,
                    CreatedAtUtc = DateTime.UtcNow,
                    PostedAtUtc = DateTime.UtcNow,
                    Lines = autoLines
                };

                _db.PriceLevelings.Add(autoDoc);

                var autoDir = autoDoc.TotalDifferenceAmount2 >= 0m ? LedgerDirection.Debit : LedgerDirection.Credit;
                await _kepWriter.AppendEntryAsync(
                    tid,
                    autoDoc.StoreId,
                    autoDoc.FiscalYearId,
                    autoDoc.DocumentDate,
                    "PRICE_LEVELING",
                    autoDoc.Id,
                    autoDoc.DocumentNumber,
                    $"Automatska nivelacija {autoDoc.DocumentNumber}",
                    autoDir,
                    autoDoc.TotalDifferenceAmount2,
                    ct);

                AddAuditLog(
                    tid,
                    "POST",
                    nameof(PriceLeveling),
                    autoDoc.Id,
                    autoDoc.DocumentNumber,
                    $"Automatski kreirana i proknjižena nivelacija {autoDoc.DocumentNumber} uz kalkulaciju {doc.DocumentNumber}",
                    "DRAFT",
                    "POSTED");

                // Flush auto-leveling + its KEP entry so the subsequent calculation KEP entry gets the next sequence number and running balance
                await _db.SaveChangesAsync(ct);
            }
        }

        // Pass 2: Apply incoming calculation stock and prices
        foreach (var line in doc.Lines.OrderBy(l => l.LineNumber))
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty += line.Quantity;
            price.PurchasePriceExclVat4 = line.PurchasePriceExclVat4;
            price.WholesalePriceExclVat4 = line.WholesalePriceExclVat4;
            price.RetailPriceInclVat2 = line.RetailPriceInclVat2;
            price.NeedsLabelPrint = true;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Posted;
        doc.PostedByUserId = CurrentUserId;
        doc.PostedAtUtc = DateTime.UtcNow;

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "INBOUND_CALCULATION",
            doc.Id,
            doc.DocumentNumber,
            $"Ulazna kalkulacija {doc.DocumentNumber}",
            LedgerDirection.Debit,
            doc.TotalRetailInclVat,
            ct);

        AddAuditLog(
            tid,
            "POST",
            nameof(InboundCalculation),
            doc.Id,
            doc.DocumentNumber,
            $"Proknjižena kalkulacija {doc.DocumentNumber}",
            "DRAFT",
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(new { calculation = doc, autoLevelingDocNumber });
    }

    [HttpPost("calculations/{id:guid}/reverse")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> ReverseCalculation(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var reason = await TryReadReasonAsync(ct);

        var doc = await _db.InboundCalculations
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Kalkulacija nije pronađena." });
        if (doc.Status != DocumentStatus.Posted)
            return BadRequest(new { message = "Samo proknjižena kalkulacija se može stornirati." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();

        if (!settings.AllowNegativeStock)
        {
            foreach (var grp in doc.Lines.GroupBy(l => l.ItemId))
            {
                var qtyToRevert = grp.Sum(x => x.Quantity);
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, grp.Key, ct);
                if (price.StockQty < qtyToRevert)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha za storniranje kalkulacije (stanje: {price.StockQty:0.##}, potrebno: {qtyToRevert:0.##})."
                    });
                }
            }
        }

        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty -= line.Quantity;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Canceled;

        var desc = string.IsNullOrWhiteSpace(reason)
            ? $"Storno kalkulacije {doc.DocumentNumber}"
            : $"Storno kalkulacije {doc.DocumentNumber}: {reason}";

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "CALCULATION_REVERSAL",
            doc.Id,
            $"ST-{doc.DocumentNumber}",
            desc,
            LedgerDirection.Credit,
            doc.TotalRetailInclVat,
            ct);

        AddAuditLog(
            tid,
            "REVERSE",
            nameof(InboundCalculation),
            doc.Id,
            doc.DocumentNumber,
            desc,
            "POSTED",
            "REVERSED",
            reason);

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpDelete("calculations/{id:guid}")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> DeleteCalculation(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = await _db.InboundCalculations
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Kalkulacija nije pronađena." });
        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new { message = "Samo dokumenti u statusu Nacrt se mogu obrisati." });

        _db.InboundCalculationLines.RemoveRange(doc.Lines);
        _db.InboundCalculations.Remove(doc);

        AddAuditLog(
            tid,
            "DELETE_DRAFT",
            nameof(InboundCalculation),
            doc.Id,
            doc.DocumentNumber,
            $"Obrisan nacrt kalkulacije {doc.DocumentNumber}",
            "DRAFT",
            "DELETED");

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // 2. Price Levelings
    // -------------------------------------------------------------------------

    [HttpGet("levelings")]
    public async Task<IActionResult> GetLevelings([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.PriceLevelings.AsNoTracking()
            .Where(d => d.TenantId == tid)
            .Include(d => d.Lines)
            .OrderByDescending(d => d.DocumentDate)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("levelings")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> CreateLeveling([FromBody] CreatePriceLevelingRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var docNumber = req.DocumentNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(docNumber))
            return BadRequest(new { message = "Broj dokumenta nivelacije je obavezan." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        if (!await _db.FiscalYears.AnyAsync(f => f.Id == req.FiscalYearId && f.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi. Prvo kreirajte poslovnu godinu." });

        var validLines = (req.Lines ?? new List<CreatePriceLevelingLineRequest>())
            .Where(x => x.ItemId != Guid.Empty)
            .ToList();

        var itemsErr = await ValidateItemsExistAsync(tid, validLines.Select(l => l.ItemId), ct);
        if (itemsErr is not null) return itemsErr;

        PriceLeveling? doc = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            doc = await _db.PriceLevelings
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == req.Id.Value && d.TenantId == tid, ct);
        }

        var isNew = doc is null;
        var targetId = doc?.Id ?? (req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid());

        var duplicateNumber = await _db.PriceLevelings.AsNoTracking()
            .AnyAsync(d => d.TenantId == tid && d.FiscalYearId == req.FiscalYearId && d.DocumentNumber == docNumber && d.Id != targetId, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Nivelacija sa brojem '{docNumber}' već postoji u odabranoj poslovnoj godini." });

        if (doc is not null)
        {
            if (doc.Status != DocumentStatus.Draft)
                return BadRequest(new { message = "Proknjižena ili stornirana nivelacija se ne može mijenjati." });

            doc.StoreId = req.StoreId;
            doc.FiscalYearId = req.FiscalYearId;
            doc.DocumentNumber = docNumber;
            doc.DocumentDate = req.DocumentDate;
            doc.Reason = req.Reason?.Trim();
            _db.PriceLevelingLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();
        }
        else
        {
            doc = new PriceLeveling
            {
                Id = targetId,
                TenantId = tid,
                StoreId = req.StoreId,
                FiscalYearId = req.FiscalYearId,
                DocumentNumber = docNumber,
                DocumentDate = req.DocumentDate,
                Status = DocumentStatus.Draft,
                Reason = req.Reason?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAtUtc = DateTime.UtcNow
            };
        }

        var lineItemIds = validLines.Select(l => l.ItemId).Distinct().ToList();
        var itemVatMap = await (
            from i in _db.Items.AsNoTracking()
            join v in _db.VatRates.AsNoTracking() on i.VatRateId equals v.Id into vj
            from v in vj.DefaultIfEmpty()
            where i.TenantId == tid && lineItemIds.Contains(i.Id)
            select new { i.Id, Rate = v != null ? v.RatePercent : 17m }
        ).ToDictionaryAsync(x => x.Id, x => x.Rate, ct);

        var lineNo = 1;
        foreach (var l in validLines)
        {
            var price = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.StoreId && p.ItemId == l.ItemId, ct);

            var stockQty = price?.StockQty ?? 0m;
            var oldPrice = price?.RetailPriceInclVat2 ?? 0m;
            var newPrice = CalculationMath.Round2(l.NewRetailPriceInclVat2);
            var diffPerUnit = CalculationMath.Round2(newPrice - oldPrice);
            var totalDiff = CalculationMath.Round2(diffPerUnit * stockQty);
            var vatRate = itemVatMap.TryGetValue(l.ItemId, out var vr) ? vr : 17m;
            var (vatDiff, marginDiff) = ComputeLevelingVatAndMargin(totalDiff, vatRate);

            var lineEntity = new PriceLevelingLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                PriceLevelingId = doc.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                StockQty = stockQty,
                OldRetailPriceInclVat2 = oldPrice,
                NewRetailPriceInclVat2 = newPrice,
                PriceDifference2 = diffPerUnit,
                TotalDifference2 = totalDiff,
                VatRatePercent = vatRate,
                VatDifference2 = vatDiff,
                MarginDifference2 = marginDiff
            };

            doc.Lines.Add(lineEntity);
            if (!isNew)
            {
                _db.PriceLevelingLines.Add(lineEntity);
            }
        }

        doc.TotalDifferenceAmount2 = CalculationMath.Round2(doc.Lines.Sum(x => x.TotalDifference2));
        doc.TotalVatDifference2 = CalculationMath.Round2(doc.Lines.Sum(x => x.VatDifference2));
        doc.TotalMarginDifference2 = CalculationMath.Round2(doc.Lines.Sum(x => x.MarginDifference2));

        if (isNew)
        {
            _db.PriceLevelings.Add(doc);
        }

        AddAuditLog(
            tid,
            isNew ? "CREATE" : "UPDATE",
            nameof(PriceLeveling),
            doc.Id,
            doc.DocumentNumber,
            isNew ? $"Kreiran nacrt nivelacije {doc.DocumentNumber}" : $"Ažuriran nacrt nivelacije {doc.DocumentNumber}",
            isNew ? null : "DRAFT",
            "DRAFT");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("levelings/{id:guid}/post")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> PostLeveling(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.PriceLevelings
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Nivelacija nije pronađena." });
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Nivelacija je već proknjižena." });
        if (doc.Status == DocumentStatus.Canceled) return BadRequest(new { message = "Stornirana nivelacija se ne može proknjižiti." });
        if (doc.Lines.Count == 0) return BadRequest(new { message = "Nivelacija nema stavki za knjiženje." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.RetailPriceInclVat2 = line.NewRetailPriceInclVat2;
            price.NeedsLabelPrint = true;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Posted;
        doc.PostedByUserId = CurrentUserId;
        doc.PostedAtUtc = DateTime.UtcNow;

        var direction = doc.TotalDifferenceAmount2 >= 0m ? LedgerDirection.Debit : LedgerDirection.Credit;
        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "PRICE_LEVELING",
            doc.Id,
            doc.DocumentNumber,
            $"Nivelacija cijena {doc.DocumentNumber}",
            direction,
            doc.TotalDifferenceAmount2,
            ct);

        AddAuditLog(
            tid,
            "POST",
            nameof(PriceLeveling),
            doc.Id,
            doc.DocumentNumber,
            $"Proknjižena nivelacija {doc.DocumentNumber}",
            "DRAFT",
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("levelings/{id:guid}/reverse")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> ReverseLeveling(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var reason = await TryReadReasonAsync(ct);

        var doc = await _db.PriceLevelings
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Nivelacija nije pronađena." });
        if (doc.Status != DocumentStatus.Posted)
            return BadRequest(new { message = "Samo proknjižena nivelacija se može stornirati." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.RetailPriceInclVat2 = line.OldRetailPriceInclVat2;
            price.NeedsLabelPrint = true;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Canceled;

        var desc = string.IsNullOrWhiteSpace(reason)
            ? $"Storno nivelacije {doc.DocumentNumber}"
            : $"Storno nivelacije {doc.DocumentNumber}: {reason}";

        var kontraDir = doc.TotalDifferenceAmount2 >= 0m ? LedgerDirection.Credit : LedgerDirection.Debit;
        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "PRICE_LEVELING_REVERSAL",
            doc.Id,
            $"ST-{doc.DocumentNumber}",
            desc,
            kontraDir,
            doc.TotalDifferenceAmount2,
            ct);

        AddAuditLog(
            tid,
            "REVERSE",
            nameof(PriceLeveling),
            doc.Id,
            doc.DocumentNumber,
            desc,
            "POSTED",
            "REVERSED",
            reason);

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpDelete("levelings/{id:guid}")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> DeleteLeveling(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = await _db.PriceLevelings
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Nivelacija nije pronađena." });
        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new { message = "Samo dokumenti u statusu Nacrt se mogu obrisati." });

        _db.PriceLevelingLines.RemoveRange(doc.Lines);
        _db.PriceLevelings.Remove(doc);

        AddAuditLog(
            tid,
            "DELETE_DRAFT",
            nameof(PriceLeveling),
            doc.Id,
            doc.DocumentNumber,
            $"Obrisan nacrt nivelacije {doc.DocumentNumber}",
            "DRAFT",
            "DELETED");

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // 3. Warehouse Transfers
    // -------------------------------------------------------------------------

    [HttpGet("transfers")]
    public async Task<IActionResult> GetTransfers([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.WarehouseTransfers.AsNoTracking()
            .Where(d => d.TenantId == tid)
            .Include(d => d.Lines)
            .OrderByDescending(d => d.DocumentDate)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("transfers")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> CreateTransfer([FromBody] CreateTransferRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var docNumber = req.DocumentNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(docNumber))
            return BadRequest(new { message = "Broj dokumenta međuskladišnice je obavezan." });

        if (req.SourceStoreId == req.TargetStoreId)
            return BadRequest(new { message = "Izvorišno i odredišno skladište ne mogu biti ista." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.SourceStoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Izvorišno skladište ne postoji u bazi." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.TargetStoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odredišno skladište ne postoji u bazi." });

        if (!await _db.FiscalYears.AnyAsync(f => f.Id == req.FiscalYearId && f.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi." });

        var validLines = (req.Lines ?? new List<CreateTransferLineRequest>())
            .Where(l => l.ItemId != Guid.Empty)
            .ToList();

        var itemsErr = await ValidateItemsExistAsync(tid, validLines.Select(l => l.ItemId), ct);
        if (itemsErr is not null) return itemsErr;

        if (validLines.Any(l => l.Quantity <= 0m))
            return BadRequest(new { message = "Količina na stavci međuskladišnice mora biti veća od nule." });

        WarehouseTransfer? doc = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            doc = await _db.WarehouseTransfers
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == req.Id.Value && d.TenantId == tid, ct);
        }

        var isNew = doc is null;
        var targetId = doc?.Id ?? (req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid());

        var duplicateNumber = await _db.WarehouseTransfers.AsNoTracking()
            .AnyAsync(d => d.TenantId == tid && d.FiscalYearId == req.FiscalYearId && d.DocumentNumber == docNumber && d.Id != targetId, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Međuskladišnica sa brojem '{docNumber}' već postoji u odabranoj poslovnoj godini." });

        if (doc is not null)
        {
            if (doc.Status != DocumentStatus.Draft)
                return BadRequest(new { message = "Proknjižena ili stornirana međuskladišnica se ne može mijenjati." });

            doc.SourceStoreId = req.SourceStoreId;
            doc.TargetStoreId = req.TargetStoreId;
            doc.FiscalYearId = req.FiscalYearId;
            doc.DocumentNumber = docNumber;
            doc.DocumentDate = req.DocumentDate;
            doc.Note = req.Note?.Trim();

            _db.WarehouseTransferLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();
        }
        else
        {
            doc = new WarehouseTransfer
            {
                Id = targetId,
                TenantId = tid,
                SourceStoreId = req.SourceStoreId,
                TargetStoreId = req.TargetStoreId,
                FiscalYearId = req.FiscalYearId,
                DocumentNumber = docNumber,
                DocumentDate = req.DocumentDate,
                Status = DocumentStatus.Draft,
                Note = req.Note?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAtUtc = DateTime.UtcNow
            };
        }

        var lineNo = 1;
        foreach (var l in validLines)
        {
            var srcPrice = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.SourceStoreId && p.ItemId == l.ItemId, ct);

            var purchase4 = srcPrice?.PurchasePriceExclVat4 ?? 0m;
            var retail2 = srcPrice?.RetailPriceInclVat2 ?? 0m;
            var lineTotal2 = CalculationMath.Round2(retail2 * l.Quantity);

            var lineEntity = new WarehouseTransferLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                WarehouseTransferId = doc.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                PurchasePriceExclVat4 = purchase4,
                RetailPriceInclVat2 = retail2,
                LineTotal2 = lineTotal2
            };

            doc.Lines.Add(lineEntity);
            if (!isNew)
            {
                _db.WarehouseTransferLines.Add(lineEntity);
            }
        }

        doc.TotalValue2 = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotal2));

        if (isNew)
        {
            _db.WarehouseTransfers.Add(doc);
        }

        AddAuditLog(
            tid,
            isNew ? "CREATE" : "UPDATE",
            nameof(WarehouseTransfer),
            doc.Id,
            doc.DocumentNumber,
            isNew ? $"Kreiran nacrt međuskladišnice {doc.DocumentNumber}" : $"Ažuriran nacrt međuskladišnice {doc.DocumentNumber}",
            isNew ? null : "DRAFT",
            "DRAFT");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("transfers/{id:guid}/post")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> PostTransfer(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.WarehouseTransfers
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Međuskladišnica nije pronađena." });
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Međuskladišnica je već proknjižena." });
        if (doc.Status == DocumentStatus.Canceled) return BadRequest(new { message = "Stornirana međuskladišnica se ne može proknjižiti." });
        if (doc.Lines.Count == 0) return BadRequest(new { message = "Međuskladišnica nema stavki za knjiženje." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();

        if (!settings.AllowNegativeStock)
        {
            foreach (var grp in doc.Lines.GroupBy(l => l.ItemId))
            {
                var needed = grp.Sum(x => x.Quantity);
                var src = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.SourceStoreId, grp.Key, ct);
                if (src.StockQty < needed)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha za artikal na izvorišnom skladištu (stanje: {src.StockQty:0.##})."
                    });
                }
            }
        }

        foreach (var line in doc.Lines)
        {
            var src = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.SourceStoreId, line.ItemId, ct);
            src.StockQty -= line.Quantity;
            src.UpdatedAtUtc = DateTime.UtcNow;

            var dst = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.TargetStoreId, line.ItemId, ct);
            dst.StockQty += line.Quantity;
            if (dst.PurchasePriceExclVat4 == 0m) dst.PurchasePriceExclVat4 = line.PurchasePriceExclVat4;
            if (dst.RetailPriceInclVat2 == 0m && line.RetailPriceInclVat2 > 0m)
            {
                dst.RetailPriceInclVat2 = line.RetailPriceInclVat2;
                dst.NeedsLabelPrint = true;
            }
            dst.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Posted;
        doc.PostedByUserId = CurrentUserId;
        doc.PostedAtUtc = DateTime.UtcNow;

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.SourceStoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "WAREHOUSE_TRANSFER_OUT",
            doc.Id,
            doc.DocumentNumber,
            $"Međuskladišnica izlaz {doc.DocumentNumber}",
            LedgerDirection.Credit,
            doc.TotalValue2,
            ct);

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.TargetStoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "WAREHOUSE_TRANSFER_IN",
            doc.Id,
            doc.DocumentNumber,
            $"Međuskladišnica ulaz {doc.DocumentNumber}",
            LedgerDirection.Debit,
            doc.TotalValue2,
            ct);

        AddAuditLog(
            tid,
            "POST",
            nameof(WarehouseTransfer),
            doc.Id,
            doc.DocumentNumber,
            $"Proknjižena međuskladišnica {doc.DocumentNumber}",
            "DRAFT",
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("transfers/{id:guid}/reverse")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> ReverseTransfer(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var reason = await TryReadReasonAsync(ct);

        var doc = await _db.WarehouseTransfers
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Međuskladišnica nije pronađena." });
        if (doc.Status != DocumentStatus.Posted)
            return BadRequest(new { message = "Samo proknjižena međuskladišnica se može stornirati." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();

        if (!settings.AllowNegativeStock)
        {
            foreach (var grp in doc.Lines.GroupBy(l => l.ItemId))
            {
                var qtyToRevert = grp.Sum(x => x.Quantity);
                var dst = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.TargetStoreId, grp.Key, ct);
                if (dst.StockQty < qtyToRevert)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha na odredišnom skladištu za storniranje međuskladišnice (stanje: {dst.StockQty:0.##})."
                    });
                }
            }
        }

        foreach (var line in doc.Lines)
        {
            var src = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.SourceStoreId, line.ItemId, ct);
            src.StockQty += line.Quantity;
            src.UpdatedAtUtc = DateTime.UtcNow;

            var dst = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.TargetStoreId, line.ItemId, ct);
            dst.StockQty -= line.Quantity;
            dst.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Canceled;

        var desc = string.IsNullOrWhiteSpace(reason)
            ? $"Storno međuskladišnice {doc.DocumentNumber}"
            : $"Storno međuskladišnice {doc.DocumentNumber}: {reason}";

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.SourceStoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "WAREHOUSE_TRANSFER_OUT_REVERSAL",
            doc.Id,
            $"ST-{doc.DocumentNumber}",
            $"{desc} (povrat na izvorište)",
            LedgerDirection.Debit,
            doc.TotalValue2,
            ct);

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.TargetStoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            "WAREHOUSE_TRANSFER_IN_REVERSAL",
            doc.Id,
            $"ST-{doc.DocumentNumber}",
            $"{desc} (storno prijema)",
            LedgerDirection.Credit,
            doc.TotalValue2,
            ct);

        AddAuditLog(
            tid,
            "REVERSE",
            nameof(WarehouseTransfer),
            doc.Id,
            doc.DocumentNumber,
            desc,
            "POSTED",
            "REVERSED",
            reason);

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpDelete("transfers/{id:guid}")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> DeleteTransfer(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = await _db.WarehouseTransfers
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Međuskladišnica nije pronađena." });
        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new { message = "Samo dokumenti u statusu Nacrt se mogu obrisati." });

        _db.WarehouseTransferLines.RemoveRange(doc.Lines);
        _db.WarehouseTransfers.Remove(doc);

        AddAuditLog(
            tid,
            "DELETE_DRAFT",
            nameof(WarehouseTransfer),
            doc.Id,
            doc.DocumentNumber,
            $"Obrisan nacrt međuskladišnice {doc.DocumentNumber}",
            "DRAFT",
            "DELETED");

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // 4. Inventory Counts
    // -------------------------------------------------------------------------

    [HttpGet("inventory-counts")]
    public async Task<IActionResult> GetInventoryCounts([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.InventoryCounts.AsNoTracking()
            .Where(d => d.TenantId == tid)
            .Include(d => d.Lines)
            .OrderByDescending(d => d.CountDate)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("inventory-counts")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> CreateInventoryCount([FromBody] CreateInventoryCountRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var docNumber = req.DocumentNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(docNumber))
            return BadRequest(new { message = "Broj popisnog dokumenta je obavezan." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        if (!await _db.FiscalYears.AnyAsync(f => f.Id == req.FiscalYearId && f.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi." });

        var validLines = (req.Lines ?? new List<CreateInventoryCountLineRequest>())
            .Where(l => l.ItemId != Guid.Empty)
            .ToList();

        var itemsErr = await ValidateItemsExistAsync(tid, validLines.Select(l => l.ItemId), ct);
        if (itemsErr is not null) return itemsErr;

        InventoryCount? doc = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            doc = await _db.InventoryCounts
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == req.Id.Value && d.TenantId == tid, ct);
        }

        var isNew = doc is null;
        var targetId = doc?.Id ?? (req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid());

        var duplicateNumber = await _db.InventoryCounts.AsNoTracking()
            .AnyAsync(d => d.TenantId == tid && d.FiscalYearId == req.FiscalYearId && d.DocumentNumber == docNumber && d.Id != targetId, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Popis sa brojem '{docNumber}' već postoji u odabranoj poslovnoj godini." });

        if (doc is not null)
        {
            if (doc.Status != DocumentStatus.Draft)
                return BadRequest(new { message = "Proknjižen ili storniran popis se ne može mijenjati." });

            doc.StoreId = req.StoreId;
            doc.FiscalYearId = req.FiscalYearId;
            doc.DocumentNumber = docNumber;
            doc.CountDate = req.CountDate;
            doc.Note = req.Note?.Trim();

            _db.InventoryCountLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();
        }
        else
        {
            doc = new InventoryCount
            {
                Id = targetId,
                TenantId = tid,
                StoreId = req.StoreId,
                FiscalYearId = req.FiscalYearId,
                DocumentNumber = docNumber,
                CountDate = req.CountDate,
                Status = DocumentStatus.Draft,
                Note = req.Note?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAtUtc = DateTime.UtcNow
            };
        }

        var lineNo = 1;
        foreach (var l in validLines)
        {
            var price = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.StoreId && p.ItemId == l.ItemId, ct);

            var bookQty = price?.StockQty ?? 0m;
            var diffQty = l.CountedQty - bookQty;
            var shortageQty = diffQty < 0m ? Math.Abs(diffQty) : 0m;
            var unapprovedQty = Math.Max(0m, shortageQty - l.ApprovedShrinkageQty);
            var retail2 = price?.RetailPriceInclVat2 ?? 0m;
            var shortageVat = CalculationMath.CalculateVatFromGross2(
                CalculationMath.Round2(unapprovedQty * retail2),
                l.VatRatePercent);

            var lineEntity = new InventoryCountLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                InventoryCountId = doc.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                BookQty = bookQty,
                CountedQty = l.CountedQty,
                DifferenceQty = diffQty,
                ApprovedShrinkageQty = l.ApprovedShrinkageQty,
                UnapprovedShortageQty = unapprovedQty,
                ShortageVatAmount = shortageVat,
                RetailPriceInclVat2 = retail2,
                VatRatePercent = l.VatRatePercent
            };

            doc.Lines.Add(lineEntity);
            if (!isNew)
            {
                _db.InventoryCountLines.Add(lineEntity);
            }
        }

        doc.TotalShortageVatAmount2 = CalculationMath.Round2(doc.Lines.Sum(x => x.ShortageVatAmount));

        if (isNew)
        {
            _db.InventoryCounts.Add(doc);
        }

        AddAuditLog(
            tid,
            isNew ? "CREATE" : "UPDATE",
            nameof(InventoryCount),
            doc.Id,
            doc.DocumentNumber,
            isNew ? $"Kreiran nacrt popisa {doc.DocumentNumber}" : $"Ažuriran nacrt popisa {doc.DocumentNumber}",
            isNew ? null : "DRAFT",
            "DRAFT");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("inventory-counts/{id:guid}/post")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> PostInventoryCount(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.InventoryCounts
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Popis nije pronađen." });
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Popis je već proknjižen." });
        if (doc.Status == DocumentStatus.Canceled) return BadRequest(new { message = "Storniran popis se ne može proknjižiti." });
        if (doc.Lines.Count == 0) return BadRequest(new { message = "Popis nema stavki za knjiženje." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.CountDate, ct);
        if (periodErr is not null) return periodErr;

        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        decimal netDiffValue2 = 0m;
        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty = line.CountedQty;
            price.UpdatedAtUtc = DateTime.UtcNow;
            netDiffValue2 += CalculationMath.Round2(line.DifferenceQty * line.RetailPriceInclVat2);
        }

        doc.Status = DocumentStatus.Posted;
        doc.PostedByUserId = CurrentUserId;
        doc.PostedAtUtc = DateTime.UtcNow;

        if (netDiffValue2 != 0m)
        {
            var dir = netDiffValue2 > 0m ? LedgerDirection.Debit : LedgerDirection.Credit;
            await _kepWriter.AppendEntryAsync(
                tid,
                doc.StoreId,
                doc.FiscalYearId,
                doc.CountDate,
                "INVENTORY_COUNT",
                doc.Id,
                doc.DocumentNumber,
                $"Popis zaliha {doc.DocumentNumber}",
                dir,
                netDiffValue2,
                ct);
        }

        AddAuditLog(
            tid,
            "POST",
            nameof(InventoryCount),
            doc.Id,
            doc.DocumentNumber,
            $"Proknjižen popis {doc.DocumentNumber}",
            "DRAFT",
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("inventory-counts/{id:guid}/reverse")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> ReverseInventoryCount(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var reason = await TryReadReasonAsync(ct);

        var doc = await _db.InventoryCounts
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Popis nije pronađen." });
        if (doc.Status != DocumentStatus.Posted)
            return BadRequest(new { message = "Samo proknjižen popis se može stornirati." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.CountDate, ct);
        if (periodErr is not null) return periodErr;

        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        decimal netDiffValue2 = 0m;
        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty -= line.DifferenceQty;
            price.UpdatedAtUtc = DateTime.UtcNow;
            netDiffValue2 += CalculationMath.Round2(line.DifferenceQty * line.RetailPriceInclVat2);
        }

        doc.Status = DocumentStatus.Canceled;

        var desc = string.IsNullOrWhiteSpace(reason)
            ? $"Storno popisa {doc.DocumentNumber}"
            : $"Storno popisa {doc.DocumentNumber}: {reason}";

        if (netDiffValue2 != 0m)
        {
            var kontraDir = netDiffValue2 > 0m ? LedgerDirection.Credit : LedgerDirection.Debit;
            await _kepWriter.AppendEntryAsync(
                tid,
                doc.StoreId,
                doc.FiscalYearId,
                doc.CountDate,
                "INVENTORY_COUNT_REVERSAL",
                doc.Id,
                $"ST-{doc.DocumentNumber}",
                desc,
                kontraDir,
                netDiffValue2,
                ct);
        }

        AddAuditLog(
            tid,
            "REVERSE",
            nameof(InventoryCount),
            doc.Id,
            doc.DocumentNumber,
            desc,
            "POSTED",
            "REVERSED",
            reason);

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpDelete("inventory-counts/{id:guid}")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> DeleteInventoryCount(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = await _db.InventoryCounts
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Popis nije pronađen." });
        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new { message = "Samo dokumenti u statusu Nacrt se mogu obrisati." });

        _db.InventoryCountLines.RemoveRange(doc.Lines);
        _db.InventoryCounts.Remove(doc);

        AddAuditLog(
            tid,
            "DELETE_DRAFT",
            nameof(InventoryCount),
            doc.Id,
            doc.DocumentNumber,
            $"Obrisan nacrt popisa {doc.DocumentNumber}",
            "DRAFT",
            "DELETED");

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // 5. Other Warehouse Documents (Otpis, Interna izdatnica/primka, Povrat, Proizvodnja)
    // -------------------------------------------------------------------------

    [HttpGet("other-documents")]
    public async Task<IActionResult> GetOtherDocuments([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.OtherWarehouseDocuments.AsNoTracking()
            .Where(d => d.TenantId == tid)
            .Include(d => d.Lines)
            .OrderByDescending(d => d.DocumentDate)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("other-documents")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> CreateOtherDocument([FromBody] CreateOtherWarehouseDocRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var docNumber = req.DocumentNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(docNumber))
            return BadRequest(new { message = "Broj skladišnog dokumenta je obavezan." });

        if (!await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        if (!await _db.FiscalYears.AnyAsync(f => f.Id == req.FiscalYearId && f.TenantId == tid, ct))
            return BadRequest(new { message = "Odabrana poslovna godina ne postoji u bazi." });

        var validLines = (req.Lines ?? new List<CreateOtherWarehouseDocLineRequest>())
            .Where(l => l.ItemId != Guid.Empty)
            .ToList();

        var itemsErr = await ValidateItemsExistAsync(tid, validLines.Select(l => l.ItemId), ct);
        if (itemsErr is not null) return itemsErr;

        if (validLines.Any(l => l.Quantity <= 0m))
            return BadRequest(new { message = "Količina na stavci dokumenta mora biti veća od nule." });

        OtherWarehouseDocument? doc = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            doc = await _db.OtherWarehouseDocuments
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == req.Id.Value && d.TenantId == tid, ct);
        }

        var isNew = doc is null;
        var targetId = doc?.Id ?? (req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid());

        var duplicateNumber = await _db.OtherWarehouseDocuments.AsNoTracking()
            .AnyAsync(d => d.TenantId == tid && d.FiscalYearId == req.FiscalYearId && d.DocumentNumber == docNumber && d.Id != targetId, ct);
        if (duplicateNumber)
            return BadRequest(new { message = $"Skladišni dokument sa brojem '{docNumber}' već postoji u odabranoj poslovnoj godini." });

        if (doc is not null)
        {
            if (doc.Status != DocumentStatus.Draft)
                return BadRequest(new { message = "Proknjižen ili storniran dokument se ne može mijenjati." });

            doc.StoreId = req.StoreId;
            doc.FiscalYearId = req.FiscalYearId;
            doc.DocumentNumber = docNumber;
            doc.DocumentDate = req.DocumentDate;
            doc.Subtype = req.Subtype;
            doc.Note = req.Note?.Trim();

            _db.OtherWarehouseDocumentLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();
        }
        else
        {
            doc = new OtherWarehouseDocument
            {
                Id = targetId,
                TenantId = tid,
                StoreId = req.StoreId,
                FiscalYearId = req.FiscalYearId,
                DocumentNumber = docNumber,
                DocumentDate = req.DocumentDate,
                Subtype = req.Subtype,
                Status = DocumentStatus.Draft,
                Note = req.Note?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAtUtc = DateTime.UtcNow
            };
        }

        var lineNo = 1;
        foreach (var l in validLines)
        {
            var price = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.StoreId && p.ItemId == l.ItemId, ct);

            var purchase4 = price?.PurchasePriceExclVat4 ?? 0m;
            var retail2 = price?.RetailPriceInclVat2 ?? 0m;
            var linePurchaseTotal2 = CalculationMath.Round2(purchase4 * l.Quantity);
            var lineRetailTotal2 = CalculationMath.Round2(retail2 * l.Quantity);

            var lineEntity = new OtherWarehouseDocumentLine
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                OtherWarehouseDocumentId = doc.Id,
                LineNumber = lineNo++,
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                PurchasePriceExclVat4 = purchase4,
                RetailPriceInclVat2 = retail2,
                LinePurchaseTotal2 = linePurchaseTotal2,
                LineRetailTotal2 = lineRetailTotal2,
                Reason = l.Reason?.Trim()
            };

            doc.Lines.Add(lineEntity);
            if (!isNew)
            {
                _db.OtherWarehouseDocumentLines.Add(lineEntity);
            }
        }

        doc.TotalPurchaseValue2 = CalculationMath.Round2(doc.Lines.Sum(x => x.LinePurchaseTotal2));
        doc.TotalRetailValue2 = CalculationMath.Round2(doc.Lines.Sum(x => x.LineRetailTotal2));

        if (isNew)
        {
            _db.OtherWarehouseDocuments.Add(doc);
        }

        AddAuditLog(
            tid,
            isNew ? "CREATE" : "UPDATE",
            nameof(OtherWarehouseDocument),
            doc.Id,
            doc.DocumentNumber,
            isNew ? $"Kreiran nacrt skladišnog dokumenta {doc.DocumentNumber}" : $"Ažuriran nacrt skladišnog dokumenta {doc.DocumentNumber}",
            isNew ? null : "DRAFT",
            "DRAFT");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("other-documents/{id:guid}/post")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> PostOtherDocument(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.OtherWarehouseDocuments
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Skladišni dokument nije pronađen." });
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Skladišni dokument je već proknjižen." });
        if (doc.Status == DocumentStatus.Canceled) return BadRequest(new { message = "Storniran dokument se ne može proknjižiti." });
        if (doc.Lines.Count == 0) return BadRequest(new { message = "Dokument nema stavki za knjiženje." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        var isOutgoing = IsOutgoingOtherDoc(doc.Subtype);

        if (isOutgoing && !settings.AllowNegativeStock)
        {
            foreach (var grp in doc.Lines.GroupBy(l => l.ItemId))
            {
                var needed = grp.Sum(x => x.Quantity);
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, grp.Key, ct);
                if (price.StockQty < needed)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha za artikal na skladištu (stanje: {price.StockQty:0.##})."
                    });
                }
            }
        }

        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty += isOutgoing ? -line.Quantity : line.Quantity;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Posted;
        doc.PostedByUserId = CurrentUserId;
        doc.PostedAtUtc = DateTime.UtcNow;

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            $"OTHER_{doc.Subtype.ToString().ToUpperInvariant()}",
            doc.Id,
            doc.DocumentNumber,
            $"Skladišni dokument ({doc.Subtype}) {doc.DocumentNumber}",
            isOutgoing ? LedgerDirection.Credit : LedgerDirection.Debit,
            doc.TotalRetailValue2,
            ct);

        AddAuditLog(
            tid,
            "POST",
            nameof(OtherWarehouseDocument),
            doc.Id,
            doc.DocumentNumber,
            $"Proknjižen skladišni dokument {doc.DocumentNumber}",
            "DRAFT",
            "POSTED");

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("other-documents/{id:guid}/reverse")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> ReverseOtherDocument(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var reason = await TryReadReasonAsync(ct);

        var doc = await _db.OtherWarehouseDocuments
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Skladišni dokument nije pronađen." });
        if (doc.Status != DocumentStatus.Posted)
            return BadRequest(new { message = "Samo proknjižen skladišni dokument se može stornirati." });

        var periodErr = await ValidatePeriodOpenAsync(tid, doc.FiscalYearId, doc.DocumentDate, ct);
        if (periodErr is not null) return periodErr;

        var settings = await GetTenantSettingsAsync(tid, ct);
        var priceCache = new Dictionary<(Guid StoreId, Guid ItemId), StoreItemPrice>();
        var isOutgoing = IsOutgoingOtherDoc(doc.Subtype);

        // Reversing an incoming document deducts stock, so enforce AllowNegativeStock
        if (!isOutgoing && !settings.AllowNegativeStock)
        {
            foreach (var grp in doc.Lines.GroupBy(l => l.ItemId))
            {
                var qtyToRevert = grp.Sum(x => x.Quantity);
                var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, grp.Key, ct);
                if (price.StockQty < qtyToRevert)
                {
                    return BadRequest(new
                    {
                        message = $"Nedovoljna zaliha za storniranje dokumenta (stanje: {price.StockQty:0.##})."
                    });
                }
            }
        }

        foreach (var line in doc.Lines)
        {
            var price = await GetOrCreateStorePriceCachedAsync(priceCache, tid, doc.StoreId, line.ItemId, ct);
            price.StockQty += isOutgoing ? line.Quantity : -line.Quantity;
            price.UpdatedAtUtc = DateTime.UtcNow;
        }

        doc.Status = DocumentStatus.Canceled;

        var desc = string.IsNullOrWhiteSpace(reason)
            ? $"Storno skladišnog dokumenta {doc.DocumentNumber}"
            : $"Storno skladišnog dokumenta {doc.DocumentNumber}: {reason}";

        await _kepWriter.AppendEntryAsync(
            tid,
            doc.StoreId,
            doc.FiscalYearId,
            doc.DocumentDate,
            $"OTHER_{doc.Subtype.ToString().ToUpperInvariant()}_REVERSAL",
            doc.Id,
            $"ST-{doc.DocumentNumber}",
            desc,
            isOutgoing ? LedgerDirection.Debit : LedgerDirection.Credit,
            doc.TotalRetailValue2,
            ct);

        AddAuditLog(
            tid,
            "REVERSE",
            nameof(OtherWarehouseDocument),
            doc.Id,
            doc.DocumentNumber,
            desc,
            "POSTED",
            "REVERSED",
            reason);

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpDelete("other-documents/{id:guid}")]
    [Authorize(Roles = WarehouseWriteRoles)]
    public async Task<IActionResult> DeleteOtherDocument(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = await _db.OtherWarehouseDocuments
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound(new { message = "Skladišni dokument nije pronađen." });
        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new { message = "Samo dokumenti u statusu Nacrt se mogu obrisati." });

        _db.OtherWarehouseDocumentLines.RemoveRange(doc.Lines);
        _db.OtherWarehouseDocuments.Remove(doc);

        AddAuditLog(
            tid,
            "DELETE_DRAFT",
            nameof(OtherWarehouseDocument),
            doc.Id,
            doc.DocumentNumber,
            $"Obrisan nacrt skladišnog dokumenta {doc.DocumentNumber}",
            "DRAFT",
            "DELETED");

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
