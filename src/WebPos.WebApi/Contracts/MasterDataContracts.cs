using WebPos.Domain.Enums;

namespace WebPos.WebApi.Contracts;

public sealed record UpsertItemBarcodeRequest(
    string Barcode,
    bool IsPrimary = false,
    string? Uom = "kom",
    decimal PackMultiplier = 1m,
    string? Description = null,
    Guid? Id = null);

public sealed record UpsertItemBomLineRequest(
    Guid ComponentItemId,
    decimal Quantity,
    decimal WastePercent = 0m,
    Guid? SourceStoreId = null,
    Guid? Id = null);

public sealed record UpsertStoreItemPriceRequest(
    Guid StoreId,
    Guid ItemId = default,
    decimal? PurchasePriceExclVat4 = null,
    decimal? WholesalePriceExclVat4 = null,
    decimal? RetailPriceInclVat2 = null,
    decimal? MinStockQty = null,
    string? ShelfLocation = null,
    bool? NeedsLabelPrint = null);

public sealed record UpsertItemRequest(
    Guid CompanyId,
    string Sku,
    string? PrimaryBarcode,
    string Name,
    string? ShortName,
    string? CategoryName,
    string? CategoryPrefix,
    string Uom,
    Guid VatRateId,
    ItemType ItemType,
    bool IsWeighable,
    bool IsActive,
    Guid? StoreId = null,
    decimal? PurchasePriceExclVat4 = null,
    decimal? WholesalePriceExclVat4 = null,
    decimal? RetailPriceInclVat2 = null,
    decimal? NetContentQty = null,
    string? NetContentUom = null,
    string? CountryOfOrigin = null,
    string? NormativeMode = null,
    List<UpsertItemBarcodeRequest>? Barcodes = null,
    List<UpsertItemBomLineRequest>? BomLines = null,
    List<UpsertStoreItemPriceRequest>? StorePrices = null,
    Guid? Id = null);

public sealed record UpsertPartnerRequest(
    string Code,
    string Name,
    string? Jib,
    string? Pib,
    string? Address,
    string? City,
    bool IsSupplier,
    bool IsCustomer,
    decimal DefaultDiscountPct,
    Guid? CompanyId = null,
    string? Phone = null,
    string? Email = null,
    int PaymentTermsDays = 30,
    decimal CreditLimit = 0m,
    bool IsActive = true,
    Guid? Id = null);

public sealed record ClearLabelsRequest(
    Guid StoreId,
    List<Guid> ItemIds);

public sealed record UpsertLabelTemplateRequest(
    string Name,
    decimal WidthMm,
    decimal HeightMm,
    decimal FontScale = 1m,
    bool ShowBarcode = true,
    bool ShowUnitPrice = true,
    bool ShowOrigin = true,
    bool ShowSku = true,
    bool IsDefault = false,
    Guid? Id = null);
