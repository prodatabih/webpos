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
    public async Task<IActionResult> CreateCompany([FromBody] UpsertCompanyRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        Company? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == req.Id.Value && c.TenantId == tid, ct);
        }

        if (entity is null)
        {
            entity = new Company
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                Name = req.Name.Trim(),
                Jib = req.Jib.Trim(),
                PdvNumber = req.PdvNumber?.Trim(),
                Address = req.Address.Trim(),
                City = req.City.Trim(),
                BankAccount = req.BankAccount?.Trim()
            };
            _db.Companies.Add(entity);
        }
        else
        {
            entity.Name = req.Name.Trim();
            entity.Jib = req.Jib.Trim();
            entity.PdvNumber = req.PdvNumber?.Trim();
            entity.Address = req.Address.Trim();
            entity.City = req.City.Trim();
            entity.BankAccount = req.BankAccount?.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("companies/{id:guid}")]
    public async Task<IActionResult> UpdateCompany(Guid id, [FromBody] UpsertCompanyRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid, ct);
        if (entity is null) return NotFound();

        entity.Name = req.Name.Trim();
        entity.Jib = req.Jib.Trim();
        entity.PdvNumber = req.PdvNumber?.Trim();
        entity.Address = req.Address.Trim();
        entity.City = req.City.Trim();
        entity.BankAccount = req.BankAccount?.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("companies/{id:guid}")]
    public async Task<IActionResult> DeleteCompany(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid, ct);
        if (entity is null) return NotFound();
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
    public async Task<IActionResult> CreateStore([FromBody] UpsertStoreRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

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

        if (entity is null)
        {
            entity = new Store
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                CompanyId = req.CompanyId,
                Code = req.Code.Trim(),
                Name = req.Name.Trim(),
                StoreType = req.StoreType
            };
            _db.Stores.Add(entity);
        }
        else
        {
            entity.CompanyId = req.CompanyId;
            entity.Code = req.Code.Trim();
            entity.Name = req.Name.Trim();
            entity.StoreType = req.StoreType;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("stores/{id:guid}")]
    public async Task<IActionResult> UpdateStore(Guid id, [FromBody] UpsertStoreRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Stores.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tid, ct);
        if (entity is null) return NotFound();
        entity.CompanyId = req.CompanyId;
        entity.Code = req.Code.Trim();
        entity.Name = req.Name.Trim();
        entity.StoreType = req.StoreType;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("stores/{id:guid}")]
    public async Task<IActionResult> DeleteStore(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.Stores.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tid, ct);
        if (entity is null) return NotFound();
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
    public async Task<IActionResult> CreateRegister([FromBody] UpsertCashRegisterRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

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

        if (entity is null)
        {
            entity = new CashRegister
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                StoreId = req.StoreId,
                Code = req.Code.Trim(),
                Name = req.Name.Trim(),
                FiscalDeviceId = req.FiscalDeviceId?.Trim()
            };
            _db.CashRegisters.Add(entity);
        }
        else
        {
            entity.StoreId = req.StoreId;
            entity.Code = req.Code.Trim();
            entity.Name = req.Name.Trim();
            entity.FiscalDeviceId = req.FiscalDeviceId?.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("registers/{id:guid}")]
    public async Task<IActionResult> UpdateRegister(Guid id, [FromBody] UpsertCashRegisterRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.CashRegisters.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);
        if (entity is null) return NotFound();
        entity.StoreId = req.StoreId;
        entity.Code = req.Code.Trim();
        entity.Name = req.Name.Trim();
        entity.FiscalDeviceId = req.FiscalDeviceId?.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpDelete("registers/{id:guid}")]
    public async Task<IActionResult> DeleteRegister(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.CashRegisters.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tid, ct);
        if (entity is null) return NotFound();
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
    public async Task<IActionResult> UpdateFiscalYear(Guid id, [FromBody] UpsertFiscalYearRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.FiscalYears.FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tid, ct);
        if (entity is null) return NotFound();
        entity.CompanyId = req.CompanyId;
        entity.Year = req.Year;
        entity.IsClosed = req.IsClosed;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPatch("fiscal-periods/{id:guid}/toggle")]
    [HttpPost("fiscal-periods/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleFiscalPeriod(Guid id, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var period = await _db.FiscalPeriods.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid, ct);
        if (period is null) return NotFound();

        period.IsLocked = !period.IsLocked;
        period.LockedAtUtc = period.IsLocked ? DateTime.UtcNow : null;
        period.LockedBy = period.IsLocked ? CurrentUsername : null;
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
    public async Task<IActionResult> CreateVatRate([FromBody] UpsertVatRateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        VatRate? entity = null;
        if (req.Id.HasValue && req.Id.Value != Guid.Empty)
        {
            entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == req.Id.Value && v.TenantId == tid, ct);
        }

        if (entity is null)
        {
            entity = new VatRate
            {
                Id = req.Id.HasValue && req.Id.Value != Guid.Empty ? req.Id.Value : Guid.NewGuid(),
                TenantId = tid,
                Code = req.Code.Trim().ToUpperInvariant(),
                Name = req.Name.Trim(),
                RatePercent = req.RatePercent
            };
            _db.VatRates.Add(entity);
        }
        else
        {
            entity.Code = req.Code.Trim().ToUpperInvariant();
            entity.Name = req.Name.Trim();
            entity.RatePercent = req.RatePercent;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("vat-rates/{id:guid}")]
    public async Task<IActionResult> UpdateVatRate(Guid id, [FromBody] UpsertVatRateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tid, ct);
        if (entity is null) return NotFound();
        entity.Code = req.Code.Trim().ToUpperInvariant();
        entity.Name = req.Name.Trim();
        entity.RatePercent = req.RatePercent;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }
}
