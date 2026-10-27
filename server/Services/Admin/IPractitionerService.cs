using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Admin;

/// <summary>Staff accounts as managed from the admin console.</summary>
public interface IPractitionerService
{
    /// <summary>Every worker, newest first, including deactivated ones.</summary>
    Task<List<PractitionerDto>> ListAsync(CancellationToken ct = default);

    /// <summary>Adds a verified practitioner. Throws 400 (validation) or 409 (employee ID / email taken).</summary>
    Task<PractitionerDto> CreateAsync(SavePractitionerRequest request, CancellationToken ct = default);

    /// <summary>Updates the details; a non-empty password resets it and signs the worker out everywhere.</summary>
    Task<PractitionerDto> UpdateAsync(int userId, SavePractitionerRequest request, CancellationToken ct = default);

    /// <summary>Deactivating also signs the worker out. Past records are kept.</summary>
    Task<PractitionerDto> SetActiveAsync(int userId, SetPractitionerStatusRequest request, CancellationToken ct = default);
}
