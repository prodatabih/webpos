using WebPos.Domain.Enums;

namespace WebPos.Domain.Entities;

public class Company
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Jib { get; set; } = string.Empty;
    public string? PdvNumber { get; set; }
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string? BankAccount { get; set; }

    public Tenant? Tenant { get; set; }
    public ICollection<Store> Stores { get; set; } = new List<Store>();
    public ICollection<FiscalYear> FiscalYears { get; set; } = new List<FiscalYear>();
}

public class Store
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public StoreType StoreType { get; set; }

    public Company? Company { get; set; }
    public ICollection<CashRegister> CashRegisters { get; set; } = new List<CashRegister>();
}

public class CashRegister
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? FiscalDeviceId { get; set; }

    public Store? Store { get; set; }
}

public class FiscalYear
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public int Year { get; set; }
    public bool IsClosed { get; set; }

    public Company? Company { get; set; }
}

public class VatRate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal RatePercent { get; set; }
}
