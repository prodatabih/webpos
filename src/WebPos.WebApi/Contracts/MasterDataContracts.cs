using WebPos.Domain.Enums;

namespace WebPos.WebApi.Contracts;

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
    decimal? RetailPriceInclVat2 = null);

public sealed record UpsertPartnerRequest(
    string Code,
    string Name,
    string? Jib,
    string? Pib,
    string? Address,
    string? City,
    bool IsSupplier,
    bool IsCustomer,
    decimal DefaultDiscountPct);
