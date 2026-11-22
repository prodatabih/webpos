using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.WebApi.Controllers;

[Route("api/users")]
[Authorize]
public class UsersController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;
    private readonly IPasswordHasher _passwordHasher;

    public UsersController(IWebPosDbContext db, IPasswordHasher passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    public sealed record CreateUserRequest(
        string Username,
        string Email,
        string Password,
        UserRole Role,
        bool MustChangePassword = true,
        Guid? TenantId = null);

    public sealed record UpdateUserRequest(
        string Username,
        string Email,
        UserRole Role);

    public sealed record ResetUserPasswordRequest(
        string NewPassword);

    [HttpGet]
    [Authorize(Roles = $"{nameof(UserRole.SuperAdmin)},{nameof(UserRole.TenantAdmin)}")]
    public async Task<IActionResult> GetUsers([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!TryGetTenantId(out var resolvedTenantId, tenantId))
        {
            if (IsSuperAdmin)
            {
                var allUsers = await _db.Users
                    .AsNoTracking()
                    .OrderBy(u => u.Username)
                    .Select(u => new
                    {
                        u.Id,
                        u.TenantId,
                        UserName = u.Username,
                        u.Email,
                        Role = u.Role.ToString(),
                        u.IsActive,
                        u.MustChangePassword,
                        CreatedAt = u.CreatedAtUtc
                    })
                    .ToListAsync(ct);
                return Ok(allUsers);
            }
            return Forbid();
        }

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == resolvedTenantId)
            .OrderBy(u => u.Username)
            .Select(u => new
            {
                u.Id,
                u.TenantId,
                UserName = u.Username,
                u.Email,
                Role = u.Role.ToString(),
                u.IsActive,
                u.MustChangePassword,
                CreatedAt = u.CreatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(users);
    }

    [HttpPost]
    [Authorize(Roles = $"{nameof(UserRole.SuperAdmin)},{nameof(UserRole.TenantAdmin)}")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        if (!TryGetTenantId(out var resolvedTenantId, request.TenantId))
        {
            return BadRequest(new { message = "TenantId je obavezan." });
        }

        if (!IsSuperAdmin && request.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Korisničko ime, email i lozinka su obavezni." });
        }

        if (request.Password.Length < 6)
        {
            return BadRequest(new { message = "Lozinka mora imati najmanje 6 karaktera." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedUsername = request.Username.Trim();

        if (await _db.Users.AnyAsync(
                u => u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == normalizedUsername.ToLower(),
                ct))
        {
            return Conflict(new { message = "Korisničko ime ili email već postoji." });
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = resolvedTenantId,
            Username = normalizedUsername,
            Email = normalizedEmail,
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            Role = request.Role,
            IsActive = true,
            MustChangePassword = request.MustChangePassword,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Users.Add(user);
        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = resolvedTenantId,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "CREATE_USER",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                username = user.Username,
                email = user.Email,
                role = user.Role.ToString()
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, ToUserDto(user));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = $"{nameof(UserRole.SuperAdmin)},{nameof(UserRole.TenantAdmin)}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Korisničko ime i email su obavezni." });
        }

        if (!IsSuperAdmin && request.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        var user = await FindScopedUserAsync(id, ct);
        if (user is null)
        {
            return NotFound(new { message = "Korisnik nije pronađen." });
        }

        if (!IsSuperAdmin && user.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedUsername = request.Username.Trim();

        if (await _db.Users.AnyAsync(
                u => u.Id != id && (u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == normalizedUsername.ToLower()),
                ct))
        {
            return Conflict(new { message = "Korisničko ime ili email već postoji." });
        }

        var oldUsername = user.Username;
        var oldEmail = user.Email;
        var oldRole = user.Role.ToString();

        user.Username = normalizedUsername;
        user.Email = normalizedEmail;
        user.Role = request.Role;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "UPDATE_USER",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                oldUsername,
                newUsername = user.Username,
                oldEmail,
                newEmail = user.Email,
                oldRole,
                newRole = user.Role.ToString()
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(ToUserDto(user));
    }

    [HttpPatch("{id:guid}/toggle")]
    [HttpPost("{id:guid}/toggle")]
    [Authorize(Roles = $"{nameof(UserRole.SuperAdmin)},{nameof(UserRole.TenantAdmin)}")]
    public async Task<IActionResult> ToggleUser(Guid id, CancellationToken ct)
    {
        if (CurrentUserId.HasValue && CurrentUserId.Value == id)
        {
            return BadRequest(new { message = "Ne možete deaktivirati vlastiti korisnički nalog." });
        }

        var user = await FindScopedUserAsync(id, ct);
        if (user is null)
        {
            return NotFound(new { message = "Korisnik nije pronađen." });
        }

        if (!IsSuperAdmin && user.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        user.IsActive = !user.IsActive;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "TOGGLE_USER",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                username = user.Username,
                isActive = user.IsActive
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(ToUserDto(user));
    }

    [HttpPost("{id:guid}/reset-password")]
    [Authorize(Roles = $"{nameof(UserRole.SuperAdmin)},{nameof(UserRole.TenantAdmin)}")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetUserPasswordRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Nova lozinka mora imati najmanje 6 karaktera." });
        }

        var user = await FindScopedUserAsync(id, ct);
        if (user is null)
        {
            return NotFound(new { message = "Korisnik nije pronađen." });
        }

        if (!IsSuperAdmin && user.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.MustChangePassword = true;
        user.PasswordResetToken = null;
        user.PasswordResetExpiresAtUtc = null;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = CurrentUserId,
            Username = CurrentUsername,
            Action = "RESET_USER_PASSWORD",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            DetailsJson = JsonSerializer.Serialize(new
            {
                username = user.Username,
                email = user.Email
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Lozinka korisnika je uspješno resetovana." });
    }

    private async Task<User?> FindScopedUserAsync(Guid id, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        }

        if (!TryGetTenantId(out var resolvedTenantId))
        {
            return null;
        }

        return await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == resolvedTenantId, ct);
    }

    private static object ToUserDto(User user) => new
    {
        user.Id,
        user.TenantId,
        UserName = user.Username,
        user.Email,
        Role = user.Role.ToString(),
        user.IsActive,
        user.MustChangePassword,
        CreatedAt = user.CreatedAtUtc
    };
}
