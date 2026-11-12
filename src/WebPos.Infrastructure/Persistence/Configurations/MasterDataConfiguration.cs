using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebPos.Domain.Entities;

namespace WebPos.Infrastructure.Persistence.Configurations;

public class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Sku).HasMaxLength(64).IsRequired();
        builder.Property(x => x.PrimaryBarcode).HasMaxLength(64);
        builder.Property(x => x.Name).HasMaxLength(250).IsRequired();
        builder.Property(x => x.ShortName).HasMaxLength(100);
        builder.Property(x => x.CategoryName).HasMaxLength(120);
        builder.Property(x => x.CategoryPrefix).HasMaxLength(32);
        builder.Property(x => x.Uom).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ItemType).HasConversion<string>().HasMaxLength(32).IsRequired();

        builder.HasIndex(x => new { x.TenantId, x.Sku }).IsUnique();

        builder.HasOne(x => x.VatRate)
            .WithMany()
            .HasForeignKey(x => x.VatRateId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ItemBarcodeConfiguration : IEntityTypeConfiguration<ItemBarcode>
{
    public void Configure(EntityTypeBuilder<ItemBarcode> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Barcode).HasMaxLength(64).IsRequired();
        builder.HasIndex(x => new { x.TenantId, x.Barcode }).IsUnique();

        builder.HasOne(x => x.Item)
            .WithMany(i => i.Barcodes)
            .HasForeignKey(x => x.ItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ItemBomLineConfiguration : IEntityTypeConfiguration<ItemBomLine>
{
    public void Configure(EntityTypeBuilder<ItemBomLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);

        builder.HasOne(x => x.ParentItem)
            .WithMany(i => i.BomLines)
            .HasForeignKey(x => x.ParentItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.ComponentItem)
            .WithMany()
            .HasForeignKey(x => x.ComponentItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.SourceStore)
            .WithMany()
            .HasForeignKey(x => x.SourceStoreId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class StoreItemPriceConfiguration : IEntityTypeConfiguration<StoreItemPrice>
{
    public void Configure(EntityTypeBuilder<StoreItemPrice> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PurchasePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.WholesalePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.RetailPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.StockQty).HasPrecision(18, 4);

        builder.HasIndex(x => new { x.TenantId, x.StoreId, x.ItemId }).IsUnique();

        builder.HasOne(x => x.Store)
            .WithMany()
            .HasForeignKey(x => x.StoreId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Item)
            .WithMany(i => i.StorePrices)
            .HasForeignKey(x => x.ItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PartnerConfiguration : IEntityTypeConfiguration<Partner>
{
    public void Configure(EntityTypeBuilder<Partner> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(250).IsRequired();
        builder.Property(x => x.Jib).HasMaxLength(32);
        builder.Property(x => x.Pib).HasMaxLength(32);
        builder.Property(x => x.Address).HasMaxLength(250);
        builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.DefaultDiscountPct).HasPrecision(18, 4);

        builder.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}
