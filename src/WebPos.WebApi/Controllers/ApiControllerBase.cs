using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using WebPos.Domain.Enums;

namespace WebPos.WebApi.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid? CurrentUserId
    {
        get
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    protected Guid? CurrentTenantId
    {
        get
        {
            var raw = User.FindFirstValue("tenant_id")
                      ?? User.FindFirstValue("tenantId");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    protected string CurrentUsername =>
        User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue("unique_name")
        ?? User.FindFirstValue(ClaimTypes.Email)
        ?? "system";

    protected string CurrentRole =>
        User.FindFirstValue(ClaimTypes.Role)
        ?? User.FindFirstValue("role")
        ?? string.Empty;

    protected bool IsSuperAdmin =>
        string.Equals(CurrentRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);

    protected bool TryGetTenantId(out Guid tenantId, Guid? overrideTenantId = null)
    {
        if (IsSuperAdmin && overrideTenantId.HasValue && overrideTenantId.Value != Guid.Empty)
        {
            tenantId = overrideTenantId.Value;
            return true;
        }

        if (CurrentTenantId.HasValue && CurrentTenantId.Value != Guid.Empty)
        {
            tenantId = CurrentTenantId.Value;
            return true;
        }

        tenantId = Guid.Empty;
        return false;
    }
}
