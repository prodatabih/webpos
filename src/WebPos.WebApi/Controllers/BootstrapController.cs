using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;

namespace WebPos.WebApi.Controllers;

[Route("api/bootstrap")]
[Authorize]
public class BootstrapController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;

    public BootstrapController(IWebPosDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetBootstrap(CancellationToken ct)
    {
        var tenantId = CurrentTenantId;
        if (tenantId is null)
        {
            return Ok(new
            {
                companies = Array.Empty<object>(),
                fiscalYears = Array.Empty<object>(),
                fiscalPeriods = Array.Empty<object>(),
                storeLocations = Array.Empty<object>(),
                posTerminals = Array.Empty<object>(),
                vatRates = Array.Empty<object>(),
                partners = Array.Empty<object>(),
                items = Array.Empty<object>(),
                itemBarcodes = Array.Empty<object>(),
                itemBomLines = Array.Empty<object>(),
                storeItemPrices = Array.Empty<object>(),
                calculations = Array.Empty<object>(),
                priceLevelings = Array.Empty<object>(),
                transfers = Array.Empty<object>(),
                inventoryCounts = Array.Empty<object>(),
                otherWarehouseDocs = Array.Empty<object>(),
                posReceipts = Array.Empty<object>(),
                kepLedgerEntries = Array.Empty<object>(),
                auditLog = Array.Empty<object>(),
            });
        }

        var tid = tenantId.Value;
        var companiesRaw = await _db.Companies.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var fiscalYearsRaw = await _db.FiscalYears.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var storesRaw = await _db.Stores.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);
        var registersRaw = await _db.CashRegisters.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct);

        return Ok(new
        {
            companies = companiesRaw.Select(c => new
            {
                c.Id,
                Code = c.Jib,
                c.Name,
                TaxIdNumber = c.Jib,
                VatIdNumber = c.PdvNumber ?? string.Empty,
                c.Address,
                c.City,
                CurrencyCode = "BAM",
                BankAccount = c.BankAccount ?? string.Empty,
            }),
            fiscalYears = fiscalYearsRaw.Select(fy => new
            {
                fy.Id,
                fy.CompanyId,
                fy.Year,
                StartDate = $"{fy.Year}-01-01",
                EndDate = $"{fy.Year}-12-31",
                IsLocked = fy.IsClosed,
            }),
            fiscalPeriods = Array.Empty<object>(),
            storeLocations = storesRaw.Select(s => new
            {
                s.Id,
                s.CompanyId,
                s.Code,
                s.Name,
                StoreType = s.StoreType switch
                {
                    Domain.Enums.StoreType.Wholesale => "WHOLESALE",
                    Domain.Enums.StoreType.RawMaterial => "RAW_MATERIAL",
                    _ => "RETAIL",
                },
                Address = string.Empty,
                City = string.Empty,
                IsActive = true,
            }),
            posTerminals = registersRaw.Select(r => new
            {
                r.Id,
                r.StoreId,
                r.Code,
                r.Name,
                FiscalPrefix = r.FiscalDeviceId ?? string.Empty,
                LastSequenceNumber = 0,
                IsOnline = true,
                IsActive = true,
            }),
            vatRates = await _db.VatRates.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            partners = await _db.Partners.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            items = await _db.Items.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            itemBarcodes = await _db.ItemBarcodes.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            itemBomLines = await _db.ItemBomLines.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            storeItemPrices = await _db.StoreItemPrices.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            calculations = await _db.InboundCalculations.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            priceLevelings = await _db.PriceLevelings.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            transfers = await _db.WarehouseTransfers.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            inventoryCounts = await _db.InventoryCounts.AsNoTracking().Include(x => x.Lines).Where(x => x.TenantId == tid).ToListAsync(ct),
            otherWarehouseDocs = Array.Empty<object>(),
            posReceipts = await _db.PosReceipts.AsNoTracking().Include(x => x.Lines).Include(x => x.Payments).Where(x => x.TenantId == tid).ToListAsync(ct),
            kepLedgerEntries = await _db.KepLedgerEntries.AsNoTracking().Where(x => x.TenantId == tid).ToListAsync(ct),
            auditLog = await _db.AuditLogEntries.AsNoTracking().Where(x => x.TenantId == tid).OrderByDescending(x => x.OccurredAtUtc).Take(200).ToListAsync(ct),
        });
    }
}
