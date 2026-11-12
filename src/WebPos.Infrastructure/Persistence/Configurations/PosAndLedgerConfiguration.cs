using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebPos.Domain.Entities;

namespace WebPos.Infrastructure.Persistence.Configurations;

public class PosReceiptConfiguration : IEntityTypeConfiguration<PosReceipt>
{
    public void Configure(EntityTypeBuilder<PosReceipt> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ReceiptNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.FiscalReceiptNumber).HasMaxLength(64);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.PaymentMethod).HasConversion<string>().HasMaxLength(32).IsRequired();

        builder.Property(x => x.TotalNetAmount2).HasPrecision(18, 2);
        builder.Property(x => x.TotalVatAmount2).HasPrecision(18, 2);
        builder.Property(x => x.TotalGrossAmount2).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.StoreId, x.ReceiptNumber }).IsUnique();

        builder.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CashRegister).WithMany().HasForeignKey(x => x.CashRegisterId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PosReceiptLineConfiguration : IEntityTypeConfiguration<PosReceiptLine>
{
    public void Configure(EntityTypeBuilder<PosReceiptLine> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.DiscountPct).HasPrecision(18, 4);
        builder.Property(x => x.VatRatePercent).HasPrecision(18, 4);
        builder.Property(x => x.UnitPriceInclVat2).HasPrecision(18, 2);
        builder.Property(x => x.NetAmount2).HasPrecision(18, 2);
        builder.Property(x => x.VatAmount2).HasPrecision(18, 2);
        builder.Property(x => x.GrossAmount2).HasPrecision(18, 2);

        builder.HasOne(x => x.PosReceipt)
            .WithMany(r => r.Lines)
            .HasForeignKey(x => x.PosReceiptId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PosReceiptPaymentConfiguration : IEntityTypeConfiguration<PosReceiptPayment>
{
    public void Configure(EntityTypeBuilder<PosReceiptPayment> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PaymentMethod).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.Amount2).HasPrecision(18, 2);
        builder.Property(x => x.ReferenceNumber).HasMaxLength(100);

        builder.HasOne(x => x.PosReceipt)
            .WithMany(r => r.Payments)
            .HasForeignKey(x => x.PosReceiptId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class KepLedgerEntryConfiguration : IEntityTypeConfiguration<KepLedgerEntry>
{
    public void Configure(EntityTypeBuilder<KepLedgerEntry> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DocumentType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.DocumentNumber).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Direction).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.DebitAmount2).HasPrecision(18, 2);
        builder.Property(x => x.CreditAmount2).HasPrecision(18, 2);
        builder.Property(x => x.BalanceAfter2).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.TenantId, x.StoreId, x.FiscalYearId, x.EntryNumber }).IsUnique();

        builder.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.FiscalYear).WithMany().HasForeignKey(x => x.FiscalYearId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Username).HasMaxLength(100);
        builder.Property(x => x.Action).HasMaxLength(100).IsRequired();
        builder.Property(x => x.EntityName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.EntityId).HasMaxLength(64);
        builder.Property(x => x.IpAddress).HasMaxLength(64);

        builder.HasIndex(x => new { x.TenantId, x.OccurredAtUtc });
    }
}

public class SyncOutboxMessageConfiguration : IEntityTypeConfiguration<SyncOutboxMessage>
{
    public void Configure(EntityTypeBuilder<SyncOutboxMessage> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.AggregateType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.EventType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.PayloadJson).IsRequired();
        builder.Property(x => x.LastError).HasMaxLength(1000);

        builder.HasIndex(x => new { x.ProcessedAtUtc, x.CreatedAtUtc });
    }
}
