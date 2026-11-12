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
        var entity = new Company
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            Name = req.Name.Trim(),
            Jib = req.Jib.Trim(),
            PdvNumber = req.PdvNumber?.Trim(),
            Address = req.Address.Trim(),
            City = req.City.Trim(),
            BankAccount = req.BankAccount?.Trim()
        };
        _db.Companies.Add(entity);
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
        var entity = new Store
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            CompanyId = req.CompanyId,
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            StoreType = req.StoreType
        };
        _db.Stores.Add(entity);
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
        var entity = new CashRegister
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            StoreId = req.StoreId,
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            FiscalDeviceId = req.FiscalDeviceId?.Trim()
        };
        _db.CashRegisters.Add(entity);
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
        var entity = new FiscalYear
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            CompanyId = req.CompanyId,
            Year = req.Year,
            IsClosed = req.IsClosed
        };
        _db.FiscalYears.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
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
        var entity = new VatRate
        {
            Id = Guid.NewGuid(),
            TenantId = tid,
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            RatePercent = req.RatePercent
        };
        _db.VatRates.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }

    [HttpPut("vat-rates/{id:guid}")]
    public async Task<IActionResult> UpdateVatRate(Guid id, [FromBody] UpsertVatRateRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();
        var entity = await _db.VatRates.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tid, ct);
        if (entity is null) return NotFound();
        entity.Code = req.Code.Trim();
        entity.Name = req.Name.Trim();
        entity.RatePercent = req.RatePercent;
        await _db.SaveChangesAsync(ct);
        return Ok(entity);
    }
}
