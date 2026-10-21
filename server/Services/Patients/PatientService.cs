using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Patients;

public class PatientService(IDocumentRepository<Patient> patients, IPhotoStorage photos) : IPatientService
{
    public async Task<List<PatientListItemDto>> ListAsync(string? query, CancellationToken ct = default)
    {
        var q = patients.Query()
            .Include(p => p.Records.OrderByDescending(r => r.VisitDate).Take(3))
            .AsQueryable();

        var term = query?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            q = q.Where(p => p.FirstName.ToLower().Contains(term) || p.LastName.ToLower().Contains(term));
        }

        var list = await q.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);

        return list
            .Select(p => new PatientListItemDto(PatientDto.From(p))
            {
                Records = p.Records.OrderByDescending(r => r.VisitDate).Select(RecentVisitDto.From).ToList(),
            })
            .ToList();
    }

    public async Task<PatientDto> CreateAsync(CreatePatientRequest request, CancellationToken ct = default)
    {
        var dateOfBirth = request.DateOfBirth ?? throw ApiException.BadRequest("dateOfBirth is required", "dateOfBirth");
        if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw ApiException.BadRequest("dateOfBirth cannot be in the future", "dateOfBirth");
        }

        var patient = new Patient
        {
            FirstName = Validate.RequiredString(request.FirstName, "firstName", 50),
            MiddleName = Validate.OptionalString(request.MiddleName, "middleName", 50),
            LastName = Validate.RequiredString(request.LastName, "lastName", 50),
            DateOfBirth = dateOfBirth,
            Gender = Validate.RequiredString(request.Gender, "gender", 10),
            Email = Validate.OptionalEmail(request.Email),
            BloodType = Validate.OneOf(request.BloodType, ClinicalValues.BloodTypes, "bloodType"),
            Allergies = Validate.OptionalString(request.Allergies, "allergies"),
            ChronicConditions = Validate.OptionalString(request.ChronicConditions, "chronicConditions"),
            CreatedAt = DateTime.UtcNow,
        };

        await patients.AddAsync(patient, ct);
        await patients.SaveChangesAsync(ct);
        return PatientDto.From(patient);
    }

    public async Task<PatientHistoryDto> GetHistoryAsync(int patientId, CancellationToken ct = default)
    {
        EnsureValidId(patientId);

        var patient = await patients.Query()
            .Include(p => p.Records).ThenInclude(r => r.Recorder)
            .Include(p => p.Records).ThenInclude(r => r.Treater)
            .Include(p => p.Records).ThenInclude(r => r.RecordSymptoms).ThenInclude(rs => rs.Symptom)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.PatientId == patientId, ct)
            ?? throw ApiException.NotFound("Patient not found");

        return new PatientHistoryDto(
            new PatientWithAgeDto(PatientDto.From(patient), ClinicalValues.AgeFrom(patient.DateOfBirth)),
            patient.Records.OrderByDescending(r => r.VisitDate).Select(PatientVisitDto.From).ToList());
    }

    public async Task<PatientDto> UploadPhotoAsync(int patientId, Stream content, long length, CancellationToken ct = default)
    {
        EnsureValidId(patientId);
        if (length > PhotoStorage.MaxBytes) throw ApiException.PayloadTooLarge("Photo must be 5 MB or smaller");

        var data = new byte[length];
        await content.ReadExactlyAsync(data, ct);
        var extension = PhotoStorage.DetectExtension(data)
            ?? throw ApiException.UnsupportedMediaType("Photo must be a JPEG, PNG or WebP image");

        var patient = await patients.GetByIdAsync(patientId, ct) ?? throw ApiException.NotFound("Patient not found");

        var previous = patient.PhotoPath;
        patient.PhotoPath = await photos.SaveAsync(patientId, data, extension, ct);
        await patients.SaveChangesAsync(ct);
        photos.Delete(previous);

        return PatientDto.From(patient);
    }

    public async Task<StoredPhoto> GetPhotoAsync(int patientId, CancellationToken ct = default)
    {
        EnsureValidId(patientId);

        var patient = await patients.FirstOrDefaultAsync(p => p.PatientId == patientId, ct: ct);
        if (patient?.PhotoPath is null) throw ApiException.NotFound("No photo");

        return photos.Find(patient.PhotoPath) ?? throw ApiException.NotFound("Photo file missing");
    }

    public async Task<PatientDto> DeletePhotoAsync(int patientId, CancellationToken ct = default)
    {
        EnsureValidId(patientId);

        var patient = await patients.GetByIdAsync(patientId, ct) ?? throw ApiException.NotFound("Patient not found");

        var previous = patient.PhotoPath;
        patient.PhotoPath = null;
        await patients.SaveChangesAsync(ct);
        photos.Delete(previous);

        return PatientDto.From(patient);
    }

    private static void EnsureValidId(int patientId)
    {
        if (patientId <= 0) throw ApiException.BadRequest("Invalid patient ID", "id");
    }
}
