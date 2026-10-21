using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Symptoms;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/symptoms")]
public class SymptomsController(ISymptomService symptoms) : ControllerBase
{
    /// <summary>10. The symptom catalogue, optionally filtered by category.</summary>
    [HttpGet]
    public async Task<SymptomListResponse> List([FromQuery] string? category, CancellationToken ct) =>
        new(await symptoms.ListAsync(category, ct));
}
