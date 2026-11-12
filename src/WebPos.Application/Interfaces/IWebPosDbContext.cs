using Microsoft.EntityFrameworkCore;
using WebPos.Domain.Entities;

namespace WebPos.Application.Interfaces;

public interface IWebPosDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<Company> Companies { get; }
    DbSet<Store> Stores { get; }
    DbSet<CashRegister> CashRegisters { get; }
    DbSet<FiscalYear> FiscalYears { get; }
    DbSet<VatRate> VatRates { get; }
    DbSet<Item> Items { get; }
    DbSet<ItemBarcode> ItemBarcodes { get; }
    DbSet<ItemBomLine> ItemBomLines { get; }
    DbSet<StoreItemPrice> StoreItemPrices { get; }
    DbSet<Partner> Partners { get; }
    DbSet<InboundCalculation> InboundCalculations { get; }
    DbSet<InboundCalculationLine> InboundCalculationLines { get; }
    DbSet<PriceLeveling> PriceLevelings { get; }
    DbSet<PriceLevelingLine> PriceLevelingLines { get; }
    DbSet<WarehouseTransfer> WarehouseTransfers { get; }
    DbSet<WarehouseTransferLine> WarehouseTransferLines { get; }
    DbSet<InventoryCount> InventoryCounts { get; }
    DbSet<InventoryCountLine> InventoryCountLines { get; }
    DbSet<PosReceipt> PosReceipts { get; }
    DbSet<PosReceiptLine> PosReceiptLines { get; }
    DbSet<PosReceiptPayment> PosReceiptPayments { get; }
    DbSet<KepLedgerEntry> KepLedgerEntries { get; }
    DbSet<AuditLogEntry> AuditLogEntries { get; }
    DbSet<SyncOutboxMessage> SyncOutboxMessages { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
