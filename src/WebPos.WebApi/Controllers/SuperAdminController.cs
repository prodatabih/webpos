using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.WebApi.Controllers;

[Route("api/superadmin")]
[Route("api/admin")]
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
        string AdminEmail,
        string AdminPassword,
        string? AdminUsername = null);

    public sealed record UpdateTenantRequest(
        string Code,
        string Name);

    public sealed record ResetTenantAdminPasswordRequest(
        string NewPassword);

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
                CreatedAt = t.CreatedAtUtc,
                AdminEmail = t.Users.Where(u => u.Role == UserRole.TenantAdmin).Select(u => u.Email).FirstOrDefault(),
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
            return BadRequest(new { message = "Šifra, naziv, email administratora i lozinka su obavezni." });
        }

        if (request.AdminPassword.Length < 6)
        {
            return BadRequest(new { message = "Lozinka administratora mora imati najmanje 6 karaktera." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedEmail = request.AdminEmail.Trim().ToLowerInvariant();
        var adminUsername = string.IsNullOrWhiteSpace(request.AdminUsername)
            ? normalizedEmail
            : request.AdminUsername.Trim();

        if (await _db.Tenants.AnyAsync(t => t.Code.ToUpper() == normalizedCode, ct))
        {
            return Conflict(new { message = "Šifra tenanta već postoji." });
        }

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == adminUsername.ToLower(), ct))
        {
            return Conflict(new { message = "Email ili korisničko ime administratora već postoji." });
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
            DetailsJson = JsonSerializer.Serialize(new
            {
                code = tenant.Code,
                name = tenant.Name,
                adminEmail = adminUser.Email
            }),
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
            CreatedAt = tenant.CreatedAtUtc,
            AdminEmail = adminUser.Email,
            UserCount = 1,
            CompanyCount = 0,
            AdminUser = new
            {
                adminUser.Id,
                UserName = adminUser.Username,
                adminUser.Email,
                Role = adminUser.Role.ToString()
            }
        });
    }

    [HttpPut("tenants/{id:guid}")]
    public async Task<IActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Šifra i naziv tenanta su obavezni." });
        }

        var tenant = await _db.Tenants
            .Include(t => t.Users)
            .Include(t => t.Companies)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (tenant is null)
        {
            return NotFound(new { message = "Tenant nije pronađen." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        if (await _db.Tenants.AnyAsync(t => t.Id != id && t.Code.ToUpper() == normalizedCode, ct))
        {
            return Conflict(new { message = "Šifra tenanta već postoji." });
        }

        var oldCode = tenant.Code;
        var oldName = tenant.Name;
        tenant.Code = normalizedCode;
        tenant.Name = request.Name.Trim();

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "UPDATE_TENANT",
            EntityName = nameof(Tenant),
            EntityId = tenant.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                oldCode,
                newCode = tenant.Code,
                oldName,
                newName = tenant.Name
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        var adminEmail = tenant.Users
            .Where(u => u.Role == UserRole.TenantAdmin)
            .Select(u => u.Email)
            .FirstOrDefault();

        return Ok(new
        {
            tenant.Id,
            tenant.Code,
            tenant.Name,
            tenant.IsActive,
            CreatedAt = tenant.CreatedAtUtc,
            AdminEmail = adminEmail,
            UserCount = tenant.Users.Count,
            CompanyCount = tenant.Companies.Count
        });
    }

    [HttpPatch("tenants/{id:guid}/toggle")]
    [HttpPost("tenants/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleTenant(Guid id, CancellationToken ct)
    {
        var tenant = await _db.Tenants
            .Include(t => t.Users)
            .Include(t => t.Companies)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (tenant is null)
        {
            return NotFound(new { message = "Tenant nije pronađen." });
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
            DetailsJson = JsonSerializer.Serialize(new
            {
                code = tenant.Code,
                isActive = tenant.IsActive
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        var adminEmail = tenant.Users
            .Where(u => u.Role == UserRole.TenantAdmin)
            .Select(u => u.Email)
            .FirstOrDefault();

        return Ok(new
        {
            tenant.Id,
            tenant.Code,
            tenant.Name,
            tenant.IsActive,
            CreatedAt = tenant.CreatedAtUtc,
            AdminEmail = adminEmail,
            UserCount = tenant.Users.Count,
            CompanyCount = tenant.Companies.Count
        });
    }

    [HttpPost("tenants/{id:guid}/reset-admin-password")]
    public async Task<IActionResult> ResetAdminPassword(Guid id, [FromBody] ResetTenantAdminPasswordRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Nova lozinka mora imati najmanje 6 karaktera." });
        }

        var tenantExists = await _db.Tenants.AnyAsync(t => t.Id == id, ct);
        if (!tenantExists)
        {
            return NotFound(new { message = "Tenant nije pronađen." });
        }

        var adminUser = await _db.Users
            .FirstOrDefaultAsync(u => u.TenantId == id && u.Role == UserRole.TenantAdmin, ct);

        if (adminUser is null)
        {
            return NotFound(new { message = "Administrator tenanta nije pronađen." });
        }

        adminUser.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        adminUser.MustChangePassword = true;
        adminUser.PasswordResetToken = null;
        adminUser.PasswordResetExpiresAtUtc = null;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = id,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "RESET_TENANT_ADMIN_PASSWORD",
            EntityName = nameof(Domain.Entities.User),
            EntityId = adminUser.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                tenantId = id,
                adminUserId = adminUser.Id,
                adminEmail = adminUser.Email
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Lozinka administratora tenanta je resetovana." });
    }
}
