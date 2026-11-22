using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebPos.Domain.Entities;

namespace WebPos.Infrastructure.Persistence.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
    }
}

public class TenantSettingConfiguration : IEntityTypeConfiguration<TenantSetting>
{
    public void Configure(EntityTypeBuilder<TenantSetting> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DefaultCurrency).HasMaxLength(16).IsRequired();
        builder.HasIndex(x => x.TenantId).IsUnique();
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Username).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(200).IsRequired();
        builder.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Role).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.PasswordResetToken).HasMaxLength(256);

        builder.HasIndex(x => x.Email).IsUnique();
        builder.HasIndex(x => x.Username).IsUnique();

        builder.HasOne(x => x.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Jib).HasMaxLength(32).IsRequired();
        builder.Property(x => x.PdvNumber).HasMaxLength(32);
        builder.Property(x => x.Address).HasMaxLength(250).IsRequired();
        builder.Property(x => x.City).HasMaxLength(100).IsRequired();
        builder.Property(x => x.BankAccount).HasMaxLength(64);
        builder.Property(x => x.CurrencyCode).HasMaxLength(16).IsRequired();

        builder.HasOne(x => x.Tenant)
            .WithMany(t => t.Companies)
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class StoreConfiguration : IEntityTypeConfiguration<Store>
{
    public void Configure(EntityTypeBuilder<Store> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.StoreType).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(x => x.Address).HasMaxLength(250).IsRequired();
        builder.Property(x => x.City).HasMaxLength(100).IsRequired();

        builder.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();

        builder.HasOne(x => x.Company)
            .WithMany(c => c.Stores)
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CashRegisterConfiguration : IEntityTypeConfiguration<CashRegister>
{
    public void Configure(EntityTypeBuilder<CashRegister> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.FiscalDeviceId).HasMaxLength(100);

        builder.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();

        builder.HasOne(x => x.Store)
            .WithMany(s => s.CashRegisters)
            .HasForeignKey(x => x.StoreId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class FiscalYearConfiguration : IEntityTypeConfiguration<FiscalYear>
{
    public void Configure(EntityTypeBuilder<FiscalYear> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.Year }).IsUnique();

        builder.HasOne(x => x.Company)
            .WithMany(c => c.FiscalYears)
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class FiscalPeriodConfiguration : IEntityTypeConfiguration<FiscalPeriod>
{
    public void Configure(EntityTypeBuilder<FiscalPeriod> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.LockedBy).HasMaxLength(100);

        builder.HasIndex(x => new { x.TenantId, x.FiscalYearId, x.Month }).IsUnique();

        builder.HasOne(x => x.FiscalYear)
            .WithMany(fy => fy.Periods)
            .HasForeignKey(x => x.FiscalYearId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class VatRateConfiguration : IEntityTypeConfiguration<VatRate>
{
    public void Configure(EntityTypeBuilder<VatRate> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.RatePercent).HasPrecision(18, 4);
        builder.Property(x => x.ValidFrom).HasMaxLength(32).IsRequired();

        builder.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}
