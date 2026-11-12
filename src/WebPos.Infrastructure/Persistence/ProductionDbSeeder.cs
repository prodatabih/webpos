using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;
using WebPos.Domain.Enums;

namespace WebPos.Infrastructure.Persistence;

public static class ProductionDbSeeder
{
    public static async Task SeedAsync(
        WebPosDbContext db,
        IPasswordHasher passwordHasher,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);

        var hasSuperAdmin = await db.Users
            .AnyAsync(u => u.Role == UserRole.SuperAdmin, cancellationToken);

        if (hasSuperAdmin)
        {
            return;
        }

        var configuredPassword = configuration["Seed:SuperAdminPassword"];
        var initialPassword = string.IsNullOrWhiteSpace(configuredPassword)
            ? "Admin123!"
            : configuredPassword;

        var superAdmin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = null,
            Username = "superadmin",
            Email = "superadmin@webpos.ba",
            PasswordHash = passwordHasher.HashPassword(initialPassword),
            Role = UserRole.SuperAdmin,
            IsActive = true,
            MustChangePassword = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.Users.Add(superAdmin);
        await db.SaveChangesAsync(cancellationToken);
    }
}
