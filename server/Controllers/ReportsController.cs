using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Reports;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController(IReportService reports) : ControllerBase
{
    /// <summary>14. Ward overview: counts per triage level, review stats and recent activity.</summary>
    [HttpGet("ward")]
    public Task<WardReportDto> Ward([FromQuery] int? days, CancellationToken ct) =>
        reports.GetWardReportAsync(days, ct);
}
