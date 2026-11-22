using WebPos.Domain.Enums;

namespace WebPos.Domain.Entities;

public class Item
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string? PrimaryBarcode { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ShortName { get; set; }
    public string? CategoryName { get; set; }
    public string? CategoryPrefix { get; set; }
    public string Uom { get; set; } = "kom";
    public Guid VatRateId { get; set; }
    public ItemType ItemType { get; set; }
    public bool IsWeighable { get; set; }
    public bool IsActive { get; set; } = true;
    public decimal NetContentQty { get; set; } = 1m;
    public string NetContentUom { get; set; } = "kg";
    public string CountryOfOrigin { get; set; } = "Bosna i Hercegovina";
    public string NormativeMode { get; set; } = "NONE";

    public VatRate? VatRate { get; set; }
    public ICollection<ItemBarcode> Barcodes { get; set; } = new List<ItemBarcode>();
    public ICollection<ItemBomLine> BomLines { get; set; } = new List<ItemBomLine>();
    public ICollection<StoreItemPrice> StorePrices { get; set; } = new List<StoreItemPrice>();
}

public class ItemBarcode
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public string Uom { get; set; } = "kom";
    public decimal PackMultiplier { get; set; } = 1m;
    public string? Description { get; set; }

    public Item? Item { get; set; }
}

public class ItemBomLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentItemId { get; set; }
    public Guid ComponentItemId { get; set; }
    public Guid? SourceStoreId { get; set; }
    public decimal Quantity { get; set; }
    public decimal WastePercent { get; set; }

    public Item? ParentItem { get; set; }
    public Item? ComponentItem { get; set; }
    public Store? SourceStore { get; set; }
}

public class StoreItemPrice
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid ItemId { get; set; }
    public decimal PurchasePriceExclVat4 { get; set; }
    public decimal WholesalePriceExclVat4 { get; set; }
    public decimal RetailPriceInclVat2 { get; set; }
    public decimal StockQty { get; set; }
    public decimal MinStockQty { get; set; }
    public string ShelfLocation { get; set; } = "A-01-01";
    public bool NeedsLabelPrint { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public Store? Store { get; set; }
    public Item? Item { get; set; }
}

public class Partner
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Jib { get; set; }
    public string? Pib { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsSupplier { get; set; }
    public bool IsCustomer { get; set; }
    public decimal DefaultDiscountPct { get; set; }
    public int PaymentTermsDays { get; set; } = 30;
    public decimal CreditLimit { get; set; }
    public bool IsActive { get; set; } = true;
}

public class LabelTemplate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal WidthMm { get; set; }
    public decimal HeightMm { get; set; }
    public decimal FontScale { get; set; } = 1m;
    public bool ShowBarcode { get; set; } = true;
    public bool ShowUnitPrice { get; set; } = true;
    public bool ShowOrigin { get; set; } = true;
    public bool ShowSku { get; set; } = true;
    public bool IsDefault { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
