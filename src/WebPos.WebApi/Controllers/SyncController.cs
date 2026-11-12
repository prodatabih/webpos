using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebPos.Application.Interfaces;
using WebPos.Domain.Entities;

namespace WebPos.WebApi.Controllers;

[Route("api/sync")]
[Authorize]
public class SyncController : ApiControllerBase
{
    private readonly IWebPosDbContext _db;

    public SyncController(IWebPosDbContext db)
    {
        _db = db;
    }

    public sealed record PushOutboxRequest(List<SyncOutboxMessageDto> Messages);

    public sealed record SyncOutboxMessageDto(
        Guid Id,
        Guid? StoreId,
        string AggregateType,
        Guid AggregateId,
        string EventType,
        string PayloadJson,
        DateTime CreatedAtUtc);

    [HttpGet("pull")]
    public async Task<IActionResult> Pull(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? storeId,
        [FromQuery] DateTime? sinceUtc,
        CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid, tenantId)) return Forbid();

        var items = await _db.Items.AsNoTracking()
            .Where(i => i.TenantId == tid)
            .ToListAsync(ct);

        var pricesQuery = _db.StoreItemPrices.AsNoTracking()
            .Where(p => p.TenantId == tid);
        if (storeId.HasValue) pricesQuery = pricesQuery.Where(p => p.StoreId == storeId.Value);
        var prices = await pricesQuery.ToListAsync(ct);

        var vatRates = await _db.VatRates.AsNoTracking()
            .Where(v => v.TenantId == tid)
            .ToListAsync(ct);

        var outboxQuery = _db.SyncOutboxMessages.AsNoTracking()
            .Where(m => m.TenantId == tid);
        if (sinceUtc.HasValue) outboxQuery = outboxQuery.Where(m => m.CreatedAtUtc >= sinceUtc.Value);
        var outbox = await outboxQuery
            .OrderBy(m => m.CreatedAtUtc)
            .Take(500)
            .ToListAsync(ct);

        return Ok(new
        {
            ServerTimeUtc = DateTime.UtcNow,
            Items = items,
            StoreItemPrices = prices,
            VatRates = vatRates,
            OutboxMessages = outbox
        });
    }

    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] PushOutboxRequest req, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tid)) return Forbid();

        var acceptedIds = new List<Guid>();
        foreach (var msg in req.Messages)
        {
            var exists = await _db.SyncOutboxMessages
                .AnyAsync(m => m.Id == msg.Id && m.TenantId == tid, ct);
            if (exists)
            {
                acceptedIds.Add(msg.Id);
                continue;
            }

            _db.SyncOutboxMessages.Add(new SyncOutboxMessage
            {
                Id = msg.Id == Guid.Empty ? Guid.NewGuid() : msg.Id,
                TenantId = tid,
                StoreId = msg.StoreId,
                AggregateType = msg.AggregateType,
                AggregateId = msg.AggregateId,
                EventType = msg.EventType,
                PayloadJson = msg.PayloadJson,
                CreatedAtUtc = msg.CreatedAtUtc == default ? DateTime.UtcNow : msg.CreatedAtUtc,
                ProcessedAtUtc = DateTime.UtcNow
            });
            acceptedIds.Add(msg.Id);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { AcceptedIds = acceptedIds, ServerTimeUtc = DateTime.UtcNow });
    }
}
