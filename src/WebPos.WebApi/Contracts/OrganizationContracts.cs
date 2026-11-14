using WebPos.Domain.Enums;

namespace WebPos.WebApi.Contracts;

public sealed record UpsertCompanyRequest(
    string Name,
    string Jib,
    string? PdvNumber,
    string Address,
    string City,
    string? BankAccount,
    Guid? Id = null);

public sealed record UpsertStoreRequest(
    Guid CompanyId,
    string Code,
    string Name,
    StoreType StoreType,
    Guid? Id = null);

public sealed record UpsertCashRegisterRequest(
    Guid StoreId,
    string Code,
    string Name,
    string? FiscalDeviceId,
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
    Guid? Id = null);
