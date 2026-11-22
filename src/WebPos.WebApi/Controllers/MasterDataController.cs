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
    private const string ManagementRoles = "SuperAdmin,TenantAdmin,Manager";

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
            .Include(i => i.BomLines)
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
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateItem([FromBody] UpsertItemRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        return await UpsertItemInternalAsync(tid, req.Id, req, requireExisting: false, ct);
    }

    [HttpPut("items/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpsertItemRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        return await UpsertItemInternalAsync(tid, id, req, requireExisting: true, ct);
    }

    private async Task<IActionResult> UpsertItemInternalAsync(
        Guid tid,
        Guid? targetId,
        UpsertItemRequest req,
        bool requireExisting,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Sku) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra (SKU) i naziv artikla su obavezni." });
        }

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == req.CompanyId && c.TenantId == tid, ct);
        if (!companyExists)
        {
            return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
        }

        var vatExists = await _db.VatRates.AnyAsync(v => v.Id == req.VatRateId && v.TenantId == tid, ct);
        if (!vatExists)
        {
            return BadRequest(new { message = "Odabrana PDV stopa ne postoji u bazi. Prvo definišite PDV stopu u Matični podaci -> PDV stope." });
        }

        Item? item = null;
        if (targetId.HasValue && targetId.Value != Guid.Empty)
        {
            item = await _db.Items
                .Include(i => i.StorePrices)
                .Include(i => i.Barcodes)
                .Include(i => i.BomLines)
                .FirstOrDefaultAsync(i => i.Id == targetId.Value && i.TenantId == tid, ct);
        }

        if (requireExisting && item is null)
        {
            return NotFound(new { message = "Artikal nije pronađen." });
        }

        var normalizedSku = req.Sku.Trim();
        var duplicateSku = await _db.Items.AnyAsync(
            i => i.TenantId == tid && i.Sku.ToLower() == normalizedSku.ToLower() && (item == null || i.Id != item.Id),
            ct);
        if (duplicateSku)
        {
            return Conflict(new { message = $"Artikal sa šifrom (SKU) '{normalizedSku}' već postoji." });
        }

        var isNew = item is null;
        if (isNew)
        {
            item = new Item
            {
                Id = targetId.HasValue && targetId.Value != Guid.Empty ? targetId.Value : Guid.NewGuid(),
                TenantId = tid,
                CompanyId = req.CompanyId,
                Sku = normalizedSku,
                PrimaryBarcode = req.PrimaryBarcode?.Trim(),
                Name = req.Name.Trim(),
                ShortName = req.ShortName?.Trim(),
                CategoryName = req.CategoryName?.Trim(),
                CategoryPrefix = req.CategoryPrefix?.Trim(),
                Uom = string.IsNullOrWhiteSpace(req.Uom) ? "kom" : req.Uom.Trim(),
                VatRateId = req.VatRateId,
                ItemType = req.ItemType,
                IsWeighable = req.IsWeighable,
                IsActive = req.IsActive,
                NetContentQty = req.NetContentQty ?? 1m,
                NetContentUom = string.IsNullOrWhiteSpace(req.NetContentUom) ? "kg" : req.NetContentUom.Trim(),
                CountryOfOrigin = string.IsNullOrWhiteSpace(req.CountryOfOrigin) ? "Bosna i Hercegovina" : req.CountryOfOrigin.Trim(),
                NormativeMode = string.IsNullOrWhiteSpace(req.NormativeMode) ? "NONE" : req.NormativeMode.Trim()
            };
            _db.Items.Add(item);
        }
        else
        {
            item!.CompanyId = req.CompanyId;
            item.Sku = normalizedSku;
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
            if (req.NetContentQty.HasValue)
            {
                item.NetContentQty = req.NetContentQty.Value;
            }
            if (!string.IsNullOrWhiteSpace(req.NetContentUom))
            {
                item.NetContentUom = req.NetContentUom.Trim();
            }
            if (!string.IsNullOrWhiteSpace(req.CountryOfOrigin))
            {
                item.CountryOfOrigin = req.CountryOfOrigin.Trim();
            }
            if (!string.IsNullOrWhiteSpace(req.NormativeMode))
            {
                item.NormativeMode = req.NormativeMode.Trim();
            }
        }

        // Sync ItemBarcodes if explicitly supplied
        if (req.Barcodes is not null)
        {
            var cleanedBarcodes = req.Barcodes
                .Where(b => !string.IsNullOrWhiteSpace(b.Barcode))
                .Select(b => new
                {
                    Barcode = b.Barcode.Trim(),
                    Lower = b.Barcode.Trim().ToLowerInvariant(),
                    b.IsPrimary,
                    Uom = string.IsNullOrWhiteSpace(b.Uom) ? item.Uom : b.Uom.Trim(),
                    PackMultiplier = b.PackMultiplier <= 0m ? 1m : b.PackMultiplier,
                    Description = b.Description?.Trim()
                })
                .ToList();

            if (cleanedBarcodes.GroupBy(b => b.Lower).Any(g => g.Count() > 1))
            {
                return BadRequest(new { message = "Lista barkodova sadrži duplikate." });
            }

            if (cleanedBarcodes.Count > 0)
            {
                var incomingLowerList = cleanedBarcodes.Select(b => b.Lower).ToList();
                var barcodeTakenByOther = await _db.ItemBarcodes.AnyAsync(
                    b => b.TenantId == tid && b.ItemId != item.Id && incomingLowerList.Contains(b.Barcode.ToLower()),
                    ct);
                if (barcodeTakenByOther)
                {
                    return Conflict(new { message = "Jedan ili više barkodova već pripada drugom artiklu." });
                }
            }

            var existingBarcodes = isNew
                ? new List<ItemBarcode>()
                : await _db.ItemBarcodes.Where(b => b.TenantId == tid && b.ItemId == item.Id).ToListAsync(ct);

            var incomingByLower = cleanedBarcodes.ToDictionary(b => b.Lower, StringComparer.OrdinalIgnoreCase);

            foreach (var existing in existingBarcodes)
            {
                if (incomingByLower.TryGetValue(existing.Barcode.ToLowerInvariant(), out var match))
                {
                    existing.Barcode = match.Barcode;
                    existing.IsPrimary = match.IsPrimary;
                    existing.Uom = match.Uom;
                    existing.PackMultiplier = match.PackMultiplier;
                    existing.Description = match.Description;
                    incomingByLower.Remove(existing.Barcode.ToLowerInvariant());
                }
                else
                {
                    _db.ItemBarcodes.Remove(existing);
                }
            }

            foreach (var remaining in incomingByLower.Values)
            {
                var newBarcode = new ItemBarcode
                {
                    Id = Guid.NewGuid(),
                    TenantId = tid,
                    ItemId = item.Id,
                    Barcode = remaining.Barcode,
                    IsPrimary = remaining.IsPrimary,
                    Uom = remaining.Uom,
                    PackMultiplier = remaining.PackMultiplier,
                    Description = remaining.Description
                };
                _db.ItemBarcodes.Add(newBarcode);
            }
        }

        // Sync ItemBomLines if explicitly supplied
        if (req.BomLines is not null)
        {
            foreach (var bom in req.BomLines)
            {
                if (bom.ComponentItemId == Guid.Empty)
                {
                    return BadRequest(new { message = "Sastojak normativa je obavezan." });
                }
                if (bom.ComponentItemId == item.Id)
                {
                    return BadRequest(new { message = "Artikal ne može biti vlastiti sastojak u normativu." });
                }
                if (bom.Quantity <= 0m)
                {
                    return BadRequest(new { message = "Količina sastojka u normativu mora biti veća od 0." });
                }
            }

            var componentIds = req.BomLines.Select(b => b.ComponentItemId).Distinct().ToList();
            if (componentIds.Count > 0)
            {
                var existingComponentCount = await _db.Items.CountAsync(
                    i => i.TenantId == tid && componentIds.Contains(i.Id),
                    ct);
                if (existingComponentCount != componentIds.Count)
                {
                    return BadRequest(new { message = "Jedan ili više odabranih sastojaka normativa ne postoji u bazi." });
                }
            }

            var sourceStoreIds = req.BomLines
                .Where(b => b.SourceStoreId.HasValue && b.SourceStoreId.Value != Guid.Empty)
                .Select(b => b.SourceStoreId!.Value)
                .Distinct()
                .ToList();
            if (sourceStoreIds.Count > 0)
            {
                var existingStoreCount = await _db.Stores.CountAsync(
                    s => s.TenantId == tid && sourceStoreIds.Contains(s.Id),
                    ct);
                if (existingStoreCount != sourceStoreIds.Count)
                {
                    return BadRequest(new { message = "Odabrana poslovnica izvora normativa ne postoji u bazi." });
                }
            }

            if (!isNew)
            {
                var existingBomLines = await _db.ItemBomLines
                    .Where(b => b.TenantId == tid && b.ParentItemId == item.Id)
                    .ToListAsync(ct);
                if (existingBomLines.Count > 0)
                {
                    _db.ItemBomLines.RemoveRange(existingBomLines);
                }
            }

            foreach (var bom in req.BomLines)
            {
                _db.ItemBomLines.Add(new ItemBomLine
                {
                    Id = Guid.NewGuid(),
                    TenantId = tid,
                    ParentItemId = item.Id,
                    ComponentItemId = bom.ComponentItemId,
                    SourceStoreId = bom.SourceStoreId.HasValue && bom.SourceStoreId.Value != Guid.Empty ? bom.SourceStoreId : null,
                    Quantity = bom.Quantity,
                    WastePercent = bom.WastePercent
                });
            }
        }

        // Upsert StorePrices (list or single legacy StoreId)
        var storePriceRequests = new List<UpsertStoreItemPriceRequest>();
        if (req.StorePrices is not null)
        {
            if (req.StorePrices.GroupBy(sp => sp.StoreId).Any(g => g.Count() > 1))
            {
                return BadRequest(new { message = "Lista cjenovnika sadrži duplikate za istu poslovnicu." });
            }
            storePriceRequests.AddRange(req.StorePrices);
        }
        else if (req.StoreId.HasValue && req.StoreId.Value != Guid.Empty)
        {
            storePriceRequests.Add(new UpsertStoreItemPriceRequest(
                StoreId: req.StoreId.Value,
                ItemId: item.Id,
                PurchasePriceExclVat4: req.PurchasePriceExclVat4,
                WholesalePriceExclVat4: req.WholesalePriceExclVat4,
                RetailPriceInclVat2: req.RetailPriceInclVat2));
        }

        if (storePriceRequests.Count > 0)
        {
            var requestedStoreIds = storePriceRequests.Select(sp => sp.StoreId).Distinct().ToList();
            var existingStoreCount = await _db.Stores.CountAsync(
                s => s.TenantId == tid && requestedStoreIds.Contains(s.Id),
                ct);
            if (existingStoreCount != requestedStoreIds.Count)
            {
                return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });
            }

            var tenantSetting = await _db.TenantSettings.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tid, ct);
            var allowPriceChangeWithoutLeveling = tenantSetting?.AllowPriceChangeWithoutLeveling ?? false;

            foreach (var sp in storePriceRequests)
            {
                var priceRow = isNew
                    ? null
                    : item.StorePrices.FirstOrDefault(p => p.StoreId == sp.StoreId);

                if (priceRow is null)
                {
                    var initialRetail2 = CalculationMath.Round2(sp.RetailPriceInclVat2 ?? 0m);
                    _db.StoreItemPrices.Add(new StoreItemPrice
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tid,
                        StoreId = sp.StoreId,
                        ItemId = item.Id,
                        PurchasePriceExclVat4 = CalculationMath.Round4(sp.PurchasePriceExclVat4 ?? 0m),
                        WholesalePriceExclVat4 = CalculationMath.Round4(sp.WholesalePriceExclVat4 ?? 0m),
                        RetailPriceInclVat2 = initialRetail2,
                        StockQty = 0m,
                        MinStockQty = sp.MinStockQty ?? 0m,
                        ShelfLocation = string.IsNullOrWhiteSpace(sp.ShelfLocation) ? "A-01-01" : sp.ShelfLocation.Trim(),
                        NeedsLabelPrint = sp.NeedsLabelPrint ?? (initialRetail2 > 0m),
                        UpdatedAtUtc = DateTime.UtcNow
                    });
                }
                else
                {
                    if (sp.RetailPriceInclVat2.HasValue)
                    {
                        var newRetail2 = CalculationMath.Round2(sp.RetailPriceInclVat2.Value);
                        if (priceRow.RetailPriceInclVat2 != newRetail2)
                        {
                            if (priceRow.StockQty > 0m && !allowPriceChangeWithoutLeveling)
                            {
                                return Conflict(new
                                {
                                    code = "STOCK_EXISTS_LEVELING_REQUIRED",
                                    message = "Maloprodajna cijena se ne može mijenjati direktno dok postoji zaliha (> 0). Kreirajte i proknjižite nivelaciju cijena.",
                                    stockQty = priceRow.StockQty
                                });
                            }

                            priceRow.RetailPriceInclVat2 = newRetail2;
                            priceRow.NeedsLabelPrint = sp.NeedsLabelPrint ?? true;
                        }
                        else if (sp.NeedsLabelPrint.HasValue)
                        {
                            priceRow.NeedsLabelPrint = sp.NeedsLabelPrint.Value;
                        }
                    }
                    else if (sp.NeedsLabelPrint.HasValue)
                    {
                        priceRow.NeedsLabelPrint = sp.NeedsLabelPrint.Value;
                    }

                    if (sp.PurchasePriceExclVat4.HasValue)
                    {
                        priceRow.PurchasePriceExclVat4 = CalculationMath.Round4(sp.PurchasePriceExclVat4.Value);
                    }
                    if (sp.WholesalePriceExclVat4.HasValue)
                    {
                        priceRow.WholesalePriceExclVat4 = CalculationMath.Round4(sp.WholesalePriceExclVat4.Value);
                    }
                    if (sp.MinStockQty.HasValue)
                    {
                        priceRow.MinStockQty = sp.MinStockQty.Value;
                    }
                    if (sp.ShelfLocation is not null)
                    {
                        priceRow.ShelfLocation = string.IsNullOrWhiteSpace(sp.ShelfLocation) ? "A-01-01" : sp.ShelfLocation.Trim();
                    }

                    priceRow.UpdatedAtUtc = DateTime.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync(ct);

        var savedItem = await _db.Items.AsNoTracking()
            .Include(i => i.StorePrices)
            .Include(i => i.Barcodes)
            .Include(i => i.BomLines)
            .FirstAsync(i => i.Id == item.Id && i.TenantId == tid, ct);

        return Ok(savedItem);
    }

    [HttpPost("store-prices")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpsertStorePrice([FromBody] UpsertStoreItemPriceRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var storeExists = await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct);
        if (!storeExists) return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });

        var itemExists = await _db.Items.AnyAsync(i => i.Id == req.ItemId && i.TenantId == tid, ct);
        if (!itemExists) return BadRequest(new { message = "Artikal još nije snimljen u bazu. Prvo snimite artikal." });

        var tenantSetting = await _db.TenantSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tid, ct);
        var allowPriceChangeWithoutLeveling = tenantSetting?.AllowPriceChangeWithoutLeveling ?? false;

        var priceRow = await _db.StoreItemPrices
            .FirstOrDefaultAsync(p => p.TenantId == tid && p.StoreId == req.StoreId && p.ItemId == req.ItemId, ct);

        if (priceRow is null)
        {
            var initialRetail2 = CalculationMath.Round2(req.RetailPriceInclVat2 ?? 0m);
            priceRow = new StoreItemPrice
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                StoreId = req.StoreId,
                ItemId = req.ItemId,
                PurchasePriceExclVat4 = CalculationMath.Round4(req.PurchasePriceExclVat4 ?? 0m),
                WholesalePriceExclVat4 = CalculationMath.Round4(req.WholesalePriceExclVat4 ?? 0m),
                RetailPriceInclVat2 = initialRetail2,
                StockQty = 0m,
                MinStockQty = req.MinStockQty ?? 0m,
                ShelfLocation = string.IsNullOrWhiteSpace(req.ShelfLocation) ? "A-01-01" : req.ShelfLocation.Trim(),
                NeedsLabelPrint = req.NeedsLabelPrint ?? (initialRetail2 > 0m),
                UpdatedAtUtc = DateTime.UtcNow
            };
            _db.StoreItemPrices.Add(priceRow);
        }
        else
        {
            if (req.RetailPriceInclVat2.HasValue)
            {
                var newRetail2 = CalculationMath.Round2(req.RetailPriceInclVat2.Value);
                if (priceRow.RetailPriceInclVat2 != newRetail2)
                {
                    if (priceRow.StockQty > 0m && !allowPriceChangeWithoutLeveling)
                    {
                        return Conflict(new
                        {
                            code = "STOCK_EXISTS_LEVELING_REQUIRED",
                            message = "Maloprodajna cijena se ne može mijenjati direktno dok postoji zaliha (> 0). Kreirajte i proknjižite nivelaciju cijena.",
                            stockQty = priceRow.StockQty
                        });
                    }

                    priceRow.RetailPriceInclVat2 = newRetail2;
                    priceRow.NeedsLabelPrint = req.NeedsLabelPrint ?? true;
                }
                else if (req.NeedsLabelPrint.HasValue)
                {
                    priceRow.NeedsLabelPrint = req.NeedsLabelPrint.Value;
                }
            }
            else if (req.NeedsLabelPrint.HasValue)
            {
                priceRow.NeedsLabelPrint = req.NeedsLabelPrint.Value;
            }

            if (req.PurchasePriceExclVat4.HasValue)
            {
                priceRow.PurchasePriceExclVat4 = CalculationMath.Round4(req.PurchasePriceExclVat4.Value);
            }
            if (req.WholesalePriceExclVat4.HasValue)
            {
                priceRow.WholesalePriceExclVat4 = CalculationMath.Round4(req.WholesalePriceExclVat4.Value);
            }
            if (req.MinStockQty.HasValue)
            {
                priceRow.MinStockQty = req.MinStockQty.Value;
            }
            if (req.ShelfLocation is not null)
            {
                priceRow.ShelfLocation = string.IsNullOrWhiteSpace(req.ShelfLocation) ? "A-01-01" : req.ShelfLocation.Trim();
            }

            priceRow.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(priceRow);
    }

    [HttpDelete("items/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tid, ct);
        if (item is null) return NotFound();

        var isReferenced =
            await _db.InboundCalculationLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.PriceLevelingLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.WarehouseTransferLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.InventoryCountLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.OtherWarehouseDocumentLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.PosReceiptLines.AnyAsync(l => l.TenantId == tid && l.ItemId == id, ct) ||
            await _db.StoreItemPrices.AnyAsync(p => p.TenantId == tid && p.ItemId == id && p.StockQty != 0m, ct) ||
            await _db.ItemBomLines.AnyAsync(b => b.TenantId == tid && b.ComponentItemId == id, ct);

        if (isReferenced)
        {
            item.IsActive = false;
            await _db.SaveChangesAsync(ct);
            return Ok(new
            {
                deleted = false,
                deactivated = true,
                message = "Artikal ima promet/dokumente pa je deaktiviran umjesto brisanja."
            });
        }

        var barcodes = await _db.ItemBarcodes.Where(b => b.TenantId == tid && b.ItemId == id).ToListAsync(ct);
        if (barcodes.Count > 0)
        {
            _db.ItemBarcodes.RemoveRange(barcodes);
        }

        var bomLines = await _db.ItemBomLines.Where(b => b.TenantId == tid && b.ParentItemId == id).ToListAsync(ct);
        if (bomLines.Count > 0)
        {
            _db.ItemBomLines.RemoveRange(bomLines);
        }

        var zeroStockPrices = await _db.StoreItemPrices.Where(p => p.TenantId == tid && p.ItemId == id).ToListAsync(ct);
        if (zeroStockPrices.Count > 0)
        {
            _db.StoreItemPrices.RemoveRange(zeroStockPrices);
        }

        _db.Items.Remove(item);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            deleted = true,
            deactivated = false,
            message = "Artikal je trajno obrisan."
        });
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
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreatePartner([FromBody] UpsertPartnerRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        return await UpsertPartnerInternalAsync(tid, req.Id, req, requireExisting: false, ct);
    }

    [HttpPut("partners/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdatePartner(Guid id, [FromBody] UpsertPartnerRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        return await UpsertPartnerInternalAsync(tid, id, req, requireExisting: true, ct);
    }

    private async Task<IActionResult> UpsertPartnerInternalAsync(
        Guid tid,
        Guid? targetId,
        UpsertPartnerRequest req,
        bool requireExisting,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv partnera su obavezni." });
        }

        var normalizedCompanyId = req.CompanyId.HasValue && req.CompanyId.Value != Guid.Empty ? req.CompanyId : null;
        if (normalizedCompanyId.HasValue)
        {
            var companyExists = await _db.Companies.AnyAsync(c => c.Id == normalizedCompanyId.Value && c.TenantId == tid, ct);
            if (!companyExists)
            {
                return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
            }
        }

        Partner? entity = null;
        if (targetId.HasValue && targetId.Value != Guid.Empty)
        {
            entity = await _db.Partners.FirstOrDefaultAsync(p => p.Id == targetId.Value && p.TenantId == tid, ct);
        }

        if (requireExisting && entity is null)
        {
            return NotFound(new { message = "Partner nije pronađen." });
        }

        var normalizedCode = req.Code.Trim();
        var duplicateCode = await _db.Partners.AnyAsync(
            p => p.TenantId == tid && p.Code.ToLower() == normalizedCode.ToLower() && (entity == null || p.Id != entity.Id),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"Partner sa šifrom '{normalizedCode}' već postoji." });
        }

        if (entity is null)
        {
            entity = new Partner
            {
                Id = targetId.HasValue && targetId.Value != Guid.Empty ? targetId.Value : Guid.NewGuid(),
                TenantId = tid,
                CompanyId = normalizedCompanyId,
                Code = normalizedCode,
                Name = req.Name.Trim(),
                Jib = req.Jib?.Trim(),
                Pib = req.Pib?.Trim(),
                Address = req.Address?.Trim(),
                City = req.City?.Trim(),
                Phone = req.Phone?.Trim(),
                Email = req.Email?.Trim(),
                IsSupplier = req.IsSupplier,
                IsCustomer = req.IsCustomer,
                DefaultDiscountPct = req.DefaultDiscountPct,
                PaymentTermsDays = req.PaymentTermsDays,
                CreditLimit = req.CreditLimit,
                IsActive = req.IsActive
            };
            _db.Partners.Add(entity);
        }
        else
        {
            entity.CompanyId = normalizedCompanyId;
            entity.Code = normalizedCode;
            entity.Name = req.Name.Trim();
            entity.Jib = req.Jib?.Trim();
            entity.Pib = req.Pib?.Trim();
            entity.Address = req.Address?.Trim();
            entity.City = req.City?.Trim();
            entity.Phone = req.Phone?.Trim();
            entity.Email = req.Email?.Trim();
            entity.IsSupplier = req.IsSupplier;
            entity.IsCustomer = req.IsCustomer;
            entity.DefaultDiscountPct = req.DefaultDiscountPct;
            entity.PaymentTermsDays = req.PaymentTermsDays;
            entity.CreditLimit = req.CreditLimit;
            entity.IsActive = req.IsActive;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("partners/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeletePartner(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Partners.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var isReferenced =
            await _db.InboundCalculations.AnyAsync(d => d.TenantId == tid && d.SupplierId == id, ct) ||
            await _db.PosReceipts.AnyAsync(r => r.TenantId == tid && r.CustomerId == id, ct);

        if (isReferenced)
        {
            return Conflict(new { message = "Partner se ne može obrisati jer ima vezane dokumente ili račune." });
        }

        _db.Partners.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("labels/clear")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> ClearLabels([FromBody] ClearLabelsRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (req.StoreId == Guid.Empty)
        {
            return BadRequest(new { message = "Poslovnica je obavezna." });
        }

        if (req.ItemIds is null || req.ItemIds.Count == 0)
        {
            return Ok(new { clearedCount = 0, message = "Nema odabranih artikala za poništavanje etiketa." });
        }

        var distinctItemIds = req.ItemIds.Where(id => id != Guid.Empty).Distinct().ToList();
        var rows = await _db.StoreItemPrices
            .Where(p => p.TenantId == tid && p.StoreId == req.StoreId && distinctItemIds.Contains(p.ItemId))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            row.NeedsLabelPrint = false;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { clearedCount = rows.Count, message = "Oznake za štampu etiketa su poništene." });
    }

    [HttpGet("label-templates")]
    public async Task<IActionResult> GetLabelTemplates([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.LabelTemplates.AsNoTracking()
            .Where(t => t.TenantId == tid)
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("label-templates")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpsertLabelTemplate([FromBody] UpsertLabelTemplateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Naziv šablona etikete je obavezan." });
        }

        if (req.WidthMm <= 0m || req.HeightMm <= 0m || req.FontScale <= 0m)
        {
            return BadRequest(new { message = "Dimenzije etikete i veličina fonta moraju biti veći od 0." });
        }

        LabelTemplate? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.LabelTemplates.FirstOrDefaultAsync(t => t.Id == req.Id.Value && t.TenantId == tid, ct);
        }

        var normalizedName = req.Name.Trim();
        var duplicateName = await _db.LabelTemplates.AnyAsync(
            t => t.TenantId == tid && t.Name.ToLower() == normalizedName.ToLower() && (entity == null || t.Id != entity.Id),
            ct);
        if (duplicateName)
        {
            return Conflict(new { message = $"Šablon etikete sa nazivom '{normalizedName}' već postoji." });
        }

        if (entity is null)
        {
            entity = new LabelTemplate
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                Name = normalizedName,
                WidthMm = req.WidthMm,
                HeightMm = req.HeightMm,
                FontScale = req.FontScale,
                ShowBarcode = req.ShowBarcode,
                ShowUnitPrice = req.ShowUnitPrice,
                ShowOrigin = req.ShowOrigin,
                ShowSku = req.ShowSku,
                IsDefault = req.IsDefault,
                CreatedAtUtc = DateTime.UtcNow
            };
            _db.LabelTemplates.Add(entity);
        }
        else
        {
            entity.Name = normalizedName;
            entity.WidthMm = req.WidthMm;
            entity.HeightMm = req.HeightMm;
            entity.FontScale = req.FontScale;
            entity.ShowBarcode = req.ShowBarcode;
            entity.ShowUnitPrice = req.ShowUnitPrice;
            entity.ShowOrigin = req.ShowOrigin;
            entity.ShowSku = req.ShowSku;
            entity.IsDefault = req.IsDefault;
        }

        if (req.IsDefault)
        {
            var otherDefaults = await _db.LabelTemplates
                .Where(t => t.TenantId == tid && t.IsDefault && t.Id != entity.Id)
                .ToListAsync(ct);
            foreach (var other in otherDefaults)
            {
                other.IsDefault = false;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("label-templates/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteLabelTemplate(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.LabelTemplates.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tid, ct);
        if (entity is null) return NotFound();

        _db.LabelTemplates.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
