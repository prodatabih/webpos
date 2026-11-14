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

    [HttpGet]
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
            return BadRequest(new { message = "TenantId is required." });
        }

        if (!IsSuperAdmin && request.Role == UserRole.SuperAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username, Email and Password are required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedUsername = request.Username.Trim();

        if (await _db.Users.AnyAsync(
                u => u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == normalizedUsername.ToLower(),
                ct))
        {
            return Conflict(new { message = "Username or email already exists." });
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
            DetailsJson = $"{{\"username\":\"{user.Username}\",\"role\":\"{user.Role}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new
        {
            user.Id,
            user.TenantId,
            UserName = user.Username,
            user.Email,
            Role = user.Role.ToString(),
            user.IsActive,
            user.MustChangePassword,
            CreatedAt = user.CreatedAtUtc
        });
    }
}
