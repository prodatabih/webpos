using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;

namespace WebPos.WebApi.Controllers;

[Route("api/bootstrap")]
[Authorize]
public class BootstrapController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;

    public BootstrapController(IWebPosDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetBootstrap(CancellationToken ct)
    {
        var tenantId = CurrentTenantId;
        if (tenantId is null)
        {
            return Ok(new
            {
                companies = Array.Empty<object>(),
                fiscalYears = Array.Empty<object>(),
                fiscalPeriods = Array.Empty<object>(),
                storeLocations = Array.Empty<object>(),
                posTerminals = Array.Empty<object>(),
                vatRates = Array.Empty<object>(),
                partners = Array.Empty<object>(),
                items = Array.Empty<object>(),
                itemBarcodes = Array.Empty<object>(),
                itemBomLines = Array.Empty<object>(),
                storeItemPrices = Array.Empty<object>(),
                calculations = Array.Empty<object>(),
                priceLevelings = Array.Empty<object>(),
                transfers = Array.Empty<object>(),
                inventoryCounts = Array.Empty<object>(),
                otherWarehouseDocs = Array.Empty<object>(),
                posReceipts = Array.Empty<object>(),
                kepLedgerEntries = Array.Empty<object>(),
                auditLog = Array.Empty<object>(),
            });
        }

        var tid = tenantId.Value;
        var companiesRaw = await _db.Companies.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var defaultCompanyId = companiesRaw.FirstOrDefault()?.Id ?? Guid.Empty;
        var fiscalYearsRaw = await _db.FiscalYears.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var fiscalPeriodsRaw = await _db.FiscalPeriods.AsNoTracking().Where(x => x.TenantId == tid).OrderBy(x => x.Month).ToListAsync(ct);
        var storesRaw = await _db.Stores.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storeCompanyMap = storesRaw.ToDictionary(s => s.Id, s => s.CompanyId);
        var registersRaw = await _db.CashRegisters.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var vatRatesRaw = await _db.VatRates.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var itemsRaw = await _db.Items.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storePricesRaw = await _db.StoreItemPrices.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var levelingsRaw = await _db.PriceLevelings.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).OrderByDescending(x => x.DocumentDate).ToListAsync(ct);

        return Ok(new
        {
            companies = companiesRaw.Select(c => new
            {
                c.Id,
                Code = c.Jib,
                c.Name,
                TaxIdNumber = c.Jib,
                VatIdNumber = c.PdvNumber ?? string.Empty,
                c.Address,
                c.City,
                CurrencyCode = "BAM",
                BankAccount = c.BankAccount ?? string.Empty,
            }),
            fiscalYears = fiscalYearsRaw.Select(fy => new
            {
                fy.Id,
                fy.CompanyId,
                fy.Year,
                StartDate = $"{fy.Year}-01-01",
                EndDate = $"{fy.Year}-12-31",
                IsLocked = fy.IsClosed,
            }),
            fiscalPeriods = fiscalPeriodsRaw.Select(fp => new
            {
                fp.Id,
                fp.CompanyId,
                fp.FiscalYearId,
                fp.Month,
                fp.Name,
                StartDate = fp.StartDate.ToString("yyyy-MM-dd"),
                EndDate = fp.EndDate.ToString("yyyy-MM-dd"),
                fp.IsLocked,
                LockedAt = fp.LockedAtUtc,
                fp.LockedBy,
            }),
            storeLocations = storesRaw.Select(s => new
            {
                s.Id,
                s.CompanyId,
                s.Code,
                s.Name,
                StoreType = s.StoreType switch
                {
                    Domain.Enums.StoreType.Wholesale => "WHOLESALE",
                    Domain.Enums.StoreType.RawMaterial => "RAW_MATERIAL",
                    _ => "RETAIL",
                },
                Address = string.Empty,
                City = string.Empty,
                IsActive = true,
            }),
            posTerminals = registersRaw.Select(r => new
            {
                r.Id,
                r.StoreId,
                r.Code,
                r.Name,
                FiscalPrefix = r.FiscalDeviceId ?? string.Empty,
                LastSequenceNumber = 0,
                IsOnline = true,
                IsActive = true,
            }),
            vatRates = vatRatesRaw.Select(v => new
            {
                v.Id,
                CompanyId = defaultCompanyId,
                v.Code,
                v.Name,
                RatePercent = v.RatePercent.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                ValidFrom = "2026-01-01",
                IsActive = true,
            }),
            partners = await _db.Partners.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            items = itemsRaw.Select(i => new
            {
                i.Id,
                i.CompanyId,
                i.Sku,
                PrimaryBarcode = i.PrimaryBarcode ?? string.Empty,
                i.Name,
                ShortName = i.ShortName ?? i.Name,
                ItemType = i.ItemType switch
                {
                    Domain.Enums.ItemType.Service => "SERVICE",
                    Domain.Enums.ItemType.Manufactured => "COMPOSITE",
                    Domain.Enums.ItemType.RawMaterial => "RAW_MATERIAL",
                    _ => "GOODS",
                },
                NormativeMode = i.ItemType == Domain.Enums.ItemType.Manufactured ? "ON_SALE_BACKFLUSH" : "NONE",
                i.Uom,
                NetContentQty = "1.0000",
                NetContentUom = "kg",
                i.VatRateId,
                CategoryName = i.CategoryName ?? string.Empty,
                CountryOfOrigin = "Bosna i Hercegovina",
                i.IsWeighable,
                i.IsActive,
            }),
            itemBarcodes = await _db.ItemBarcodes.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            itemBomLines = await _db.ItemBomLines.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            storeItemPrices = storePricesRaw.Select(p => new
            {
                p.Id,
                p.StoreId,
                p.ItemId,
                PurchaseUnitPrice = p.PurchasePriceExclVat4.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture),
                WholesaleUnitPriceExclVat = p.WholesalePriceExclVat4.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture),
                RetailUnitPriceWithVat = p.RetailPriceInclVat2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                CurrentStockQty = p.StockQty.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture),
                MinStockQty = "0.0000",
                ShelfLocation = "A-01-01",
                NeedsLabelPrint = false,
                UpdatedAt = DateTime.UtcNow.ToString("O"),
            }),
            calculations = await _db.InboundCalculations.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            priceLevelings = levelingsRaw.Select(d => new
            {
                d.Id,
                CompanyId = storeCompanyMap.TryGetValue(d.StoreId, out var cid) ? cid : defaultCompanyId,
                d.FiscalYearId,
                d.StoreId,
                DocNumber = d.DocumentNumber,
                DocDate = d.DocumentDate.ToString("yyyy-MM-dd"),
                Status = d.Status.ToString().ToUpperInvariant(),
                Reason = d.Reason ?? string.Empty,
                Lines = d.Lines.OrderBy(l => l.LineNumber).Select(l => new
                {
                    l.Id,
                    l.ItemId,
                    StockQuantity = l.StockQty.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture),
                    OldRetailPriceWithVat = l.OldRetailPriceInclVat2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                    NewRetailPriceWithVat = l.NewRetailPriceInclVat2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                    PriceDifference = l.PriceDifference2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                    TotalRetailDifference = l.TotalDifference2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                    VatRatePercent = "17.00",
                    TotalVatDifference = "0.00",
                    TotalMarginDifference = l.TotalDifference2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                }),
                TotalRetailDifference = d.TotalDifferenceAmount2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                TotalVatDifference = "0.00",
                TotalMarginDifference = d.TotalDifferenceAmount2.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                CreatedBy = string.Empty,
                CreatedAt = d.CreatedAtUtc.ToString("O"),
            }),
            transfers = await _db.WarehouseTransfers.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            inventoryCounts = await _db.InventoryCounts.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            otherWarehouseDocs = Array.Empty<object>(),
            posReceipts = await _db.PosReceipts.AsNoTracking().Include(x => x.Lines).Include(x => x.Payments).Where(x => x.TenantId == tid).ToListAsync(ct),
            kepLedgerEntries = await _db.KepLedgerEntries.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            auditLog = await _db.AuditLogEntries.AsNoTracking().Where(x => x.TenantId == tid).OrderByDescending(x => x.OccurredAtUtc).Take(200).ToListAsync(ct),
        });
    }
}
