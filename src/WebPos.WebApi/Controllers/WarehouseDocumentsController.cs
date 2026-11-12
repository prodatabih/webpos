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
    private readonly IWebPosDbContext _db;
    private readonly KepLedgerWriter _kepWriter;

    public WarehouseDocumentsController(IWebPosDbContext db, KepLedgerWriter kepWriter)
    {
        _db = db;
        _kepWriter = kepWriter;
    }

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
    public async Task<IActionResult> CreateCalculation([FromBody] CreateCalculationRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = new InboundCalculation
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = req.StoreId,
            SupplierId = req.SupplierId,
            FiscalYearId = req.FiscalYearId,
            DocumentNumber = req.DocumentNumber.Trim(),
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

        var lineNo = 1;
        foreach (var l in req.Lines)
        {
            var calc = CalculationMath.CalculateInboundLine(
                l.Quantity,
                l.InvoicePriceExclVat4,
                l.DiscountPct,
                l.DependentCostPct,
                l.MarginPct,
                l.VatRatePercent);

            doc.Lines.Add(new InboundCalculationLine
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
            });
        }

        doc.TotalPurchaseExclVat = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotalPurchase4));
        doc.TotalDependentCosts = CalculationMath.Round2(doc.Lines.Sum(x => x.DependentCostAmount4 * x.Quantity));
        doc.TotalRetailInclVat = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotalRetail2));
        doc.TotalVatAmount = CalculationMath.Round2(doc.Lines.Sum(x => x.LineVatAmount2));

        _db.InboundCalculations.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("calculations/{id:guid}/post")]
    public async Task<IActionResult> PostCalculation(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.InboundCalculations
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound();
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Already posted." });

        foreach (var line in doc.Lines)
        {
            var price = await _kepWriter.GetOrCreateStorePriceAsync(tid, doc.StoreId, line.ItemId, ct);
            price.StockQty += line.Quantity;
            price.PurchasePriceExclVat4 = line.PurchasePriceExclVat4;
            price.WholesalePriceExclVat4 = line.WholesalePriceExclVat4;
            price.RetailPriceInclVat2 = line.RetailPriceInclVat2;
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
            $"Inbound calculation {doc.DocumentNumber}",
            LedgerDirection.Debit,
            doc.TotalRetailInclVat,
            ct);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "POST",
            EntityName = nameof(InboundCalculation),
            EntityId = doc.Id.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

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
    public async Task<IActionResult> CreateLeveling([FromBody] CreatePriceLevelingRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = new PriceLeveling
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = req.StoreId,
            FiscalYearId = req.FiscalYearId,
            DocumentNumber = req.DocumentNumber.Trim(),
            DocumentDate = req.DocumentDate,
            Status = DocumentStatus.Draft,
            Reason = req.Reason?.Trim(),
            CreatedByUserId = CurrentUserId,
            CreatedAtUtc = DateTime.UtcNow
        };

        var lineNo = 1;
        foreach (var l in req.Lines)
        {
            var price = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.StoreId && p.ItemId == l.ItemId, ct);

            var stockQty = price?.StockQty ?? 0m;
            var oldPrice = price?.RetailPriceInclVat2 ?? 0m;
            var newPrice = CalculationMath.Round2(l.NewRetailPriceInclVat2);
            var diffPerUnit = CalculationMath.Round2(newPrice - oldPrice);
            var totalDiff = CalculationMath.Round2(diffPerUnit * stockQty);

            doc.Lines.Add(new PriceLevelingLine
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
                TotalDifference2 = totalDiff
            });
        }

        doc.TotalDifferenceAmount2 = CalculationMath.Round2(doc.Lines.Sum(x => x.TotalDifference2));
        _db.PriceLevelings.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("levelings/{id:guid}/post")]
    public async Task<IActionResult> PostLeveling(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.PriceLevelings
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound();
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Already posted." });

        foreach (var line in doc.Lines)
        {
            var price = await _kepWriter.GetOrCreateStorePriceAsync(tid, doc.StoreId, line.ItemId, ct);
            price.RetailPriceInclVat2 = line.NewRetailPriceInclVat2;
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
            $"Price leveling {doc.DocumentNumber}",
            direction,
            doc.TotalDifferenceAmount2,
            ct);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "POST",
            EntityName = nameof(PriceLeveling),
            EntityId = doc.Id.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

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
    public async Task<IActionResult> CreateTransfer([FromBody] CreateTransferRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = new WarehouseTransfer
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            SourceStoreId = req.SourceStoreId,
            TargetStoreId = req.TargetStoreId,
            FiscalYearId = req.FiscalYearId,
            DocumentNumber = req.DocumentNumber.Trim(),
            DocumentDate = req.DocumentDate,
            Status = DocumentStatus.Draft,
            Note = req.Note?.Trim(),
            CreatedByUserId = CurrentUserId,
            CreatedAtUtc = DateTime.UtcNow
        };

        var lineNo = 1;
        foreach (var l in req.Lines)
        {
            var srcPrice = await _db.StoreItemPrices
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.SourceStoreId && p.ItemId == l.ItemId, ct);

            var purchase4 = srcPrice?.PurchasePriceExclVat4 ?? 0m;
            var retail2 = srcPrice?.RetailPriceInclVat2 ?? 0m;
            var lineTotal2 = CalculationMath.Round2(retail2 * l.Quantity);

            doc.Lines.Add(new WarehouseTransferLine
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
            });
        }

        doc.TotalValue2 = CalculationMath.Round2(doc.Lines.Sum(x => x.LineTotal2));
        _db.WarehouseTransfers.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("transfers/{id:guid}/post")]
    public async Task<IActionResult> PostTransfer(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.WarehouseTransfers
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound();
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Already posted." });

        foreach (var line in doc.Lines)
        {
            var src = await _kepWriter.GetOrCreateStorePriceAsync(tid, doc.SourceStoreId, line.ItemId, ct);
            src.StockQty -= line.Quantity;

            var dst = await _kepWriter.GetOrCreateStorePriceAsync(tid, doc.TargetStoreId, line.ItemId, ct);
            dst.StockQty += line.Quantity;
            if (dst.PurchasePriceExclVat4 == 0m) dst.PurchasePriceExclVat4 = line.PurchasePriceExclVat4;
            if (dst.RetailPriceInclVat2 == 0m) dst.RetailPriceInclVat2 = line.RetailPriceInclVat2;
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
            $"Transfer out {doc.DocumentNumber}",
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
            $"Transfer in {doc.DocumentNumber}",
            LedgerDirection.Debit,
            doc.TotalValue2,
            ct);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "POST",
            EntityName = nameof(WarehouseTransfer),
            EntityId = doc.Id.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

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
    public async Task<IActionResult> CreateInventoryCount([FromBody] CreateInventoryCountRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var doc = new InventoryCount
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = req.StoreId,
            FiscalYearId = req.FiscalYearId,
            DocumentNumber = req.DocumentNumber.Trim(),
            CountDate = req.CountDate,
            Status = DocumentStatus.Draft,
            Note = req.Note?.Trim(),
            CreatedByUserId = CurrentUserId,
            CreatedAtUtc = DateTime.UtcNow
        };

        var lineNo = 1;
        foreach (var l in req.Lines)
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

            doc.Lines.Add(new InventoryCountLine
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
            });
        }

        doc.TotalShortageVatAmount2 = CalculationMath.Round2(doc.Lines.Sum(x => x.ShortageVatAmount));
        _db.InventoryCounts.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }

    [HttpPost("inventory-counts/{id:guid}/post")]
    public async Task<IActionResult> PostInventoryCount(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var doc = await _db.InventoryCounts
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tid, ct);

        if (doc is null) return NotFound();
        if (doc.Status == DocumentStatus.Posted) return BadRequest(new { message = "Already posted." });

        decimal netDiffValue2 = 0m;
        foreach (var line in doc.Lines)
        {
            var price = await _kepWriter.GetOrCreateStorePriceAsync(tid, doc.StoreId, line.ItemId, ct);
            price.StockQty = line.CountedQty;
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
                $"Inventory count {doc.DocumentNumber}",
                dir,
                netDiffValue2,
                ct);
        }

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "POST",
            EntityName = nameof(InventoryCount),
            EntityId = doc.Id.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(doc);
    }
}
