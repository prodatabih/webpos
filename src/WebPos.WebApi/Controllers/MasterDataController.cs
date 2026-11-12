using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Application.Services;
using WebPos.Domain.Entities;
using WebPos.WebApi.Contracts;

namespace WebPos.WebApi.Controllers;

[Route("api/master-data")]
[Authorize]
public class MasterDataController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;

    public MasterDataController(IWebPosDbContext db)
    {
        _db = db;
    }

    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromQuery] Guid? tenantId, [FromQuery] string? search, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var query = _db.Items.AsNoTracking()
            .Where(i => i.TenantId == tid)
            .Include(i => i.StorePrices)
            .Include(i => i.Barcodes)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(i =>
                i.Name.ToLower().Contains(term) ||
                i.Sku.ToLower().Contains(term) ||
                (i.PrimaryBarcode != null && i.PrimaryBarcode.ToLower().Contains(term)));
        }

        var items = await query.OrderBy(i => i.Name).ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("items")]
    public async Task<IActionResult> CreateItem([FromBody] UpsertItemRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var item = new Item
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            CompanyId = req.CompanyId,
            Sku = req.Sku.Trim(),
            PrimaryBarcode = req.PrimaryBarcode?.Trim(),
            Name = req.Name.Trim(),
            ShortName = req.ShortName?.Trim(),
            CategoryName = req.CategoryName?.Trim(),
            CategoryPrefix = req.CategoryPrefix?.Trim(),
            Uom = string.IsNullOrWhiteSpace(req.Uom) ? "kom" : req.Uom.Trim(),
            VatRateId = req.VatRateId,
            ItemType = req.ItemType,
            IsWeighable = req.IsWeighable,
            IsActive = req.IsActive
        };

        _db.Items.Add(item);

        if (req.StoreId.HasValue && req.StoreId.Value != Guid.Empty)
        {
            _db.StoreItemPrices.Add(new StoreItemPrice
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                StoreId = req.StoreId.Value,
                ItemId = item.Id,
                PurchasePriceExclVat4 = CalculationMath.Round4(req.PurchasePriceExclVat4 ?? 0m),
                WholesalePriceExclVat4 = CalculationMath.Round4(req.WholesalePriceExclVat4 ?? 0m),
                RetailPriceInclVat2 = CalculationMath.Round2(req.RetailPriceInclVat2 ?? 0m),
                StockQty = 0m
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(item);
    }

    [HttpPut("items/{id:guid}")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpsertItemRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var item = await _db.Items
            .Include(i => i.StorePrices)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tid, ct);
        if (item is null) return NotFound();

        if (req.StoreId.HasValue && req.RetailPriceInclVat2.HasValue)
        {
            var newRetail2 = CalculationMath.Round2(req.RetailPriceInclVat2.Value);
            var priceRow = item.StorePrices.FirstOrDefault(p => p.StoreId == req.StoreId.Value);

            if (priceRow is not null && priceRow.RetailPriceInclVat2 != newRetail2)
            {
                if (priceRow.StockQty > 0m)
                {
                    return Conflict(new
                    {
                        code = "STOCK_EXISTS_LEVELING_REQUIRED",
                        message = "Retail price cannot be changed directly while stock is greater than zero. Create and post a price leveling document instead.",
                        stockQty = priceRow.StockQty
                    });
                }

                priceRow.RetailPriceInclVat2 = newRetail2;
                if (req.PurchasePriceExclVat4.HasValue)
                {
                    priceRow.PurchasePriceExclVat4 = CalculationMath.Round4(req.PurchasePriceExclVat4.Value);
                }
                if (req.WholesalePriceExclVat4.HasValue)
                {
                    priceRow.WholesalePriceExclVat4 = CalculationMath.Round4(req.WholesalePriceExclVat4.Value);
                }
            }
            else if (priceRow is null)
            {
                _db.StoreItemPrices.Add(new StoreItemPrice
                {
                    Id = Guid.NewGuid(),
                    TenantId = tid,
                    StoreId = req.StoreId.Value,
                    ItemId = item.Id,
                    PurchasePriceExclVat4 = CalculationMath.Round4(req.PurchasePriceExclVat4 ?? 0m),
                    WholesalePriceExclVat4 = CalculationMath.Round4(req.WholesalePriceExclVat4 ?? 0m),
                    RetailPriceInclVat2 = newRetail2,
                    StockQty = 0m
                });
            }
        }

        item.CompanyId = req.CompanyId;
        item.Sku = req.Sku.Trim();
        item.PrimaryBarcode = req.PrimaryBarcode?.Trim();
        item.Name = req.Name.Trim();
        item.ShortName = req.ShortName?.Trim();
        item.CategoryName = req.CategoryName?.Trim();
        item.CategoryPrefix = req.CategoryPrefix?.Trim();
        item.Uom = string.IsNullOrWhiteSpace(req.Uom) ? "kom" : req.Uom.Trim();
        item.VatRateId = req.VatRateId;
        item.ItemType = req.ItemType;
        item.IsWeighable = req.IsWeighable;
        item.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);
        return Ok(item);
    }

    [HttpDelete("items/{id:guid}")]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tid, ct);
        if (item is null) return NotFound();
        item.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("partners")]
    public async Task<IActionResult> GetPartners([FromQuery] Guid? tenantId, [FromQuery] string? search, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var query = _db.Partners.AsNoTracking().Where(p => p.TenantId == tid);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(p =>
                p.Name.ToLower().Contains(term) ||
                p.Code.ToLower().Contains(term) ||
                (p.Jib != null && p.Jib.Contains(term)));
        }

        var list = await query.OrderBy(p => p.Name).ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("partners")]
    public async Task<IActionResult> CreatePartner([FromBody] UpsertPartnerRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = new Partner
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            Jib = req.Jib?.Trim(),
            Pib = req.Pib?.Trim(),
            Address = req.Address?.Trim(),
            City = req.City?.Trim(),
            IsSupplier = req.IsSupplier,
            IsCustomer = req.IsCustomer,
            DefaultDiscountPct = req.DefaultDiscountPct
        };
        _db.Partners.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("partners/{id:guid}")]
    public async Task<IActionResult> UpdatePartner(Guid id, [FromBody] UpsertPartnerRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Partners.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid, ct);
        if (entity is null) return NotFound();

        entity.Code = req.Code.Trim();
        entity.Name = req.Name.Trim();
        entity.Jib = req.Jib?.Trim();
        entity.Pib = req.Pib?.Trim();
        entity.Address = req.Address?.Trim();
        entity.City = req.City?.Trim();
        entity.IsSupplier = req.IsSupplier;
        entity.IsCustomer = req.IsCustomer;
        entity.DefaultDiscountPct = req.DefaultDiscountPct;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("partners/{id:guid}")]
    public async Task<IActionResult> DeletePartner(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Partners.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid, ct);
        if (entity is null) return NotFound();
        _db.Partners.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
