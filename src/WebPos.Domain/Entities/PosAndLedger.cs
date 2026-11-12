using WebPos.Domain.Enums;

namespace WebPos.Domain.Entities;

public class PosReceipt
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid CashRegisterId { get; set; }
    public Guid CashierUserId { get; set; }
    public Guid? CustomerId { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public string? FiscalReceiptNumber { get; set; }
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
    public DocumentStatus Status { get; set; } = DocumentStatus.Posted;
    public PaymentMethod PaymentMethod { get; set; }
    public decimal TotalNetAmount2 { get; set; }
    public decimal TotalVatAmount2 { get; set; }
    public decimal TotalGrossAmount2 { get; set; }
    public bool IsSynced { get; set; }
    public DateTime? SyncedAtUtc { get; set; }

    public Store? Store { get; set; }
    public CashRegister? CashRegister { get; set; }
    public Partner? Customer { get; set; }
    public ICollection<PosReceiptLine> Lines { get; set; } = new List<PosReceiptLine>();
    public ICollection<PosReceiptPayment> Payments { get; set; } = new List<PosReceiptPayment>();
}

public class PosReceiptLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PosReceiptId { get; set; }
    public int LineNumber { get; set; }
    public Guid ItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPriceInclVat2 { get; set; }
    public decimal DiscountPct { get; set; }
    public decimal VatRatePercent { get; set; }
    public decimal NetAmount2 { get; set; }
    public decimal VatAmount2 { get; set; }
    public decimal GrossAmount2 { get; set; }

    public PosReceipt? PosReceipt { get; set; }
    public Item? Item { get; set; }
}

public class PosReceiptPayment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PosReceiptId { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal Amount2 { get; set; }
    public string? ReferenceNumber { get; set; }

    public PosReceipt? PosReceipt { get; set; }
}

public class KepLedgerEntry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid FiscalYearId { get; set; }
    public int EntryNumber { get; set; }
    public DateTime EntryDate { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public Guid DocumentId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public LedgerDirection Direction { get; set; }
    public decimal DebitAmount2 { get; set; }
    public decimal CreditAmount2 { get; set; }
    public decimal BalanceAfter2 { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Store? Store { get; set; }
    public FiscalYear? FiscalYear { get; set; }
}

public class AuditLogEntry
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? DetailsJson { get; set; }
    public string? IpAddress { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
}

public class SyncOutboxMessage
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? StoreId { get; set; }
    public string AggregateType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAtUtc { get; set; }
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
}
