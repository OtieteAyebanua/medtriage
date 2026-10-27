using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

/// <summary>The practitioner registry behind the /admin console. Admin session only.</summary>
[ApiController]
[Route("api/admin/practitioners")]
[Authorize(AuthenticationSchemes = AdminAuthentication.Scheme)]
public class AdminPractitionersController(IPractitionerService practitioners) : ControllerBase
{
    /// <summary>18. Every staff account, newest first, including deactivated ones.</summary>
    [HttpGet]
    public async Task<PractitionerListResponse> List(CancellationToken ct) =>
        new(await practitioners.ListAsync(ct));

    /// <summary>19. Add a verified practitioner.</summary>
    [HttpPost]
    public async Task<ActionResult<PractitionerResponse>> Create(SavePractitionerRequest request, CancellationToken ct)
    {
        var practitioner = await practitioners.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new PractitionerResponse(practitioner));
    }

    /// <summary>20. Update details; a password in the body resets it.</summary>
    [HttpPut("{id}")]
    public async Task<PractitionerResponse> Update(int id, SavePractitionerRequest request, CancellationToken ct) =>
        new(await practitioners.UpdateAsync(id, request, ct));

    /// <summary>21. Deactivate or reactivate the account.</summary>
    [HttpPut("{id}/status")]
    public async Task<PractitionerResponse> SetStatus(int id, SetPractitionerStatusRequest request, CancellationToken ct) =>
        new(await practitioners.SetActiveAsync(id, request, ct));
}
