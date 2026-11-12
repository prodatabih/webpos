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

    public Store? Store { get; set; }
    public Item? Item { get; set; }
}

public class Partner
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Jib { get; set; }
    public string? Pib { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public bool IsSupplier { get; set; }
    public bool IsCustomer { get; set; }
    public decimal DefaultDiscountPct { get; set; }
}
