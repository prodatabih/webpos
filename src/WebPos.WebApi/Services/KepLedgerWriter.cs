using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.WebApi.Services;

public sealed class KepLedgerWriter
{
    private readonly IWebPosDbContext _db;

    public KepLedgerWriter(IWebPosDbContext db)
    {
        _db = db;
    }

    public async Task<KepLedgerEntry> AppendEntryAsync(
        Guid tenantId,
        Guid storeId,
        Guid fiscalYearId,
        DateTime entryDate,
        string documentType,
        Guid documentId,
        string documentNumber,
        string description,
        LedgerDirection direction,
        decimal amount2,
        CancellationToken ct)
    {
        var roundedAmount2 = CalculationMath.Round2(Math.Abs(amount2));

        var lastEntry = await _db.KepLedgerEntries
            .Where(e => e.TenantId == tenantId && e.StoreId == storeId && e.FiscalYearId == fiscalYearId)
            .OrderByDescending(e => e.EntryNumber)
            .Select(e => new { e.EntryNumber, e.BalanceAfter2 })
            .FirstOrDefaultAsync(ct);

        var nextNumber = (lastEntry?.EntryNumber ?? 0) + 1;
        var prevBalance = lastEntry?.BalanceAfter2 ?? 0m;
        var debit2 = direction == LedgerDirection.Debit ? roundedAmount2 : 0m;
        var credit2 = direction == LedgerDirection.Credit ? roundedAmount2 : 0m;
        var balanceAfter2 = CalculationMath.Round2(prevBalance + debit2 - credit2);

        var entry = new KepLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = storeId,
            FiscalYearId = fiscalYearId,
            EntryNumber = nextNumber,
            EntryDate = entryDate,
            DocumentType = documentType,
            DocumentId = documentId,
            DocumentNumber = documentNumber,
            Description = description,
            Direction = direction,
            DebitAmount2 = debit2,
            CreditAmount2 = credit2,
            BalanceAfter2 = balanceAfter2,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.KepLedgerEntries.Add(entry);
        return entry;
    }

    public async Task<StoreItemPrice> GetOrCreateStorePriceAsync(
        Guid tenantId,
        Guid storeId,
        Guid itemId,
        CancellationToken ct)
    {
        var existing = await _db.StoreItemPrices
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.StoreId == storeId && p.ItemId == itemId, ct);
        if (existing is not null)
        {
            return existing;
        }

        var created = new StoreItemPrice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = storeId,
            ItemId = itemId,
            PurchasePriceExclVat4 = 0m,
            WholesalePriceExclVat4 = 0m,
            RetailPriceInclVat2 = 0m,
            StockQty = 0m
        };
        _db.StoreItemPrices.Add(created);
        return created;
    }
}
