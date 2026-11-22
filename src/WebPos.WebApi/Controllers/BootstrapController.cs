using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;
using WebPos.Domain.Enums;

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

    private static string F2(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);
    private static string F4(decimal value) => value.ToString("0.0000", CultureInfo.InvariantCulture);

    private static string MapDocStatus(DocumentStatus status) => status switch
    {
        DocumentStatus.Posted => "POSTED",
        DocumentStatus.Canceled => "REVERSED",
        _ => "DRAFT"
    };

    private static string MapStoreType(StoreType type) => type switch
    {
        StoreType.Wholesale => "WHOLESALE",
        StoreType.RawMaterial => "RAW_MATERIAL",
        StoreType.Production => "PRODUCTION",
        _ => "RETAIL"
    };

    private static string MapItemType(ItemType type) => type switch
    {
        ItemType.Service => "SERVICE",
        ItemType.Manufactured => "COMPOSITE",
        ItemType.RawMaterial => "RAW_MATERIAL",
        _ => "GOODS"
    };

    private static string MapPaymentMethod(PaymentMethod method) => method switch
    {
        PaymentMethod.Card => "CARD",
        PaymentMethod.BankTransfer => "WIRE",
        PaymentMethod.Mixed => "COMBINED",
        _ => "CASH"
    };

    private static string MapOtherSubtype(OtherWarehouseDocSubtype subtype) => subtype switch
    {
        OtherWarehouseDocSubtype.WriteoffKalorastur => "WRITEOFF_KALORASTUR",
        OtherWarehouseDocSubtype.InternalIssue => "INTERNAL_ISSUE",
        OtherWarehouseDocSubtype.InternalReceipt => "INTERNAL_RECEIPT",
        OtherWarehouseDocSubtype.SupplierReturn => "SUPPLIER_RETURN",
        OtherWarehouseDocSubtype.InternalProduction => "INTERNAL_PRODUCTION",
        _ => "WRITEOFF_KALORASTUR"
    };

    private static (string? EntityCode, string? Summary, string? PreviousState, string? NewState) ParseAuditDetails(string? detailsJson)
    {
        if (string.IsNullOrWhiteSpace(detailsJson))
        {
            return (null, null, null, null);
        }

        try
        {
            using var doc = JsonDocument.Parse(detailsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return (null, detailsJson, null, null);
            }

            static string? ReadString(JsonElement root, string name) =>
                root.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String
                    ? prop.GetString()
                    : null;

            return (
                ReadString(doc.RootElement, "entityCode"),
                ReadString(doc.RootElement, "summary"),
                ReadString(doc.RootElement, "previousState"),
                ReadString(doc.RootElement, "newState")
            );
        }
        catch (JsonException)
        {
            return (null, detailsJson, null, null);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetBootstrap([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId))
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
                systemConfig = new
                {
                    allowPriceChangeWithoutLeveling = false,
                    allowNegativeStock = false,
                    autoCreatePriceLevelingOnInbound = true,
                    defaultCurrency = "BAM"
                },
                labelTemplates = Array.Empty<object>()
            });
        }

        var companiesRaw = await _db.Companies.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var defaultCompanyId = companiesRaw.FirstOrDefault()?.Id ?? Guid.Empty;

        var fiscalYearsRaw = await _db.FiscalYears.AsNoTracking()
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.Year)
            .ToListAsync(ct);
        var defaultFiscalYearId = fiscalYearsRaw.FirstOrDefault()?.Id ?? Guid.Empty;

        var fiscalPeriodsRaw = await _db.FiscalPeriods.AsNoTracking()
            .Where(x => x.TenantId == tid)
            .OrderBy(x => x.FiscalYearId)
            .ThenBy(x => x.Month)
            .ToListAsync(ct);

        var storesRaw = await _db.Stores.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storeCompanyMap = storesRaw.ToDictionary(s => s.Id, s => s.CompanyId);

        var registersRaw = await _db.CashRegisters.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var vatRatesRaw = await _db.VatRates.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var vatRateMap = vatRatesRaw.ToDictionary(v => v.Id, v => v.RatePercent);

        var partnersRaw = await _db.Partners.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var itemsRaw = await _db.Items.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var itemMap = itemsRaw.ToDictionary(i => i.Id);

        var barcodesRaw = await _db.ItemBarcodes.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var bomLinesRaw = await _db.ItemBomLines.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storePricesRaw = await _db.StoreItemPrices.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storePriceMap = storePricesRaw
            .GroupBy(p => (p.StoreId, p.ItemId))
            .ToDictionary(g => g.Key, g => g.First());

        var calculationsRaw = await _db.InboundCalculations.AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.DocumentDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        var levelingsRaw = await _db.PriceLevelings.AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.DocumentDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        var transfersRaw = await _db.WarehouseTransfers.AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.DocumentDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        var inventoryCountsRaw = await _db.InventoryCounts.AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.CountDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        var otherDocsRaw = await _db.OtherWarehouseDocuments.AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.DocumentDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(ct);

        var posReceiptsRaw = await _db.PosReceipts.AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.Payments)
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.IssuedAtUtc)
            .ToListAsync(ct);
        var receiptFiscalMap = posReceiptsRaw.ToDictionary(r => r.Id, r => r.FiscalReceiptNumber ?? string.Empty);

        var kepRaw = await _db.KepLedgerEntries.AsNoTracking()
            .Where(x => x.TenantId == tid)
            .OrderBy(x => x.StoreId)
            .ThenBy(x => x.EntryNumber)
            .ToListAsync(ct);

        var auditRaw = await _db.AuditLogEntries.AsNoTracking()
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.OccurredAtUtc)
            .Take(200)
            .ToListAsync(ct);

        var tenantSetting = await _db.TenantSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tid, ct);

        var labelTemplatesRaw = await _db.LabelTemplates.AsNoTracking()
            .Where(x => x.TenantId == tid)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name)
            .ToListAsync(ct);

        var usersMap = await _db.Users.AsNoTracking()
            .Where(u => u.TenantId == tid)
            .ToDictionaryAsync(u => u.Id, u => u.Username, ct);

        Guid CompanyForStore(Guid storeId) =>
            storeCompanyMap.TryGetValue(storeId, out var cid) ? cid : defaultCompanyId;

        decimal VatRateForItem(Guid itemId) =>
            itemMap.TryGetValue(itemId, out var it) && vatRateMap.TryGetValue(it.VatRateId, out var rate)
                ? rate
                : 17m;

        decimal PurchasePriceFor(Guid storeId, Guid itemId) =>
            storePriceMap.TryGetValue((storeId, itemId), out var sp) ? sp.PurchasePriceExclVat4 : 0m;

        string BarcodeForItem(Guid itemId) =>
            itemMap.TryGetValue(itemId, out var it) ? (it.PrimaryBarcode ?? string.Empty) : string.Empty;

        string ResolveUserName(Guid? userId) =>
            userId.HasValue && usersMap.TryGetValue(userId.Value, out var uname) ? uname : string.Empty;

        return Ok(new
        {
            // 1. Companies
            companies = companiesRaw.Select(c => new
            {
                id = c.Id,
                code = string.IsNullOrWhiteSpace(c.Code) ? c.Jib : c.Code,
                name = c.Name,
                taxIdNumber = c.Jib,
                vatIdNumber = c.PdvNumber ?? string.Empty,
                address = c.Address,
                city = c.City,
                currencyCode = string.IsNullOrWhiteSpace(c.CurrencyCode) ? "BAM" : c.CurrencyCode,
                bankAccount = c.BankAccount ?? string.Empty
            }),

            // 2. Fiscal Years
            fiscalYears = fiscalYearsRaw.Select(fy => new
            {
                id = fy.Id,
                companyId = fy.CompanyId,
                year = fy.Year,
                startDate = $"{fy.Year}-01-01",
                endDate = $"{fy.Year}-12-31",
                isLocked = fy.IsClosed
            }),

            // 3. Fiscal Periods
            fiscalPeriods = fiscalPeriodsRaw.Select(fp => new
            {
                id = fp.Id,
                companyId = fp.CompanyId,
                fiscalYearId = fp.FiscalYearId,
                month = fp.Month,
                name = fp.Name,
                startDate = fp.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                endDate = fp.EndDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                isLocked = fp.IsLocked,
                lockedAt = fp.LockedAtUtc?.ToString("O"),
                lockedBy = fp.LockedBy
            }),

            // 4. Store Locations
            storeLocations = storesRaw.Select(s => new
            {
                id = s.Id,
                companyId = s.CompanyId,
                code = s.Code,
                name = s.Name,
                storeType = MapStoreType(s.StoreType),
                address = s.Address,
                city = s.City,
                isActive = s.IsActive
            }),

            // 5. POS Terminals
            posTerminals = registersRaw.Select(r => new
            {
                id = r.Id,
                storeId = r.StoreId,
                code = r.Code,
                name = r.Name,
                fiscalPrefix = r.FiscalDeviceId ?? string.Empty,
                lastSequenceNumber = r.LastSequenceNumber,
                isOnline = r.IsOnline,
                isActive = r.IsActive
            }),

            // 6. VAT Rates
            vatRates = vatRatesRaw.Select(v => new
            {
                id = v.Id,
                companyId = v.CompanyId ?? defaultCompanyId,
                code = v.Code,
                name = v.Name,
                ratePercent = F2(v.RatePercent),
                validFrom = string.IsNullOrWhiteSpace(v.ValidFrom) ? "2026-01-01" : v.ValidFrom,
                isActive = v.IsActive
            }),

            // 7. Partners
            partners = partnersRaw.Select(p => new
            {
                id = p.Id,
                companyId = p.CompanyId ?? defaultCompanyId,
                code = p.Code,
                name = p.Name,
                partnerType = (p.IsSupplier && p.IsCustomer)
                    ? "BOTH"
                    : (p.IsSupplier ? "SUPPLIER" : "BUYER"),
                taxIdNumber = p.Jib ?? string.Empty,
                vatIdNumber = p.Pib ?? string.Empty,
                address = p.Address ?? string.Empty,
                city = p.City ?? string.Empty,
                phone = p.Phone ?? string.Empty,
                email = p.Email ?? string.Empty,
                paymentTermsDays = p.PaymentTermsDays,
                creditLimit = F2(p.CreditLimit),
                discountPercent = F2(p.DefaultDiscountPct),
                isActive = p.IsActive
            }),

            // 8. Items
            items = itemsRaw.Select(i => new
            {
                id = i.Id,
                companyId = i.CompanyId,
                sku = i.Sku,
                primaryBarcode = i.PrimaryBarcode ?? string.Empty,
                name = i.Name,
                shortName = i.ShortName ?? i.Name,
                itemType = MapItemType(i.ItemType),
                normativeMode = string.IsNullOrWhiteSpace(i.NormativeMode)
                    ? (i.ItemType == ItemType.Manufactured ? "ON_SALE_BACKFLUSH" : "NONE")
                    : i.NormativeMode,
                uom = i.Uom,
                netContentQty = F4(i.NetContentQty),
                netContentUom = string.IsNullOrWhiteSpace(i.NetContentUom) ? "kg" : i.NetContentUom,
                vatRateId = i.VatRateId,
                categoryName = i.CategoryName ?? string.Empty,
                countryOfOrigin = string.IsNullOrWhiteSpace(i.CountryOfOrigin) ? "Bosna i Hercegovina" : i.CountryOfOrigin,
                isWeighable = i.IsWeighable,
                isActive = i.IsActive,
                categoryPrefix = i.CategoryPrefix
            }),

            // 9. Item Barcodes
            itemBarcodes = barcodesRaw.Select(b => new
            {
                id = b.Id,
                itemId = b.ItemId,
                barcode = b.Barcode,
                uom = string.IsNullOrWhiteSpace(b.Uom) ? "kom" : b.Uom,
                packMultiplier = F4(b.PackMultiplier),
                description = b.Description ?? string.Empty
            }),

            // 10. Item BOM Lines
            itemBomLines = bomLinesRaw.Select(b => new
            {
                id = b.Id,
                parentItemId = b.ParentItemId,
                componentItemId = b.ComponentItemId,
                sourceStoreId = b.SourceStoreId,
                quantity = F4(b.Quantity),
                wastePercent = F2(b.WastePercent)
            }),

            // 11. Store Item Prices
            storeItemPrices = storePricesRaw.Select(p => new
            {
                id = p.Id,
                storeId = p.StoreId,
                itemId = p.ItemId,
                purchaseUnitPrice = F4(p.PurchasePriceExclVat4),
                wholesaleUnitPriceExclVat = F4(p.WholesalePriceExclVat4),
                retailUnitPriceWithVat = F2(p.RetailPriceInclVat2),
                currentStockQty = F4(p.StockQty),
                minStockQty = F4(p.MinStockQty),
                shelfLocation = string.IsNullOrWhiteSpace(p.ShelfLocation) ? "A-01-01" : p.ShelfLocation,
                needsLabelPrint = p.NeedsLabelPrint,
                updatedAt = p.UpdatedAtUtc.ToString("O")
            }),

            // 12. Inbound Calculations
            calculations = calculationsRaw.Select(d =>
            {
                var totalSellingExclVat = CalculationMath.Round2(d.TotalRetailInclVat - d.TotalVatAmount);
                var totalMargin = CalculationMath.Round2(totalSellingExclVat - d.TotalPurchaseExclVat);
                return new
                {
                    id = d.Id,
                    companyId = CompanyForStore(d.StoreId),
                    fiscalYearId = d.FiscalYearId,
                    storeId = d.StoreId,
                    docNumber = d.DocumentNumber,
                    docDate = d.DocumentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    postingDate = d.PostedAtUtc?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    partnerId = d.SupplierId,
                    supplierInvoiceNumber = d.InvoiceNumber ?? string.Empty,
                    supplierInvoiceDate = (d.InvoiceDate ?? d.DocumentDate).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    orderNumber = d.OrderNumber ?? string.Empty,
                    deliveryNoteNumber = d.DeliveryNoteNumber ?? string.Empty,
                    status = MapDocStatus(d.Status),
                    notes = d.Note ?? string.Empty,
                    lines = d.Lines.OrderBy(l => l.LineNumber).Select(l =>
                    {
                        var netSupplier4 = CalculationMath.Round4(l.InvoicePriceExclVat4 - l.DiscountAmount4);
                        var marginUnit4 = CalculationMath.Round4(l.WholesalePriceExclVat4 - l.PurchasePriceExclVat4);
                        var marginTotal2 = CalculationMath.Round2(marginUnit4 * l.Quantity);
                        var sellingTotalExcl2 = CalculationMath.Round2(l.LineTotalRetail2 - l.LineVatAmount2);
                        var embeddedVatUnit4 = l.Quantity != 0m
                            ? CalculationMath.Round4(l.LineVatAmount2 / l.Quantity)
                            : 0m;
                        return new
                        {
                            id = l.Id,
                            itemId = l.ItemId,
                            quantity = F4(l.Quantity),
                            supplierUnitPrice = F4(l.InvoicePriceExclVat4),
                            discountPercent = F2(l.DiscountPct),
                            netSupplierUnitPrice = F4(netSupplier4),
                            dependentCostPerUnit = F4(l.DependentCostAmount4),
                            purchaseUnitPrice = F4(l.PurchasePriceExclVat4),
                            purchaseTotalValue = F2(CalculationMath.Round2(l.LineTotalPurchase4)),
                            marginPercent = F2(l.MarginPct),
                            marginUnitAmount = F4(marginUnit4),
                            marginTotalAmount = F2(marginTotal2),
                            sellingUnitPriceExclVat = F4(l.WholesalePriceExclVat4),
                            sellingTotalValueExclVat = F2(sellingTotalExcl2),
                            vatRatePercent = F2(l.VatRatePercent),
                            embeddedVatUnitAmount = F4(embeddedVatUnit4),
                            embeddedVatTotalAmount = F2(l.LineVatAmount2),
                            retailUnitPriceWithVat = F2(l.RetailPriceInclVat2),
                            retailTotalValueWithVat = F2(l.LineTotalRetail2)
                        };
                    }),
                    totalPurchaseValue = F2(d.TotalPurchaseExclVat),
                    totalMarginAmount = F2(totalMargin),
                    totalSellingValueExclVat = F2(totalSellingExclVat),
                    totalEmbeddedVatAmount = F2(d.TotalVatAmount),
                    totalRetailValueWithVat = F2(d.TotalRetailInclVat),
                    createdBy = ResolveUserName(d.CreatedByUserId),
                    createdAt = d.CreatedAtUtc.ToString("O")
                };
            }),

            // 13. Price Levelings
            priceLevelings = levelingsRaw.Select(d => new
            {
                id = d.Id,
                companyId = CompanyForStore(d.StoreId),
                fiscalYearId = d.FiscalYearId,
                storeId = d.StoreId,
                docNumber = d.DocumentNumber,
                docDate = d.DocumentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                postingDate = d.PostedAtUtc?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                status = MapDocStatus(d.Status),
                reason = d.Reason ?? string.Empty,
                lines = d.Lines.OrderBy(l => l.LineNumber).Select(l =>
                {
                    var oldTotal = CalculationMath.Round2(l.OldRetailPriceInclVat2 * l.StockQty);
                    var newTotal = CalculationMath.Round2(l.NewRetailPriceInclVat2 * l.StockQty);
                    return new
                    {
                        id = l.Id,
                        itemId = l.ItemId,
                        stockQuantity = F4(l.StockQty),
                        oldRetailPriceWithVat = F2(l.OldRetailPriceInclVat2),
                        newRetailPriceWithVat = F2(l.NewRetailPriceInclVat2),
                        vatRatePercent = F2(l.VatRatePercent),
                        oldTotalRetailValue = F2(oldTotal),
                        newTotalRetailValue = F2(newTotal),
                        totalRetailDifference = F2(l.TotalDifference2),
                        embeddedVatDifference = F2(l.VatDifference2),
                        marginDifference = F2(l.MarginDifference2)
                    };
                }),
                totalRetailDifference = F2(d.TotalDifferenceAmount2),
                totalVatDifference = F2(d.TotalVatDifference2),
                totalMarginDifference = F2(d.TotalMarginDifference2),
                createdBy = ResolveUserName(d.CreatedByUserId),
                createdAt = d.CreatedAtUtc.ToString("O")
            }),

            // 14. Warehouse Transfers
            transfers = transfersRaw.Select(d =>
            {
                var totalPurchase = CalculationMath.Round2(
                    d.Lines.Sum(l => CalculationMath.Round2(l.PurchasePriceExclVat4 * l.Quantity)));
                return new
                {
                    id = d.Id,
                    companyId = CompanyForStore(d.SourceStoreId),
                    fiscalYearId = d.FiscalYearId,
                    sourceStoreId = d.SourceStoreId,
                    targetStoreId = d.TargetStoreId,
                    docNumber = d.DocumentNumber,
                    docDate = d.DocumentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    postingDate = d.PostedAtUtc?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    status = MapDocStatus(d.Status),
                    notes = d.Note ?? string.Empty,
                    lines = d.Lines.OrderBy(l => l.LineNumber).Select(l => new
                    {
                        id = l.Id,
                        itemId = l.ItemId,
                        quantity = F4(l.Quantity),
                        purchaseUnitPrice = F4(l.PurchasePriceExclVat4),
                        purchaseTotalValue = F2(CalculationMath.Round2(l.PurchasePriceExclVat4 * l.Quantity)),
                        sourceRetailUnitPrice = F2(l.RetailPriceInclVat2),
                        sourceRetailTotalValue = F2(l.LineTotal2),
                        targetRetailUnitPrice = F2(l.RetailPriceInclVat2),
                        targetRetailTotalValue = F2(l.LineTotal2),
                        vatRatePercent = F2(VatRateForItem(l.ItemId))
                    }),
                    totalPurchaseValue = F2(totalPurchase),
                    totalSourceRetailValue = F2(d.TotalValue2),
                    totalTargetRetailValue = F2(d.TotalValue2),
                    createdBy = ResolveUserName(d.CreatedByUserId),
                    createdAt = d.CreatedAtUtc.ToString("O")
                };
            }),

            // 15. Inventory Counts
            inventoryCounts = inventoryCountsRaw.Select(d =>
            {
                decimal totalSurplus = 0m;
                decimal totalShortage = 0m;
                decimal totalAllowedWaste = 0m;
                decimal totalUnrecognized = 0m;

                var mappedLines = d.Lines.OrderBy(l => l.LineNumber).Select(l =>
                {
                    var surplusRetail = l.DifferenceQty > 0m
                        ? CalculationMath.Round2(l.DifferenceQty * l.RetailPriceInclVat2)
                        : 0m;
                    var shortageRetail = l.DifferenceQty < 0m
                        ? CalculationMath.Round2(Math.Abs(l.DifferenceQty) * l.RetailPriceInclVat2)
                        : 0m;
                    var allowedWasteRetail = CalculationMath.Round2(l.ApprovedShrinkageQty * l.RetailPriceInclVat2);
                    var unrecognizedRetail = CalculationMath.Round2(l.UnapprovedShortageQty * l.RetailPriceInclVat2);

                    totalSurplus += surplusRetail;
                    totalShortage += shortageRetail;
                    totalAllowedWaste += allowedWasteRetail;
                    totalUnrecognized += unrecognizedRetail;

                    return new
                    {
                        id = l.Id,
                        itemId = l.ItemId,
                        bookQuantity = F4(l.BookQty),
                        countedQuantity = F4(l.CountedQty),
                        differenceQuantity = F4(l.DifferenceQty),
                        purchaseUnitPrice = F4(PurchasePriceFor(d.StoreId, l.ItemId)),
                        retailUnitPriceWithVat = F2(l.RetailPriceInclVat2),
                        vatRatePercent = F2(l.VatRatePercent),
                        surplusRetailValue = F2(surplusRetail),
                        shortageRetailValue = F2(shortageRetail),
                        allowedWasteQuantity = F4(l.ApprovedShrinkageQty),
                        allowedWasteRetailValue = F2(allowedWasteRetail),
                        unrecognizedShortageQuantity = F4(l.UnapprovedShortageQty),
                        unrecognizedShortageRetailValue = F2(unrecognizedRetail),
                        unrecognizedShortageVat = F2(l.ShortageVatAmount)
                    };
                }).ToList();

                return new
                {
                    id = d.Id,
                    companyId = CompanyForStore(d.StoreId),
                    fiscalYearId = d.FiscalYearId,
                    storeId = d.StoreId,
                    docNumber = d.DocumentNumber,
                    docDate = d.CountDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    postingDate = d.PostedAtUtc?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    status = MapDocStatus(d.Status),
                    commissionMembers = string.Empty,
                    notes = d.Note ?? string.Empty,
                    lines = mappedLines,
                    totalSurplusRetailValue = F2(CalculationMath.Round2(totalSurplus)),
                    totalShortageRetailValue = F2(CalculationMath.Round2(totalShortage)),
                    totalAllowedWasteValue = F2(CalculationMath.Round2(totalAllowedWaste)),
                    totalUnrecognizedShortageValue = F2(CalculationMath.Round2(totalUnrecognized)),
                    totalUnrecognizedShortageVat = F2(d.TotalShortageVatAmount2),
                    createdBy = ResolveUserName(d.CreatedByUserId),
                    createdAt = d.CreatedAtUtc.ToString("O")
                };
            }),

            // 16. Other Warehouse Documents
            otherWarehouseDocs = otherDocsRaw.Select(d => new
            {
                id = d.Id,
                companyId = CompanyForStore(d.StoreId),
                fiscalYearId = d.FiscalYearId,
                storeId = d.StoreId,
                docNumber = d.DocumentNumber,
                docDate = d.DocumentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                postingDate = d.PostedAtUtc?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                subtype = MapOtherSubtype(d.Subtype),
                status = MapDocStatus(d.Status),
                notes = d.Note ?? string.Empty,
                lines = d.Lines.OrderBy(l => l.LineNumber).Select(l => new
                {
                    id = l.Id,
                    itemId = l.ItemId,
                    quantity = F4(l.Quantity),
                    purchaseUnitPrice = F4(l.PurchasePriceExclVat4),
                    purchaseTotalValue = F2(l.LinePurchaseTotal2),
                    retailUnitPriceWithVat = F2(l.RetailPriceInclVat2),
                    retailTotalValueWithVat = F2(l.LineRetailTotal2),
                    vatRatePercent = F2(VatRateForItem(l.ItemId))
                }),
                totalPurchaseValue = F2(d.TotalPurchaseValue2),
                totalRetailValueWithVat = F2(d.TotalRetailValue2),
                createdBy = ResolveUserName(d.CreatedByUserId),
                createdAt = d.CreatedAtUtc.ToString("O")
            }),

            // 17. POS Receipts
            posReceipts = posReceiptsRaw.Select(r =>
            {
                decimal cashAmt = 0m;
                decimal cardAmt = 0m;
                decimal wireAmt = 0m;

                if (r.Payments.Count > 0)
                {
                    foreach (var p in r.Payments)
                    {
                        switch (p.PaymentMethod)
                        {
                            case PaymentMethod.Cash: cashAmt += p.Amount2; break;
                            case PaymentMethod.Card: cardAmt += p.Amount2; break;
                            case PaymentMethod.BankTransfer: wireAmt += p.Amount2; break;
                            default: cashAmt += p.Amount2; break;
                        }
                    }
                }
                else
                {
                    switch (r.PaymentMethod)
                    {
                        case PaymentMethod.Card: cardAmt = r.TotalGrossAmount2; break;
                        case PaymentMethod.BankTransfer: wireAmt = r.TotalGrossAmount2; break;
                        default: cashAmt = r.TotalGrossAmount2; break;
                    }
                }

                var subtotalBeforeDiscount = CalculationMath.Round2(
                    r.Lines.Sum(l => CalculationMath.Round2(l.UnitPriceInclVat2 * l.Quantity)));
                var totalDiscount = CalculationMath.Round2(subtotalBeforeDiscount - r.TotalGrossAmount2);
                var changeAmt = CalculationMath.Round2(Math.Max(0m, (cashAmt + cardAmt + wireAmt) - r.TotalGrossAmount2));

                decimal totalCogs = 0m;
                var mappedLines = r.Lines.OrderBy(l => l.LineNumber).Select(l =>
                {
                    var purchase4 = PurchasePriceFor(r.StoreId, l.ItemId);
                    totalCogs += CalculationMath.Round2(purchase4 * l.Quantity);
                    return new
                    {
                        id = l.Id,
                        itemId = l.ItemId,
                        scannedBarcode = BarcodeForItem(l.ItemId),
                        quantity = F4(l.Quantity),
                        purchaseUnitPrice = F4(purchase4),
                        retailUnitPriceWithVat = F2(l.UnitPriceInclVat2),
                        discountPercent = F2(l.DiscountPct),
                        vatRatePercent = F2(l.VatRatePercent),
                        lineTotalWithVat = F2(l.GrossAmount2),
                        lineNetExclVat = F2(l.NetAmount2),
                        lineVatAmount = F2(l.VatAmount2)
                    };
                }).ToList();

                totalCogs = CalculationMath.Round2(totalCogs);
                var realizedMargin = CalculationMath.Round2(r.TotalNetAmount2 - totalCogs);

                string? refFiscal = null;
                if (r.ReferenceReceiptId.HasValue && receiptFiscalMap.TryGetValue(r.ReferenceReceiptId.Value, out var rf) && !string.IsNullOrEmpty(rf))
                {
                    refFiscal = rf;
                }

                return new
                {
                    id = r.Id,
                    companyId = CompanyForStore(r.StoreId),
                    fiscalYearId = r.FiscalYearId ?? defaultFiscalYearId,
                    storeId = r.StoreId,
                    terminalId = r.CashRegisterId,
                    receiptNumber = r.ReceiptNumber,
                    fiscalNumber = r.FiscalReceiptNumber ?? string.Empty,
                    isFiscalized = r.IsFiscalized || !string.IsNullOrWhiteSpace(r.FiscalReceiptNumber),
                    receiptType = string.IsNullOrWhiteSpace(r.ReceiptType) ? "SALE" : r.ReceiptType.ToUpperInvariant(),
                    referenceReceiptId = r.ReferenceReceiptId,
                    referenceFiscalNumber = refFiscal,
                    partnerId = r.CustomerId,
                    paymentMethod = MapPaymentMethod(r.PaymentMethod),
                    cashReceivedAmount = F2(CalculationMath.Round2(cashAmt)),
                    cardAmount = F2(CalculationMath.Round2(cardAmt)),
                    wireAmount = F2(CalculationMath.Round2(wireAmt)),
                    changeAmount = F2(changeAmt),
                    subtotalGrossBeforeDiscount = F2(subtotalBeforeDiscount),
                    totalDiscountAmount = F2(totalDiscount),
                    totalNetExclVat = F2(r.TotalNetAmount2),
                    totalVatAmount = F2(r.TotalVatAmount2),
                    totalGrossAmount = F2(r.TotalGrossAmount2),
                    totalCostOfGoodsSold = F2(totalCogs),
                    realizedMarginAmount = F2(realizedMargin),
                    lines = mappedLines,
                    payments = r.Payments.Select(p => new
                    {
                        id = p.Id,
                        paymentMethod = MapPaymentMethod(p.PaymentMethod),
                        amount = F2(p.Amount2),
                        referenceNumber = p.ReferenceNumber ?? string.Empty
                    }),
                    cashierName = !string.IsNullOrWhiteSpace(r.CashierName) ? r.CashierName : ResolveUserName(r.CashierUserId),
                    issuedAt = r.IssuedAtUtc.ToString("O"),
                    status = MapDocStatus(r.Status)
                };
            }),

            // 18. KEP Ledger Entries
            kepLedgerEntries = kepRaw.Select(e => new
            {
                id = e.Id,
                companyId = CompanyForStore(e.StoreId),
                fiscalYearId = e.FiscalYearId,
                storeId = e.StoreId,
                entryNumber = e.EntryNumber,
                entryDate = e.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                documentId = e.DocumentId,
                documentNumber = e.DocumentNumber,
                documentType = e.DocumentType,
                description = e.Description,
                debitRetailAmount = F2(e.DebitAmount2),
                creditRetailAmount = F2(e.CreditAmount2),
                runningBalanceAmount = F2(e.BalanceAfter2)
            }),

            // 19. Audit Log
            auditLog = auditRaw.Select(a =>
            {
                var (entityCode, summary, prevState, newState) = ParseAuditDetails(a.DetailsJson);
                return new
                {
                    id = a.Id,
                    timestamp = a.OccurredAtUtc.ToString("O"),
                    userId = a.UserId?.ToString() ?? string.Empty,
                    userName = a.Username ?? "system",
                    entityType = a.EntityName,
                    entityId = a.EntityId ?? string.Empty,
                    entityCode = entityCode ?? a.EntityId ?? string.Empty,
                    action = a.Action,
                    summary = summary ?? $"{a.Action} {a.EntityName}",
                    previousState = prevState,
                    newState = newState
                };
            }),

            // 20. System Config (TenantSettings)
            systemConfig = new
            {
                allowPriceChangeWithoutLeveling = tenantSetting?.AllowPriceChangeWithoutLeveling ?? false,
                allowNegativeStock = tenantSetting?.AllowNegativeStock ?? false,
                autoCreatePriceLevelingOnInbound = tenantSetting?.AutoCreatePriceLevelingOnInbound ?? true,
                defaultCurrency = string.IsNullOrWhiteSpace(tenantSetting?.DefaultCurrency) ? "BAM" : tenantSetting.DefaultCurrency
            },

            // 21. Label Templates
            labelTemplates = labelTemplatesRaw.Select(t => new
            {
                id = t.Id,
                name = t.Name,
                widthMm = t.WidthMm,
                heightMm = t.HeightMm,
                fontScale = t.FontScale,
                showBarcode = t.ShowBarcode,
                showUnitPrice = t.ShowUnitPrice,
                showOrigin = t.ShowOrigin,
                showSku = t.ShowSku,
                isDefault = t.IsDefault
            })
        });
    }
}
