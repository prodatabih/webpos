using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.Infrastructure.Persistence;

public static class ProductionDbSeeder
{
    public static async Task SeedAsync(
        WebPosDbContext db,
        IPasswordHasher passwordHasher,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);

        if (db.Database.IsNpgsql())
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "FiscalPeriods" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "FiscalYearId" uuid NOT NULL,
                    "Month" integer NOT NULL,
                    "Name" text NOT NULL,
                    "StartDate" timestamp with time zone NOT NULL,
                    "EndDate" timestamp with time zone NOT NULL,
                    "IsLocked" boolean NOT NULL DEFAULT FALSE,
                    "LockedAtUtc" timestamp with time zone NULL,
                    "LockedBy" text NULL,
                    CONSTRAINT "FK_FiscalPeriods_FiscalYears_FiscalYearId" FOREIGN KEY ("FiscalYearId") REFERENCES "FiscalYears" ("Id") ON DELETE CASCADE
                );
                """, cancellationToken);
        }
        else
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "FiscalPeriods" (
                    "Id" TEXT NOT NULL PRIMARY KEY,
                    "TenantId" TEXT NOT NULL,
                    "CompanyId" TEXT NOT NULL,
                    "FiscalYearId" TEXT NOT NULL,
                    "Month" INTEGER NOT NULL,
                    "Name" TEXT NOT NULL,
                    "StartDate" TEXT NOT NULL,
                    "EndDate" TEXT NOT NULL,
                    "IsLocked" INTEGER NOT NULL DEFAULT 0,
                    "LockedAtUtc" TEXT NULL,
                    "LockedBy" TEXT NULL
                );
                """, cancellationToken);
        }

        var hasSuperAdmin = await db.Users
            .AnyAsync(u => u.Role == UserRole.SuperAdmin, cancellationToken);

        if (hasSuperAdmin)
        {
            return;
        }

        var configuredPassword = configuration["Seed:SuperAdminPassword"];
        var initialPassword = string.IsNullOrWhiteSpace(configuredPassword)
            ? "Admin123!"
            : configuredPassword;

        var superAdmin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = null,
            Username = "superadmin",
            Email = "superadmin@webpos.ba",
            PasswordHash = passwordHasher.HashPassword(initialPassword),
            Role = UserRole.SuperAdmin,
            IsActive = true,
            MustChangePassword = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.Users.Add(superAdmin);
        await db.SaveChangesAsync(cancellationToken);
    }
}
