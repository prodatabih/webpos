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

    public sealed record ForgotPasswordRequest(string? EmailOrUsername = null, string? Email = null, string? UsernameOrEmail = null);

    public sealed record ResetPasswordRequest(string? EmailOrUsername = null, string? Email = null, string? ResetCode = null, string? NewPassword = null);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var identifier = (request.UsernameOrEmail ?? request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Korisničko ime/email i lozinka su obavezni." });
        }

        var normalized = identifier.ToLowerInvariant();
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(
                u => u.Email.ToLower() == normalized || u.Username.ToLower() == normalized,
                ct);

        if (user is null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Neispravni pristupni podaci." });
        }

        if (!user.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Korisnički nalog je deaktiviran." });
        }

        if (user.Tenant is not null && !user.Tenant.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Tenant je deaktiviran." });
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

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        var identifier = (request.EmailOrUsername ?? request.Email ?? request.UsernameOrEmail ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return BadRequest(new { message = "Email ili korisničko ime je obavezno." });
        }

        var normalized = identifier.ToLowerInvariant();
        var user = await _db.Users
            .FirstOrDefaultAsync(
                u => u.IsActive && (u.Email.ToLower() == normalized || u.Username.ToLower() == normalized),
                ct);

        if (user is null)
        {
            return NotFound(new { message = "Korisnik sa unesenim emailom ili korisničkim imenom nije pronađen." });
        }

        const int expiresInMinutes = 30;
        var code = Random.Shared.Next(100000, 1000000).ToString();
        user.PasswordResetToken = code;
        user.PasswordResetExpiresAtUtc = DateTime.UtcNow.AddMinutes(expiresInMinutes);

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = user.Id,
            Username = user.Username,
            Action = "FORGOT_PASSWORD",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message = "Kod za reset lozinke je generisan.",
            resetCode = code,
            expiresInMinutes
        });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var identifier = (request.EmailOrUsername ?? request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return BadRequest(new { message = "Email ili korisničko ime je obavezno." });
        }

        var resetCode = (request.ResetCode ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(resetCode))
        {
            return BadRequest(new { message = "Kod za reset lozinke je obavezan." });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Nova lozinka mora imati najmanje 6 karaktera." });
        }

        var normalized = identifier.ToLowerInvariant();
        var user = await _db.Users
            .FirstOrDefaultAsync(
                u => u.IsActive && (u.Email.ToLower() == normalized || u.Username.ToLower() == normalized),
                ct);

        if (user is null)
        {
            return NotFound(new { message = "Korisnik sa unesenim emailom ili korisničkim imenom nije pronađen." });
        }

        if (!string.Equals(user.PasswordResetToken, resetCode, StringComparison.Ordinal) ||
            !user.PasswordResetExpiresAtUtc.HasValue ||
            user.PasswordResetExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Kod za reset lozinke je neispravan ili je istekao." });
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.MustChangePassword = false;
        user.PasswordResetToken = null;
        user.PasswordResetExpiresAtUtc = null;

        _db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            UserId = user.Id,
            Username = user.Username,
            Action = "RESET_PASSWORD",
            EntityName = nameof(Domain.Entities.User),
            EntityId = user.Id.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            OccurredAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Lozinka je uspješno promijenjena." });
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
            return BadRequest(new { message = "Nova lozinka mora imati najmanje 6 karaktera." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == CurrentUserId.Value, ct);
        if (user is null)
        {
            return NotFound();
        }

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Trenutna lozinka nije ispravna." });
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
        return Ok(new { message = "Lozinka je uspješno promijenjena." });
    }
}
