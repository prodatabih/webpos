using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebPos.Domain.Entities;

namespace WebPos.Infrastructure.Persistence.Configurations;

public class InboundCalculationConfiguration : IEntityTypeConfiguration<InboundCalculation>
{
    public void Configure(EntityTypeBuilder<InboundCalculation> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DocumentNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.InvoiceNumber).HasMaxLength(64);
        builder.Property(x => x.OrderNumber).HasMaxLength(64);
        builder.Property(x => x.DeliveryNoteNumber).HasMaxLength(64);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();

        builder.Property(x => x.TotalPurchaseExclVat).HasPrecision(18, 4);
        builder.Property(x => x.TotalDependentCosts).HasPrecision(18, 4);
        builder.Property(x => x.TotalRetailInclVat).HasPrecision(18, 2);
        builder.Property(x => x.TotalVatAmount).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.FiscalYearId, x.DocumentNumber }).IsUnique();

        builder.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class InboundCalculationLineConfiguration : IEntityTypeConfiguration<InboundCalculationLine>
{
    public void Configure(EntityTypeBuilder<InboundCalculationLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.InvoicePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.DiscountPct).HasPrecision(18, 4);
        builder.Property(x => x.DiscountAmount4).HasPrecision(18, 4);
        builder.Property(x => x.DependentCostPct).HasPrecision(18, 4);
        builder.Property(x => x.DependentCostAmount4).HasPrecision(18, 4);
        builder.Property(x => x.PurchasePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.MarginPct).HasPrecision(18, 4);
        builder.Property(x => x.WholesalePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.VatRatePercent).HasPrecision(18, 4);
        builder.Property(x => x.LineTotalPurchase4).HasPrecision(18, 4);
        builder.Property(x => x.RetailPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.LineTotalRetail2).HasPrecision(18, 2);
        builder.Property(x => x.LineVatAmount2).HasPrecision(18, 2);

        builder.HasOne(x => x.InboundCalculation)
            .WithMany(d => d.Lines)
            .HasForeignKey(x => x.InboundCalculationId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PriceLevelingConfiguration : IEntityTypeConfiguration<PriceLeveling>
{
    public void Configure(EntityTypeBuilder<PriceLeveling> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DocumentNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Reason).HasMaxLength(300);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.TotalDifferenceAmount2).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.FiscalYearId, x.DocumentNumber }).IsUnique();
        builder.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PriceLevelingLineConfiguration : IEntityTypeConfiguration<PriceLevelingLine>
{
    public void Configure(EntityTypeBuilder<PriceLevelingLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.StockQty).HasPrecision(18, 4);
        builder.Property(x => x.OldRetailPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.NewRetailPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.PriceDifference2).HasPrecision(18, 2);
        builder.Property(x => x.TotalDifference2).HasPrecision(18, 2);

        builder.HasOne(x => x.PriceLeveling)
            .WithMany(d => d.Lines)
            .HasForeignKey(x => x.PriceLevelingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WarehouseTransferConfiguration : IEntityTypeConfiguration<WarehouseTransfer>
{
    public void Configure(EntityTypeBuilder<WarehouseTransfer> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DocumentNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.TotalValue2).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.FiscalYearId, x.DocumentNumber }).IsUnique();
        builder.HasOne(x => x.SourceStore).WithMany().HasForeignKey(x => x.SourceStoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.TargetStore).WithMany().HasForeignKey(x => x.TargetStoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WarehouseTransferLineConfiguration : IEntityTypeConfiguration<WarehouseTransferLine>
{
    public void Configure(EntityTypeBuilder<WarehouseTransferLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.PurchasePriceExclVat4).HasPrecision(18, 4);
        builder.Property(x => x.RetailPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.LineTotal2).HasPrecision(18, 2);

        builder.HasOne(x => x.WarehouseTransfer)
            .WithMany(d => d.Lines)
            .HasForeignKey(x => x.WarehouseTransferId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class InventoryCountConfiguration : IEntityTypeConfiguration<InventoryCount>
{
    public void Configure(EntityTypeBuilder<InventoryCount> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DocumentNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.TotalShortageVatAmount2).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.FiscalYearId, x.DocumentNumber }).IsUnique();
        builder.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class InventoryCountLineConfiguration : IEntityTypeConfiguration<InventoryCountLine>
{
    public void Configure(EntityTypeBuilder<InventoryCountLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.BookQty).HasPrecision(18, 4);
        builder.Property(x => x.CountedQty).HasPrecision(18, 4);
        builder.Property(x => x.DifferenceQty).HasPrecision(18, 4);
        builder.Property(x => x.ApprovedShrinkageQty).HasPrecision(18, 4);
        builder.Property(x => x.UnapprovedShortageQty).HasPrecision(18, 4);
        builder.Property(x => x.VatRatePercent).HasPrecision(18, 4);
        builder.Property(x => x.ShortageVatAmount).HasPrecision(18, 2);
        builder.Property(x => x.RetailPriceInclVat2).HasPrecision(18, 2);

        builder.HasOne(x => x.InventoryCount)
            .WithMany(d => d.Lines)
            .HasForeignKey(x => x.InventoryCountId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
