using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Patients;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/patients")]
public class PatientsController(IPatientService patients) : ControllerBase
{
    /// <summary>4. Patient registry with each patient's 3 most recent visits.</summary>
    [HttpGet]
    public async Task<PatientListResponse> List([FromQuery] string? q, CancellationToken ct) =>
        new(await patients.ListAsync(q, ct));

    /// <summary>5. Register a new patient.</summary>
    [HttpPost]
    public async Task<ActionResult<PatientResponse>> Create(CreatePatientRequest request, CancellationToken ct)
    {
        var patient = await patients.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new PatientResponse(true, patient));
    }

    /// <summary>6. Profile and full visit history.</summary>
    [HttpGet("{id}")]
    public Task<PatientHistoryDto> History(int id, CancellationToken ct) =>
        patients.GetHistoryAsync(id, ct);

    /// <summary>7. Upload or replace the photo (multipart field "photo").</summary>
    [HttpPost("{id}/photo")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<PatientResponse> UploadPhoto(int id, IFormFile? photo, CancellationToken ct)
    {
        if (photo is null) throw ApiException.BadRequest("Attach an image in the \"photo\" field", "photo");

        await using var stream = photo.OpenReadStream();
        return new PatientResponse(true, await patients.UploadPhotoAsync(id, stream, photo.Length, ct));
    }

    /// <summary>8. The photo itself, for &lt;img src&gt;. The URL changes on every upload, so it can be cached forever.</summary>
    [HttpGet("{id}/photo")]
    public async Task<IActionResult> GetPhoto(int id, CancellationToken ct)
    {
        var photo = await patients.GetPhotoAsync(id, ct);
        Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        return PhysicalFile(photo.FullPath, photo.ContentType);
    }

    /// <summary>9. Remove the photo.</summary>
    [HttpDelete("{id}/photo")]
    public async Task<PatientResponse> DeletePhoto(int id, CancellationToken ct) =>
        new(true, await patients.DeletePhotoAsync(id, ct));
}
