using System.Data;
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
        await UpgradeSchemaAsync(db, cancellationToken);

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

    private static async Task UpgradeSchemaAsync(WebPosDbContext db, CancellationToken cancellationToken)
    {
        var isNpgsql = db.Database.IsNpgsql();

        if (isNpgsql)
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "FiscalPeriods" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "CompanyId" uuid NOT NULL,
                    "FiscalYearId" uuid NOT NULL,
                    "Month" integer NOT NULL,
                    "Name" character varying(100) NOT NULL,
                    "StartDate" timestamp with time zone NOT NULL,
                    "EndDate" timestamp with time zone NOT NULL,
                    "IsLocked" boolean NOT NULL DEFAULT FALSE,
                    "LockedAtUtc" timestamp with time zone NULL,
                    "LockedBy" character varying(100) NULL,
                    CONSTRAINT "FK_FiscalPeriods_FiscalYears_FiscalYearId" FOREIGN KEY ("FiscalYearId") REFERENCES "FiscalYears" ("Id") ON DELETE CASCADE
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "TenantSettings" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "AllowNegativeStock" boolean NOT NULL DEFAULT FALSE,
                    "AllowPriceChangeWithoutLeveling" boolean NOT NULL DEFAULT FALSE,
                    "AutoCreatePriceLevelingOnInbound" boolean NOT NULL DEFAULT TRUE,
                    "DefaultCurrency" character varying(16) NOT NULL DEFAULT 'BAM',
                    "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "LabelTemplates" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "Name" character varying(120) NOT NULL,
                    "WidthMm" numeric(18,2) NOT NULL DEFAULT 0,
                    "HeightMm" numeric(18,2) NOT NULL DEFAULT 0,
                    "FontScale" numeric(18,4) NOT NULL DEFAULT 1,
                    "ShowBarcode" boolean NOT NULL DEFAULT TRUE,
                    "ShowUnitPrice" boolean NOT NULL DEFAULT TRUE,
                    "ShowOrigin" boolean NOT NULL DEFAULT TRUE,
                    "ShowSku" boolean NOT NULL DEFAULT TRUE,
                    "IsDefault" boolean NOT NULL DEFAULT FALSE,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "OtherWarehouseDocuments" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "StoreId" uuid NOT NULL,
                    "FiscalYearId" uuid NOT NULL,
                    "DocumentNumber" character varying(64) NOT NULL,
                    "DocumentDate" timestamp with time zone NOT NULL,
                    "Subtype" character varying(32) NOT NULL,
                    "Status" character varying(32) NOT NULL,
                    "Note" character varying(500) NULL,
                    "TotalPurchaseValue2" numeric(18,2) NOT NULL DEFAULT 0,
                    "TotalRetailValue2" numeric(18,2) NOT NULL DEFAULT 0,
                    "CreatedByUserId" uuid NULL,
                    "PostedByUserId" uuid NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "PostedAtUtc" timestamp with time zone NULL,
                    CONSTRAINT "FK_OtherWarehouseDocuments_Stores_StoreId" FOREIGN KEY ("StoreId") REFERENCES "Stores" ("Id") ON DELETE RESTRICT
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "OtherWarehouseDocumentLines" (
                    "Id" uuid NOT NULL PRIMARY KEY,
                    "TenantId" uuid NOT NULL,
                    "OtherWarehouseDocumentId" uuid NOT NULL,
                    "LineNumber" integer NOT NULL,
                    "ItemId" uuid NOT NULL,
                    "Quantity" numeric(18,4) NOT NULL DEFAULT 0,
                    "PurchasePriceExclVat4" numeric(18,4) NOT NULL DEFAULT 0,
                    "RetailPriceInclVat2" numeric(18,2) NOT NULL DEFAULT 0,
                    "LinePurchaseTotal2" numeric(18,2) NOT NULL DEFAULT 0,
                    "LineRetailTotal2" numeric(18,2) NOT NULL DEFAULT 0,
                    "Reason" character varying(300) NULL,
                    CONSTRAINT "FK_OtherWarehouseDocumentLines_OtherWarehouseDocuments_OtherWarehouseDocumentId" FOREIGN KEY ("OtherWarehouseDocumentId") REFERENCES "OtherWarehouseDocuments" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_OtherWarehouseDocumentLines_Items_ItemId" FOREIGN KEY ("ItemId") REFERENCES "Items" ("Id") ON DELETE RESTRICT
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
                    "LockedBy" TEXT NULL,
                    FOREIGN KEY ("FiscalYearId") REFERENCES "FiscalYears" ("Id") ON DELETE CASCADE
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "TenantSettings" (
                    "Id" TEXT NOT NULL PRIMARY KEY,
                    "TenantId" TEXT NOT NULL,
                    "AllowNegativeStock" INTEGER NOT NULL DEFAULT 0,
                    "AllowPriceChangeWithoutLeveling" INTEGER NOT NULL DEFAULT 0,
                    "AutoCreatePriceLevelingOnInbound" INTEGER NOT NULL DEFAULT 1,
                    "DefaultCurrency" TEXT NOT NULL DEFAULT 'BAM',
                    "UpdatedAtUtc" TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "LabelTemplates" (
                    "Id" TEXT NOT NULL PRIMARY KEY,
                    "TenantId" TEXT NOT NULL,
                    "Name" TEXT NOT NULL,
                    "WidthMm" TEXT NOT NULL DEFAULT '0',
                    "HeightMm" TEXT NOT NULL DEFAULT '0',
                    "FontScale" TEXT NOT NULL DEFAULT '1',
                    "ShowBarcode" INTEGER NOT NULL DEFAULT 1,
                    "ShowUnitPrice" INTEGER NOT NULL DEFAULT 1,
                    "ShowOrigin" INTEGER NOT NULL DEFAULT 1,
                    "ShowSku" INTEGER NOT NULL DEFAULT 1,
                    "IsDefault" INTEGER NOT NULL DEFAULT 0,
                    "CreatedAtUtc" TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "OtherWarehouseDocuments" (
                    "Id" TEXT NOT NULL PRIMARY KEY,
                    "TenantId" TEXT NOT NULL,
                    "StoreId" TEXT NOT NULL,
                    "FiscalYearId" TEXT NOT NULL,
                    "DocumentNumber" TEXT NOT NULL,
                    "DocumentDate" TEXT NOT NULL,
                    "Subtype" TEXT NOT NULL,
                    "Status" TEXT NOT NULL,
                    "Note" TEXT NULL,
                    "TotalPurchaseValue2" TEXT NOT NULL DEFAULT '0',
                    "TotalRetailValue2" TEXT NOT NULL DEFAULT '0',
                    "CreatedByUserId" TEXT NULL,
                    "PostedByUserId" TEXT NULL,
                    "CreatedAtUtc" TEXT NOT NULL DEFAULT '2026-01-01 00:00:00',
                    "PostedAtUtc" TEXT NULL,
                    FOREIGN KEY ("StoreId") REFERENCES "Stores" ("Id") ON DELETE RESTRICT
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "OtherWarehouseDocumentLines" (
                    "Id" TEXT NOT NULL PRIMARY KEY,
                    "TenantId" TEXT NOT NULL,
                    "OtherWarehouseDocumentId" TEXT NOT NULL,
                    "LineNumber" INTEGER NOT NULL,
                    "ItemId" TEXT NOT NULL,
                    "Quantity" TEXT NOT NULL DEFAULT '0',
                    "PurchasePriceExclVat4" TEXT NOT NULL DEFAULT '0',
                    "RetailPriceInclVat2" TEXT NOT NULL DEFAULT '0',
                    "LinePurchaseTotal2" TEXT NOT NULL DEFAULT '0',
                    "LineRetailTotal2" TEXT NOT NULL DEFAULT '0',
                    "Reason" TEXT NULL,
                    FOREIGN KEY ("OtherWarehouseDocumentId") REFERENCES "OtherWarehouseDocuments" ("Id") ON DELETE CASCADE,
                    FOREIGN KEY ("ItemId") REFERENCES "Items" ("Id") ON DELETE RESTRICT
                );
                """, cancellationToken);
        }

        // Idempotent indexes for newly ensured tables
        await db.Database.ExecuteSqlRawAsync(
            """CREATE UNIQUE INDEX IF NOT EXISTS "IX_FiscalPeriods_TenantId_FiscalYearId_Month" ON "FiscalPeriods" ("TenantId", "FiscalYearId", "Month");""",
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantSettings_TenantId" ON "TenantSettings" ("TenantId");""",
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """CREATE UNIQUE INDEX IF NOT EXISTS "IX_LabelTemplates_TenantId_Name" ON "LabelTemplates" ("TenantId", "Name");""",
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """CREATE UNIQUE INDEX IF NOT EXISTS "IX_OtherWarehouseDocuments_TenantId_FiscalYearId_DocumentNumber" ON "OtherWarehouseDocuments" ("TenantId", "FiscalYearId", "DocumentNumber");""",
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """CREATE INDEX IF NOT EXISTS "IX_OtherWarehouseDocumentLines_OtherWarehouseDocumentId" ON "OtherWarehouseDocumentLines" ("OtherWarehouseDocumentId");""",
            cancellationToken);

        // Users
        await AddColumnIfMissingAsync(db, isNpgsql, "Users", "PasswordResetToken", "character varying(256) NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Users", "PasswordResetExpiresAtUtc", "timestamp with time zone NULL", "TEXT NULL", cancellationToken);

        // Companies
        await AddColumnIfMissingAsync(db, isNpgsql, "Companies", "Code", "character varying(64) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Companies", "CurrencyCode", "character varying(16) NOT NULL DEFAULT 'BAM'", "TEXT NOT NULL DEFAULT 'BAM'", cancellationToken);

        // Stores
        await AddColumnIfMissingAsync(db, isNpgsql, "Stores", "Address", "character varying(250) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Stores", "City", "character varying(100) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Stores", "IsActive", "boolean NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1", cancellationToken);

        // CashRegisters
        await AddColumnIfMissingAsync(db, isNpgsql, "CashRegisters", "LastSequenceNumber", "integer NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "CashRegisters", "IsOnline", "boolean NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "CashRegisters", "IsActive", "boolean NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1", cancellationToken);

        // VatRates
        await AddColumnIfMissingAsync(db, isNpgsql, "VatRates", "CompanyId", "uuid NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "VatRates", "ValidFrom", "character varying(32) NOT NULL DEFAULT '2026-01-01'", "TEXT NOT NULL DEFAULT '2026-01-01'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "VatRates", "IsActive", "boolean NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1", cancellationToken);

        // Items
        await AddColumnIfMissingAsync(db, isNpgsql, "Items", "NetContentQty", "numeric(18,4) NOT NULL DEFAULT 1", "TEXT NOT NULL DEFAULT '1'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Items", "NetContentUom", "character varying(20) NOT NULL DEFAULT 'kg'", "TEXT NOT NULL DEFAULT 'kg'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Items", "CountryOfOrigin", "character varying(100) NOT NULL DEFAULT 'Bosna i Hercegovina'", "TEXT NOT NULL DEFAULT 'Bosna i Hercegovina'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Items", "NormativeMode", "character varying(32) NOT NULL DEFAULT 'NONE'", "TEXT NOT NULL DEFAULT 'NONE'", cancellationToken);

        // ItemBarcodes
        await AddColumnIfMissingAsync(db, isNpgsql, "ItemBarcodes", "Uom", "character varying(20) NOT NULL DEFAULT 'kom'", "TEXT NOT NULL DEFAULT 'kom'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "ItemBarcodes", "PackMultiplier", "numeric(18,4) NOT NULL DEFAULT 1", "TEXT NOT NULL DEFAULT '1'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "ItemBarcodes", "Description", "character varying(200) NULL", "TEXT NULL", cancellationToken);

        // ItemBomLines
        await AddColumnIfMissingAsync(db, isNpgsql, "ItemBomLines", "WastePercent", "numeric(18,4) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);

        // StoreItemPrices
        await AddColumnIfMissingAsync(db, isNpgsql, "StoreItemPrices", "MinStockQty", "numeric(18,4) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "StoreItemPrices", "ShelfLocation", "character varying(64) NOT NULL DEFAULT 'A-01-01'", "TEXT NOT NULL DEFAULT 'A-01-01'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "StoreItemPrices", "NeedsLabelPrint", "boolean NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "StoreItemPrices", "UpdatedAtUtc", "timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP", "TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'", cancellationToken);

        // Partners
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "CompanyId", "uuid NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "Phone", "character varying(64) NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "Email", "character varying(200) NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "PaymentTermsDays", "integer NOT NULL DEFAULT 30", "INTEGER NOT NULL DEFAULT 30", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "CreditLimit", "numeric(18,2) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "Partners", "IsActive", "boolean NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1", cancellationToken);

        // PriceLevelings
        await AddColumnIfMissingAsync(db, isNpgsql, "PriceLevelings", "TotalVatDifference2", "numeric(18,2) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PriceLevelings", "TotalMarginDifference2", "numeric(18,2) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);

        // PriceLevelingLines
        await AddColumnIfMissingAsync(db, isNpgsql, "PriceLevelingLines", "VatRatePercent", "numeric(18,4) NOT NULL DEFAULT 17", "TEXT NOT NULL DEFAULT '17'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PriceLevelingLines", "VatDifference2", "numeric(18,2) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PriceLevelingLines", "MarginDifference2", "numeric(18,2) NOT NULL DEFAULT 0", "TEXT NOT NULL DEFAULT '0'", cancellationToken);

        // PosReceipts
        await AddColumnIfMissingAsync(db, isNpgsql, "PosReceipts", "FiscalYearId", "uuid NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PosReceipts", "CashierName", "character varying(150) NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PosReceipts", "ReceiptType", "character varying(32) NOT NULL DEFAULT 'SALE'", "TEXT NOT NULL DEFAULT 'SALE'", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PosReceipts", "ReferenceReceiptId", "uuid NULL", "TEXT NULL", cancellationToken);
        await AddColumnIfMissingAsync(db, isNpgsql, "PosReceipts", "IsFiscalized", "boolean NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0", cancellationToken);
    }

    private static async Task AddColumnIfMissingAsync(
        WebPosDbContext db,
        bool isNpgsql,
        string tableName,
        string columnName,
        string pgColumnDefinition,
        string sqliteColumnDefinition,
        CancellationToken cancellationToken)
    {
        if (isNpgsql)
        {
            var pgSql = $"ALTER TABLE \"{tableName}\" ADD COLUMN IF NOT EXISTS \"{columnName}\" {pgColumnDefinition};";
            await db.Database.ExecuteSqlRawAsync(pgSql, cancellationToken);
            return;
        }

        if (await SqliteColumnExistsAsync(db, tableName, columnName, cancellationToken))
        {
            return;
        }

        var sqliteSql = $"ALTER TABLE \"{tableName}\" ADD COLUMN \"{columnName}\" {sqliteColumnDefinition};";
        await db.Database.ExecuteSqlRawAsync(sqliteSql, cancellationToken);
    }

    private static async Task<bool> SqliteColumnExistsAsync(
        WebPosDbContext db,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        var conn = db.Database.GetDbConnection();
        var shouldClose = conn.State != ConnectionState.Open;
        if (shouldClose)
        {
            await conn.OpenAsync(cancellationToken);
        }

        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"PRAGMA table_info(\"{tableName}\");";
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var existingColumn = reader.GetString(1);
                if (string.Equals(existingColumn, columnName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
        finally
        {
            if (shouldClose)
            {
                await conn.CloseAsync();
            }
        }
    }
}
