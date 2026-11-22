using WebPos.Domain.Enums;

namespace WebPos.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Company> Companies { get; set; } = new List<Company>();
}

public class User
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Tenant? Tenant { get; set; }
}

public class TenantSetting
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public bool AllowNegativeStock { get; set; }
    public bool AllowPriceChangeWithoutLeveling { get; set; }
    public bool AutoCreatePriceLevelingOnInbound { get; set; } = true;
    public string DefaultCurrency { get; set; } = "BAM";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
