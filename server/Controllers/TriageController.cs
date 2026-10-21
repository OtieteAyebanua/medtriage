using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Triage;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/triage")]
public class TriageController(ITriageService triage) : ControllerBase
{
    /// <summary>11. Run the AI on an assessment, save it, and add it to the review queue.</summary>
    [HttpPost]
    public Task<TriageResponse> Run(RunTriageRequest request, CancellationToken ct) =>
        triage.RunAsync(request, User.GetUserId(), ct);
}
