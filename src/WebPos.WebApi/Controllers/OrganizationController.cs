using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.WebApi.Contracts;

namespace WebPos.WebApi.Controllers;

[Route("api/organization")]
[Authorize]
public class OrganizationController : ApiControllerBase
{
    private const string ManagementRoles = "SuperAdmin,TenantAdmin,Manager";
    private const string AdminRoles = "SuperAdmin,TenantAdmin";

    private readonly IWebPosDbContext _db;

    public OrganizationController(IWebPosDbContext db)
    {
        _db = db;
    }

    [HttpGet("companies")]
    public async Task<IActionResult> GetCompanies([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.Companies.AsNoTracking()
            .Where(c => c.TenantId == tid)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("companies")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateCompany([FromBody] UpsertCompanyRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Jib))
        {
            return BadRequest(new { message = "Naziv i JIB preduzeća su obavezni." });
        }

        Company? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == req.Id.Value && c.TenantId == tid, ct);
        }

        var normalizedCode = string.IsNullOrWhiteSpace(req.Code)
            ? (entity is not null && !string.IsNullOrWhiteSpace(entity.Code) ? entity.Code : req.Jib.Trim())
            : req.Code.Trim();
        var normalizedCurrency = string.IsNullOrWhiteSpace(req.CurrencyCode)
            ? (entity is not null && !string.IsNullOrWhiteSpace(entity.CurrencyCode) ? entity.CurrencyCode : "BAM")
            : req.CurrencyCode.Trim().ToUpperInvariant();

        if (entity is null)
        {
            entity = new Company
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                Code = normalizedCode,
                Name = req.Name.Trim(),
                Jib = req.Jib.Trim(),
                PdvNumber = req.PdvNumber?.Trim(),
                Address = (req.Address ?? string.Empty).Trim(),
                City = (req.City ?? string.Empty).Trim(),
                BankAccount = req.BankAccount?.Trim(),
                CurrencyCode = normalizedCurrency
            };
            _db.Companies.Add(entity);
        }
        else
        {
            entity.Code = normalizedCode;
            entity.Name = req.Name.Trim();
            entity.Jib = req.Jib.Trim();
            entity.PdvNumber = req.PdvNumber?.Trim();
            entity.Address = (req.Address ?? string.Empty).Trim();
            entity.City = (req.City ?? string.Empty).Trim();
            entity.BankAccount = req.BankAccount?.Trim();
            entity.CurrencyCode = normalizedCurrency;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("companies/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateCompany(Guid id, [FromBody] UpsertCompanyRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Jib))
        {
            return BadRequest(new { message = "Naziv i JIB preduzeća su obavezni." });
        }

        var entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid, ct);
        if (entity is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            entity.Code = req.Code.Trim();
        }
        if (!string.IsNullOrWhiteSpace(req.CurrencyCode))
        {
            entity.CurrencyCode = req.CurrencyCode.Trim().ToUpperInvariant();
        }

        entity.Name = req.Name.Trim();
        entity.Jib = req.Jib.Trim();
        entity.PdvNumber = req.PdvNumber?.Trim();
        entity.Address = (req.Address ?? string.Empty).Trim();
        entity.City = (req.City ?? string.Empty).Trim();
        entity.BankAccount = req.BankAccount?.Trim();

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("companies/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteCompany(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var hasReferences =
            await _db.Stores.AnyAsync(s => s.TenantId == tid && s.CompanyId == id, ct) ||
            await _db.FiscalYears.AnyAsync(f => f.TenantId == tid && f.CompanyId == id, ct) ||
            await _db.Items.AnyAsync(i => i.TenantId == tid && i.CompanyId == id, ct);

        if (hasReferences)
        {
            return Conflict(new { message = "Preduzeće se ne može obrisati jer ima vezane poslovnice, poslovne godine ili artikle." });
        }

        _db.Companies.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("stores")]
    public async Task<IActionResult> GetStores([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.Stores.AsNoTracking()
            .Where(s => s.TenantId == tid)
            .OrderBy(s => s.Code)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("stores")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateStore([FromBody] UpsertStoreRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv poslovnice su obavezni." });
        }

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == req.CompanyId && c.TenantId == tid, ct);
        if (!companyExists)
        {
            return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
        }

        Store? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.Stores.FirstOrDefaultAsync(s => s.Id == req.Id.Value && s.TenantId == tid, ct);
        }

        var normalizedCode = req.Code.Trim();
        var duplicateCode = await _db.Stores.AnyAsync(
            s => s.TenantId == tid && s.Code.ToLower() == normalizedCode.ToLower() && (entity == null || s.Id != entity.Id),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"Poslovnica sa šifrom '{normalizedCode}' već postoji." });
        }

        if (entity is null)
        {
            entity = new Store
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                CompanyId = req.CompanyId,
                Code = normalizedCode,
                Name = req.Name.Trim(),
                StoreType = req.StoreType,
                Address = (req.Address ?? string.Empty).Trim(),
                City = (req.City ?? string.Empty).Trim(),
                IsActive = req.IsActive
            };
            _db.Stores.Add(entity);
        }
        else
        {
            entity.CompanyId = req.CompanyId;
            entity.Code = normalizedCode;
            entity.Name = req.Name.Trim();
            entity.StoreType = req.StoreType;
            entity.Address = (req.Address ?? string.Empty).Trim();
            entity.City = (req.City ?? string.Empty).Trim();
            entity.IsActive = req.IsActive;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("stores/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateStore(Guid id, [FromBody] UpsertStoreRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv poslovnice su obavezni." });
        }

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == req.CompanyId && c.TenantId == tid, ct);
        if (!companyExists)
        {
            return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
        }

        var entity = await _db.Stores.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var normalizedCode = req.Code.Trim();
        var duplicateCode = await _db.Stores.AnyAsync(
            s => s.TenantId == tid && s.Id != id && s.Code.ToLower() == normalizedCode.ToLower(),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"Poslovnica sa šifrom '{normalizedCode}' već postoji." });
        }

        entity.CompanyId = req.CompanyId;
        entity.Code = normalizedCode;
        entity.Name = req.Name.Trim();
        entity.StoreType = req.StoreType;
        entity.Address = (req.Address ?? string.Empty).Trim();
        entity.City = (req.City ?? string.Empty).Trim();
        entity.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("stores/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteStore(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Stores.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var hasReferences =
            await _db.CashRegisters.AnyAsync(r => r.TenantId == tid && r.StoreId == id, ct) ||
            await _db.StoreItemPrices.AnyAsync(p => p.TenantId == tid && p.StoreId == id && p.StockQty != 0m, ct) ||
            await _db.InboundCalculations.AnyAsync(d => d.TenantId == tid && d.StoreId == id, ct) ||
            await _db.PriceLevelings.AnyAsync(d => d.TenantId == tid && d.StoreId == id, ct) ||
            await _db.WarehouseTransfers.AnyAsync(d => d.TenantId == tid && (d.SourceStoreId == id || d.TargetStoreId == id), ct) ||
            await _db.InventoryCounts.AnyAsync(d => d.TenantId == tid && d.StoreId == id, ct) ||
            await _db.OtherWarehouseDocuments.AnyAsync(d => d.TenantId == tid && d.StoreId == id, ct) ||
            await _db.PosReceipts.AnyAsync(r => r.TenantId == tid && r.StoreId == id, ct) ||
            await _db.KepLedgerEntries.AnyAsync(k => k.TenantId == tid && k.StoreId == id, ct) ||
            await _db.ItemBomLines.AnyAsync(b => b.TenantId == tid && b.SourceStoreId == id, ct);

        if (hasReferences)
        {
            return Conflict(new { message = "Poslovnica se ne može obrisati jer ima vezane blagajne, zalihe ili dokumente." });
        }

        var zeroStockPrices = await _db.StoreItemPrices
            .Where(p => p.TenantId == tid && p.StoreId == id)
            .ToListAsync(ct);
        if (zeroStockPrices.Count > 0)
        {
            _db.StoreItemPrices.RemoveRange(zeroStockPrices);
        }

        _db.Stores.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("registers")]
    public async Task<IActionResult> GetRegisters([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.CashRegisters.AsNoTracking()
            .Where(r => r.TenantId == tid)
            .OrderBy(r => r.Code)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("registers")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateRegister([FromBody] UpsertCashRegisterRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv blagajne su obavezni." });
        }

        var storeExists = await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct);
        if (!storeExists)
        {
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });
        }

        CashRegister? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.CashRegisters.FirstOrDefaultAsync(r => r.Id == req.Id.Value && r.TenantId == tid, ct);
        }

        var normalizedCode = req.Code.Trim();
        var duplicateCode = await _db.CashRegisters.AnyAsync(
            r => r.TenantId == tid && r.Code.ToLower() == normalizedCode.ToLower() && (entity == null || r.Id != entity.Id),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"Blagajna sa šifrom '{normalizedCode}' već postoji." });
        }

        if (entity is null)
        {
            entity = new CashRegister
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                StoreId = req.StoreId,
                Code = normalizedCode,
                Name = req.Name.Trim(),
                FiscalDeviceId = req.FiscalDeviceId?.Trim(),
                IsActive = req.IsActive
            };
            _db.CashRegisters.Add(entity);
        }
        else
        {
            entity.StoreId = req.StoreId;
            entity.Code = normalizedCode;
            entity.Name = req.Name.Trim();
            entity.FiscalDeviceId = req.FiscalDeviceId?.Trim();
            entity.IsActive = req.IsActive;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("registers/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateRegister(Guid id, [FromBody] UpsertCashRegisterRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv blagajne su obavezni." });
        }

        var storeExists = await _db.Stores.AnyAsync(s => s.Id == req.StoreId && s.TenantId == tid, ct);
        if (!storeExists)
        {
            return BadRequest(new { message = "Odabrana poslovnica ne postoji u bazi." });
        }

        var entity = await _db.CashRegisters.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var normalizedCode = req.Code.Trim();
        var duplicateCode = await _db.CashRegisters.AnyAsync(
            r => r.TenantId == tid && r.Id != id && r.Code.ToLower() == normalizedCode.ToLower(),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"Blagajna sa šifrom '{normalizedCode}' već postoji." });
        }

        entity.StoreId = req.StoreId;
        entity.Code = normalizedCode;
        entity.Name = req.Name.Trim();
        entity.FiscalDeviceId = req.FiscalDeviceId?.Trim();
        entity.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("registers/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteRegister(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.CashRegisters.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var hasReceipts = await _db.PosReceipts.AnyAsync(r => r.TenantId == tid && r.CashRegisterId == id, ct);
        if (hasReceipts)
        {
            return Conflict(new { message = "Blagajna se ne može obrisati jer ima izdate fiskalne račune." });
        }

        _db.CashRegisters.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("fiscal-years")]
    public async Task<IActionResult> GetFiscalYears([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.FiscalYears.AsNoTracking()
            .Where(f => f.TenantId == tid)
            .OrderByDescending(f => f.Year)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("fiscal-years")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateFiscalYear([FromBody] UpsertFiscalYearRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == req.CompanyId && c.TenantId == tid, ct);
        if (!companyExists)
        {
            return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
        }

        if (req.Year < 2000 || req.Year > 2100)
        {
            return BadRequest(new { message = "Neispravna poslovna godina." });
        }

        var existsYear = await _db.FiscalYears.AnyAsync(
            f => f.TenantId == tid && f.CompanyId == req.CompanyId && f.Year == req.Year, ct);
        if (existsYear)
        {
            return Conflict(new { message = $"Poslovna godina {req.Year} već postoji za ovo preduzeće." });
        }

        var entity = new FiscalYear
        {
            Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
            TenantId = tid,
            CompanyId = req.CompanyId,
            Year = req.Year,
            IsClosed = req.IsClosed
        };
        _db.FiscalYears.Add(entity);

        string[] monthNames =
        [
            "Januar", "Februar", "Mart", "April", "Maj", "Juni",
            "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
        ];

        var periods = new List<FiscalPeriod>(12);
        for (var m = 1; m <= 12; m++)
        {
            var start = new DateTime(req.Year, m, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(req.Year, m, DateTime.DaysInMonth(req.Year, m), 0, 0, 0, DateTimeKind.Utc);
            var period = new FiscalPeriod
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                CompanyId = req.CompanyId,
                FiscalYearId = entity.Id,
                Month = m,
                Name = $"{monthNames[m - 1]} {req.Year}",
                StartDate = start,
                EndDate = end,
                IsLocked = false
            };
            periods.Add(period);
            _db.FiscalPeriods.Add(period);
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            fiscalYear = new
            {
                entity.Id,
                entity.CompanyId,
                entity.Year,
                StartDate = $"{entity.Year}-01-01",
                EndDate = $"{entity.Year}-12-31",
                entity.IsClosed,
                IsLocked = entity.IsClosed
            },
            periods = periods.Select(p => new
            {
                p.Id,
                p.CompanyId,
                p.FiscalYearId,
                p.Month,
                p.Name,
                StartDate = p.StartDate.ToString("yyyy-MM-dd"),
                EndDate = p.EndDate.ToString("yyyy-MM-dd"),
                p.IsLocked,
                LockedAt = p.LockedAtUtc,
                p.LockedBy
            })
        });
    }

    [HttpPut("fiscal-years/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateFiscalYear(Guid id, [FromBody] UpsertFiscalYearRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        if (req.Year < 2000 || req.Year > 2100)
        {
            return BadRequest(new { message = "Neispravna poslovna godina." });
        }

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == req.CompanyId && c.TenantId == tid, ct);
        if (!companyExists)
        {
            return BadRequest(new { message = "Odabrano preduzeće ne postoji u bazi." });
        }

        var entity = await _db.FiscalYears.FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var existsYear = await _db.FiscalYears.AnyAsync(
            f => f.TenantId == tid && f.Id != id && f.CompanyId == req.CompanyId && f.Year == req.Year, ct);
        if (existsYear)
        {
            return Conflict(new { message = $"Poslovna godina {req.Year} već postoji za ovo preduzeće." });
        }

        entity.CompanyId = req.CompanyId;
        entity.Year = req.Year;
        entity.IsClosed = req.IsClosed;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("fiscal-years/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteFiscalYear(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.FiscalYears.FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var hasDocuments =
            await _db.InboundCalculations.AnyAsync(d => d.TenantId == tid && d.FiscalYearId == id, ct) ||
            await _db.PriceLevelings.AnyAsync(d => d.TenantId == tid && d.FiscalYearId == id, ct) ||
            await _db.WarehouseTransfers.AnyAsync(d => d.TenantId == tid && d.FiscalYearId == id, ct) ||
            await _db.InventoryCounts.AnyAsync(d => d.TenantId == tid && d.FiscalYearId == id, ct) ||
            await _db.OtherWarehouseDocuments.AnyAsync(d => d.TenantId == tid && d.FiscalYearId == id, ct) ||
            await _db.PosReceipts.AnyAsync(r => r.TenantId == tid && r.FiscalYearId == id, ct) ||
            await _db.KepLedgerEntries.AnyAsync(k => k.TenantId == tid && k.FiscalYearId == id, ct);

        if (hasDocuments)
        {
            return Conflict(new { message = "Poslovna godina se ne može obrisati jer ima proknjižene ili snimljene dokumente." });
        }

        var periods = await _db.FiscalPeriods
            .Where(p => p.TenantId == tid && p.FiscalYearId == id)
            .ToListAsync(ct);
        if (periods.Count > 0)
        {
            _db.FiscalPeriods.RemoveRange(periods);
        }

        _db.FiscalYears.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("fiscal-years/{id:guid}/toggle-lock")]
    [HttpPost("fiscal-years/{id:guid}/toggle-lock")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> ToggleFiscalYearLock(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.FiscalYears.FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tid, ct);
        if (entity is null) return NotFound();

        entity.IsClosed = !entity.IsClosed;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "TOGGLE_FISCAL_YEAR_LOCK",
            EntityName = nameof(FiscalYear),
            EntityId = entity.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                companyId = entity.CompanyId,
                year = entity.Year,
                isClosed = entity.IsClosed
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            entity.Id,
            entity.CompanyId,
            entity.Year,
            StartDate = $"{entity.Year}-01-01",
            EndDate = $"{entity.Year}-12-31",
            entity.IsClosed,
            IsLocked = entity.IsClosed
        });
    }

    [HttpPatch("fiscal-periods/{id:guid}/toggle")]
    [HttpPost("fiscal-periods/{id:guid}/toggle")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> ToggleFiscalPeriod(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var period = await _db.FiscalPeriods.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid, ct);
        if (period is null) return NotFound();

        period.IsLocked = !period.IsLocked;
        period.LockedAtUtc = period.IsLocked ? DateTime.UtcNow : null;
        period.LockedBy = period.IsLocked ? CurrentUsername : null;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "TOGGLE_FISCAL_PERIOD",
            EntityName = nameof(FiscalPeriod),
            EntityId = period.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                fiscalYearId = period.FiscalYearId,
                month = period.Month,
                name = period.Name,
                isLocked = period.IsLocked
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            period.Id,
            period.CompanyId,
            period.FiscalYearId,
            period.Month,
            period.Name,
            StartDate = period.StartDate.ToString("yyyy-MM-dd"),
            EndDate = period.EndDate.ToString("yyyy-MM-dd"),
            period.IsLocked,
            LockedAt = period.LockedAtUtc,
            period.LockedBy
        });
    }

    [HttpGet("vat-rates")]
    public async Task<IActionResult> GetVatRates([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();
        var list = await _db.VatRates.AsNoTracking()
            .Where(v => v.TenantId == tid)
            .OrderBy(v => v.Code)
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("vat-rates")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> CreateVatRate([FromBody] UpsertVatRateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv PDV stope su obavezni." });
        }

        if (req.RatePercent < 0m || req.RatePercent > 100m)
        {
            return BadRequest(new { message = "PDV stopa mora biti u rasponu od 0 do 100%." });
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

        VatRate? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == req.Id.Value && v.TenantId == tid, ct);
        }

        var normalizedCode = req.Code.Trim().ToUpperInvariant();
        var duplicateCode = await _db.VatRates.AnyAsync(
            v => v.TenantId == tid && v.Code.ToUpper() == normalizedCode && (entity == null || v.Id != entity.Id),
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"PDV stopa sa šifrom '{normalizedCode}' već postoji." });
        }

        var validFrom = string.IsNullOrWhiteSpace(req.ValidFrom) ? "2026-01-01" : req.ValidFrom.Trim();

        if (entity is null)
        {
            entity = new VatRate
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                CompanyId = normalizedCompanyId,
                Code = normalizedCode,
                Name = req.Name.Trim(),
                RatePercent = req.RatePercent,
                ValidFrom = validFrom,
                IsActive = req.IsActive
            };
            _db.VatRates.Add(entity);
        }
        else
        {
            entity.CompanyId = normalizedCompanyId;
            entity.Code = normalizedCode;
            entity.Name = req.Name.Trim();
            entity.RatePercent = req.RatePercent;
            entity.ValidFrom = validFrom;
            entity.IsActive = req.IsActive;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("vat-rates/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> UpdateVatRate(Guid id, [FromBody] UpsertVatRateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Šifra i naziv PDV stope su obavezni." });
        }

        if (req.RatePercent < 0m || req.RatePercent > 100m)
        {
            return BadRequest(new { message = "PDV stopa mora biti u rasponu od 0 do 100%." });
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

        var entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var normalizedCode = req.Code.Trim().ToUpperInvariant();
        var duplicateCode = await _db.VatRates.AnyAsync(
            v => v.TenantId == tid && v.Id != id && v.Code.ToUpper() == normalizedCode,
            ct);
        if (duplicateCode)
        {
            return Conflict(new { message = $"PDV stopa sa šifrom '{normalizedCode}' već postoji." });
        }

        entity.CompanyId = normalizedCompanyId;
        entity.Code = normalizedCode;
        entity.Name = req.Name.Trim();
        entity.RatePercent = req.RatePercent;
        entity.ValidFrom = string.IsNullOrWhiteSpace(req.ValidFrom) ? entity.ValidFrom : req.ValidFrom.Trim();
        entity.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("vat-rates/{id:guid}")]
    [Authorize(Roles = ManagementRoles)]
    public async Task<IActionResult> DeleteVatRate(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tid, ct);
        if (entity is null) return NotFound();

        var isUsed = await _db.Items.AnyAsync(i => i.TenantId == tid && i.VatRateId == id, ct);
        if (isUsed)
        {
            return Conflict(new { message = "PDV stopa se ne može obrisati jer je dodijeljena artiklima." });
        }

        _db.VatRates.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("tenant-settings")]
    public async Task<IActionResult> GetTenantSettings([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var setting = await _db.TenantSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tid, ct);

        if (setting is null)
        {
            return Ok(new TenantSetting
            {
                Id = Guid.Empty,
                TenantId = tid,
                AllowNegativeStock = false,
                AllowPriceChangeWithoutLeveling = false,
                AutoCreatePriceLevelingOnInbound = true,
                DefaultCurrency = "BAM",
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        return Ok(setting);
    }

    [HttpPut("tenant-settings")]
    [HttpPost("tenant-settings")]
    [Authorize(Roles = AdminRoles)]
    public async Task<IActionResult> UpsertTenantSettings(
        [FromBody] UpsertTenantSettingRequest req,
        [FromQuery] Guid? tenantId,
        CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var currency = string.IsNullOrWhiteSpace(req.DefaultCurrency)
            ? "BAM"
            : req.DefaultCurrency.Trim().ToUpperInvariant();

        var setting = await _db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tid, ct);
        if (setting is null)
        {
            setting = new TenantSetting
            {
                Id = Guid.NewGuid(),
                TenantId = tid,
                AllowNegativeStock = req.AllowNegativeStock,
                AllowPriceChangeWithoutLeveling = req.AllowPriceChangeWithoutLeveling,
                AutoCreatePriceLevelingOnInbound = req.AutoCreatePriceLevelingOnInbound,
                DefaultCurrency = currency,
                UpdatedAtUtc = DateTime.UtcNow
            };
            _db.TenantSettings.Add(setting);
        }
        else
        {
            setting.AllowNegativeStock = req.AllowNegativeStock;
            setting.AllowPriceChangeWithoutLeveling = req.AllowPriceChangeWithoutLeveling;
            setting.AutoCreatePriceLevelingOnInbound = req.AutoCreatePriceLevelingOnInbound;
            setting.DefaultCurrency = currency;
            setting.UpdatedAtUtc = DateTime.UtcNow;
        }

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "UPDATE_TENANT_SETTINGS",
            EntityName = nameof(TenantSetting),
            EntityId = setting.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                allowNegativeStock = setting.AllowNegativeStock,
                allowPriceChangeWithoutLeveling = setting.AllowPriceChangeWithoutLeveling,
                autoCreatePriceLevelingOnInbound = setting.AutoCreatePriceLevelingOnInbound,
                defaultCurrency = setting.DefaultCurrency
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(setting);
    }
}
