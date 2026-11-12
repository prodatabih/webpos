using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.WebApi.Controllers;

[Route("api/superadmin")]
[Authorize(Roles = nameof(UserRole.SuperAdmin))]
public class SuperAdminController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;
    private readonly IPasswordHasher _passwordHasher;

    public SuperAdminController(IWebPosDbContext db, IPasswordHasher passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    public sealed record CreateTenantRequest(
        string Code,
        string Name,
        string AdminUsername,
        string AdminEmail,
        string AdminPassword);

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(CancellationToken ct)
    {
        var tenants = await _db.Tenants
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new
            {
                t.Id,
                t.Code,
                t.Name,
                t.IsActive,
                t.CreatedAtUtc,
                UserCount = t.Users.Count,
                CompanyCount = t.Companies.Count
            })
            .ToListAsync(ct);

        return Ok(tenants);
    }

    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) ||
            string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.AdminEmail) ||
            string.IsNullOrWhiteSpace(request.AdminPassword))
        {
            return BadRequest(new { message = "Code, Name, AdminEmail and AdminPassword are required." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedEmail = request.AdminEmail.Trim().ToLowerInvariant();
        var adminUsername = string.IsNullOrWhiteSpace(request.AdminUsername)
            ? normalizedEmail
            : request.AdminUsername.Trim();

        if (await _db.Tenants.AnyAsync(t => t.Code.ToUpper() == normalizedCode, ct))
        {
            return Conflict(new { message = "Tenant code already exists." });
        }

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == adminUsername.ToLower(), ct))
        {
            return Conflict(new { message = "Admin email or username already exists." });
        }

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Code = normalizedCode,
            Name = request.Name.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        var adminUser = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = adminUsername,
            Email = normalizedEmail,
            PasswordHash = _passwordHasher.HashPassword(request.AdminPassword),
            Role = UserRole.TenantAdmin,
            IsActive = true,
            MustChangePassword = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Tenants.Add(tenant);
        _db.Users.Add(adminUser);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "CREATE_TENANT",
            EntityName = nameof(Tenant),
            EntityId = tenant.Id.ToString(),
            DetailsJson = $"{{\"code\":\"{tenant.Code}\",\"adminEmail\":\"{adminUser.Email}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetTenants), new { id = tenant.Id }, new
        {
            tenant.Id,
            tenant.Code,
            tenant.Name,
            tenant.IsActive,
            tenant.CreatedAtUtc,
            AdminUser = new
            {
                adminUser.Id,
                adminUser.Username,
                adminUser.Email,
                Role = adminUser.Role.ToString()
            }
        });
    }

    [HttpPatch("tenants/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleTenant(Guid id, CancellationToken ct)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant is null)
        {
            return NotFound();
        }

        tenant.IsActive = !tenant.IsActive;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "TOGGLE_TENANT",
            EntityName = nameof(Tenant),
            EntityId = tenant.Id.ToString(),
            DetailsJson = $"{{\"isActive\":{tenant.IsActive.ToString().ToLowerInvariant()}}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { tenant.Id, tenant.Code, tenant.Name, tenant.IsActive });
    }
}
