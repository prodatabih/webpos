using WebPos.Domain.Enums;

namespace WebPos.Domain.Entities;

public class InboundCalculation
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid SupplierId { get; set; }
    public Guid FiscalYearId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime DocumentDate { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime? InvoiceDate { get; set; }
    public string? OrderNumber { get; set; }
    public string? DeliveryNoteNumber { get; set; }
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;
    public string? Note { get; set; }
    public decimal TotalPurchaseExclVat { get; set; }
    public decimal TotalDependentCosts { get; set; }
    public decimal TotalRetailInclVat { get; set; }
    public decimal TotalVatAmount { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? PostedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PostedAtUtc { get; set; }

    public Store? Store { get; set; }
    public Partner? Supplier { get; set; }
    public ICollection<InboundCalculationLine> Lines { get; set; } = new List<InboundCalculationLine>();
}

public class InboundCalculationLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid InboundCalculationId { get; set; }
    public int LineNumber { get; set; }
    public Guid ItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal InvoicePriceExclVat4 { get; set; }
    public decimal DiscountPct { get; set; }
    public decimal DiscountAmount4 { get; set; }
    public decimal DependentCostPct { get; set; }
    public decimal DependentCostAmount4 { get; set; }
    public decimal PurchasePriceExclVat4 { get; set; }
    public decimal MarginPct { get; set; }
    public decimal WholesalePriceExclVat4 { get; set; }
    public decimal VatRatePercent { get; set; }
    public decimal RetailPriceInclVat2 { get; set; }
    public decimal LineTotalPurchase4 { get; set; }
    public decimal LineTotalRetail2 { get; set; }
    public decimal LineVatAmount2 { get; set; }

    public InboundCalculation? InboundCalculation { get; set; }
    public Item? Item { get; set; }
}

public class PriceLeveling
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid FiscalYearId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime DocumentDate { get; set; }
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;
    public string? Reason { get; set; }
    public decimal TotalDifferenceAmount2 { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? PostedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PostedAtUtc { get; set; }

    public Store? Store { get; set; }
    public ICollection<PriceLevelingLine> Lines { get; set; } = new List<PriceLevelingLine>();
}

public class PriceLevelingLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PriceLevelingId { get; set; }
    public int LineNumber { get; set; }
    public Guid ItemId { get; set; }
    public decimal StockQty { get; set; }
    public decimal OldRetailPriceInclVat2 { get; set; }
    public decimal NewRetailPriceInclVat2 { get; set; }
    public decimal PriceDifference2 { get; set; }
    public decimal TotalDifference2 { get; set; }

    public PriceLeveling? PriceLeveling { get; set; }
    public Item? Item { get; set; }
}

public class WarehouseTransfer
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SourceStoreId { get; set; }
    public Guid TargetStoreId { get; set; }
    public Guid FiscalYearId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime DocumentDate { get; set; }
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;
    public string? Note { get; set; }
    public decimal TotalValue2 { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? PostedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PostedAtUtc { get; set; }

    public Store? SourceStore { get; set; }
    public Store? TargetStore { get; set; }
    public ICollection<WarehouseTransferLine> Lines { get; set; } = new List<WarehouseTransferLine>();
}

public class WarehouseTransferLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WarehouseTransferId { get; set; }
    public int LineNumber { get; set; }
    public Guid ItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal PurchasePriceExclVat4 { get; set; }
    public decimal RetailPriceInclVat2 { get; set; }
    public decimal LineTotal2 { get; set; }

    public WarehouseTransfer? WarehouseTransfer { get; set; }
    public Item? Item { get; set; }
}

public class InventoryCount
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid FiscalYearId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime CountDate { get; set; }
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;
    public string? Note { get; set; }
    public decimal TotalShortageVatAmount2 { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? PostedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PostedAtUtc { get; set; }

    public Store? Store { get; set; }
    public ICollection<InventoryCountLine> Lines { get; set; } = new List<InventoryCountLine>();
}

public class InventoryCountLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid InventoryCountId { get; set; }
    public int LineNumber { get; set; }
    public Guid ItemId { get; set; }
    public decimal BookQty { get; set; }
    public decimal CountedQty { get; set; }
    public decimal DifferenceQty { get; set; }
    public decimal ApprovedShrinkageQty { get; set; }
    public decimal UnapprovedShortageQty { get; set; }
    public decimal ShortageVatAmount { get; set; }
    public decimal RetailPriceInclVat2 { get; set; }
    public decimal VatRatePercent { get; set; }

    public InventoryCount? InventoryCount { get; set; }
    public Item? Item { get; set; }
}
