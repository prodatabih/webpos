using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;

namespace WebPos.WebApi.Controllers;

[Route("api/auth")]
public class AuthController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthController(
        IWebPosDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    public sealed record LoginRequest(string? UsernameOrEmail, string? Email, string Password);

    public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var identifier = (request.UsernameOrEmail ?? request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Credentials are required." });
        }

        var normalized = identifier.ToLowerInvariant();
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(
                u => u.Email.ToLower() == normalized || u.Username.ToLower() == normalized,
                ct);

        if (user is null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid credentials." });
        }

        if (!user.IsActive)
        {
            return Forbid();
        }

        if (user.Tenant is not null && !user.Tenant.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Tenant is inactive." });
        }

        var token = _jwtTokenService.GenerateToken(user);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = user.Id,
            Username = user.Username,
            Action = "LOGIN",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            token,
            user = new
            {
                user.Id,
                user.TenantId,
                TenantCode = user.Tenant?.Code,
                TenantName = user.Tenant?.Name,
                UserName = user.Username,
                user.Email,
                Role = user.Role.ToString(),
                user.MustChangePassword
            }
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        if (!CurrentUserId.HasValue)
        {
            return Unauthorized();
        }

        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == CurrentUserId.Value, ct);

        if (user is null || !user.IsActive)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            user.Id,
            user.TenantId,
            TenantCode = user.Tenant?.Code,
            TenantName = user.Tenant?.Name,
            UserName = user.Username,
            user.Email,
            Role = user.Role.ToString(),
            user.IsActive,
            user.MustChangePassword,
            CreatedAt = user.CreatedAtUtc
        });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        if (!CurrentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "New password must be at least 6 characters." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == CurrentUserId.Value, ct);
        if (user is null)
        {
            return NotFound();
        }

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.MustChangePassword = false;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = user.Id,
            Username = user.Username,
            Action = "CHANGE_PASSWORD",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Password updated." });
    }
}
