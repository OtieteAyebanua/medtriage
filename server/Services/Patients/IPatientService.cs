using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Patients;

public interface IPatientService
{
    /// <summary>Registry, newest first, each with its 3 most recent visits. <paramref name="query"/> matches first or last name.</summary>
    Task<List<PatientListItemDto>> ListAsync(string? query, CancellationToken ct = default);

    Task<PatientDto> CreateAsync(CreatePatientRequest request, CancellationToken ct = default);

    /// <summary>Profile plus every visit, newest first.</summary>
    Task<PatientHistoryDto> GetHistoryAsync(int patientId, CancellationToken ct = default);

    /// <summary>Replaces the patient's photo. JPEG, PNG or WebP up to 5 MB.</summary>
    Task<PatientDto> UploadPhotoAsync(int patientId, Stream content, long length, CancellationToken ct = default);

    Task<StoredPhoto> GetPhotoAsync(int patientId, CancellationToken ct = default);

    Task<PatientDto> DeletePhotoAsync(int patientId, CancellationToken ct = default);
}
