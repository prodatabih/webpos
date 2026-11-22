using WebPos.Domain.Enums;

namespace WebPos.WebApi.Contracts;

public sealed record UpsertCompanyRequest(
    string Name,
    string Jib,
    string? PdvNumber,
    string Address,
    string City,
    string? BankAccount,
    string? Code = null,
    string? CurrencyCode = null,
    Guid? Id = null);

public sealed record UpsertStoreRequest(
    Guid CompanyId,
    string Code,
    string Name,
    StoreType StoreType,
    string? Address = null,
    string? City = null,
    bool IsActive = true,
    Guid? Id = null);

public sealed record UpsertCashRegisterRequest(
    Guid StoreId,
    string Code,
    string Name,
    string? FiscalDeviceId,
    bool IsActive = true,
    Guid? Id = null);

public sealed record UpsertFiscalYearRequest(
    Guid CompanyId,
    int Year,
    bool IsClosed,
    Guid? Id = null);

public sealed record UpsertVatRateRequest(
    string Code,
    string Name,
    decimal RatePercent,
    Guid? CompanyId = null,
    string? ValidFrom = null,
    bool IsActive = true,
    Guid? Id = null);

public sealed record UpsertTenantSettingRequest(
    bool AllowNegativeStock,
    bool AllowPriceChangeWithoutLeveling,
    bool AutoCreatePriceLevelingOnInbound,
    string? DefaultCurrency = "BAM");
