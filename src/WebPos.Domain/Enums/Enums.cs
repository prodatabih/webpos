namespace WebPos.Domain.Enums;

public enum UserRole
{
    SuperAdmin = 1,
    TenantAdmin = 2,
    Manager = 3,
    Cashier = 4,
    Accountant = 5
}

public enum StoreType
{
    Retail = 1,
    Wholesale = 2,
    RawMaterial = 3
}

public enum DocumentStatus
{
    Draft = 1,
    Posted = 2,
    Canceled = 3
}

public enum ItemType
{
    Goods = 1,
    RawMaterial = 2,
    Service = 3,
    Manufactured = 4
}

public enum PaymentMethod
{
    Cash = 1,
    Card = 2,
    BankTransfer = 3,
    Mixed = 4
}

public enum LedgerDirection
{
    Debit = 1,
    Credit = 2
}
