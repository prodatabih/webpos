using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;

namespace WebPos.Infrastructure.Persistence;

public class WebPosDbContext : DbContext, IWebPosDbContext
{
    public WebPosDbContext(DbContextOptions<WebPosDbContext> options) : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<CashRegister> CashRegisters => Set<CashRegister>();
    public DbSet<FiscalYear> FiscalYears => Set<FiscalYear>();
    public DbSet<VatRate> VatRates => Set<VatRate>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<ItemBarcode> ItemBarcodes => Set<ItemBarcode>();
    public DbSet<ItemBomLine> ItemBomLines => Set<ItemBomLine>();
    public DbSet<StoreItemPrice> StoreItemPrices => Set<StoreItemPrice>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<InboundCalculation> InboundCalculations => Set<InboundCalculation>();
    public DbSet<InboundCalculationLine> InboundCalculationLines => Set<InboundCalculationLine>();
    public DbSet<PriceLeveling> PriceLevelings => Set<PriceLeveling>();
    public DbSet<PriceLevelingLine> PriceLevelingLines => Set<PriceLevelingLine>();
    public DbSet<WarehouseTransfer> WarehouseTransfers => Set<WarehouseTransfer>();
    public DbSet<WarehouseTransferLine> WarehouseTransferLines => Set<WarehouseTransferLine>();
    public DbSet<InventoryCount> InventoryCounts => Set<InventoryCount>();
    public DbSet<InventoryCountLine> InventoryCountLines => Set<InventoryCountLine>();
    public DbSet<PosReceipt> PosReceipts => Set<PosReceipt>();
    public DbSet<PosReceiptLine> PosReceiptLines => Set<PosReceiptLine>();
    public DbSet<PosReceiptPayment> PosReceiptPayments => Set<PosReceiptPayment>();
    public DbSet<KepLedgerEntry> KepLedgerEntries => Set<KepLedgerEntry>();
    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();
    public DbSet<SyncOutboxMessage> SyncOutboxMessages => Set<SyncOutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WebPosDbContext).Assembly);
    }
}
