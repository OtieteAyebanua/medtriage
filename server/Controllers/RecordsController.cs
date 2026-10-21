using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Records;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/records")]
public class RecordsController(IRecordService records) : ControllerBase
{
    /// <summary>12. Assessments waiting for a doctor.</summary>
    [HttpGet("queue")]
    public async Task<QueueResponse> Queue(CancellationToken ct) =>
        new(await records.GetQueueAsync(ct));

    /// <summary>13. Doctor sign-off on an AI triage.</summary>
    [HttpPut("{id}/review")]
    [Authorize(Roles = "doctor")]
    public async Task<ReviewResponse> Review(int id, ReviewRequest request, CancellationToken ct) =>
        new(true, await records.ReviewAsync(id, request, User.GetUserId(), ct));
}
