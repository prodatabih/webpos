namespace WebPos.WebApi.Contracts;

public sealed record CreateCalculationLineRequest(
    Guid ItemId,
    decimal Quantity,
    decimal InvoicePriceExclVat4,
    decimal DiscountPct,
    decimal DependentCostPct,
    decimal MarginPct,
    decimal VatRatePercent);

public sealed record CreateCalculationRequest(
    Guid StoreId,
    Guid SupplierId,
    Guid FiscalYearId,
    string DocumentNumber,
    DateTime DocumentDate,
    string? InvoiceNumber,
    DateTime? InvoiceDate,
    string? OrderNumber,
    string? DeliveryNoteNumber,
    string? Note,
    List<CreateCalculationLineRequest> Lines);

public sealed record CreatePriceLevelingLineRequest(
    Guid ItemId,
    decimal NewRetailPriceInclVat2);

public sealed record CreatePriceLevelingRequest(
    Guid StoreId,
    Guid FiscalYearId,
    string DocumentNumber,
    DateTime DocumentDate,
    string? Reason,
    List<CreatePriceLevelingLineRequest> Lines);

public sealed record CreateTransferLineRequest(
    Guid ItemId,
    decimal Quantity);

public sealed record CreateTransferRequest(
    Guid SourceStoreId,
    Guid TargetStoreId,
    Guid FiscalYearId,
    string DocumentNumber,
    DateTime DocumentDate,
    string? Note,
    List<CreateTransferLineRequest> Lines);

public sealed record CreateInventoryCountLineRequest(
    Guid ItemId,
    decimal CountedQty,
    decimal ApprovedShrinkageQty,
    decimal VatRatePercent);

public sealed record CreateInventoryCountRequest(
    Guid StoreId,
    Guid FiscalYearId,
    string DocumentNumber,
    DateTime CountDate,
    string? Note,
    List<CreateInventoryCountLineRequest> Lines);
