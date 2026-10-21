using MedTriage.Server.Common;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

public record CreatePatientRequest(
    string? FirstName,
    string? MiddleName,
    string? LastName,
    DateOnly? DateOfBirth,
    string? Gender,
    string? Email,
    string? BloodType,
    string? Allergies,
    string? ChronicConditions);

/// <summary>PatientItem in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record PatientDto
{
    public int PatientId { get; init; }
    public string FirstName { get; init; } = null!;
    public string? MiddleName { get; init; }
    public string LastName { get; init; } = null!;
    public DateOnly DateOfBirth { get; init; }
    public string Gender { get; init; } = null!;
    public string? Email { get; init; }
    public string BloodType { get; init; } = null!;
    public string? Allergies { get; init; }
    public string? ChronicConditions { get; init; }
    public string? PhotoPath { get; init; }
    public DateTime CreatedAt { get; init; }

    public static PatientDto From(Patient p) => new()
    {
        PatientId = p.PatientId,
        FirstName = p.FirstName,
        MiddleName = p.MiddleName,
        LastName = p.LastName,
        DateOfBirth = p.DateOfBirth,
        Gender = p.Gender,
        Email = p.Email,
        BloodType = p.BloodType,
        Allergies = p.Allergies,
        ChronicConditions = p.ChronicConditions,
        PhotoPath = p.PhotoPath,
        CreatedAt = p.CreatedAt,
    };
}

/// <summary>Registry row: the patient plus their three most recent visits.</summary>
[SnakeCaseJson]
public record PatientListItemDto : PatientDto
{
    public PatientListItemDto(PatientDto patient) : base(patient) { }

    public List<RecentVisitDto> Records { get; init; } = [];
}

/// <summary>RecentVisit in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record RecentVisitDto(
    int RecordId,
    DateTime VisitDate,
    string VisitType,
    string ChiefComplaint,
    int AiUrgencyScore,
    string? FinalTriageLevel,
    string? Diagnosis,
    string Status)
{
    public static RecentVisitDto From(PatientRecord r) =>
        new(r.RecordId, r.VisitDate, r.VisitType, r.ChiefComplaint, r.AiUrgencyScore, r.FinalTriageLevel, r.Diagnosis, r.Status);
}

public record PatientListResponse(List<PatientListItemDto> Patients);

public record PatientResponse(bool Success, PatientDto Patient);

/* ---------------- Patient history (GET /api/patients/:id) ---------------- */

[SnakeCaseJson]
public record PatientWithAgeDto : PatientDto
{
    public PatientWithAgeDto(PatientDto patient, int age) : base(patient) => Age = age;

    public int Age { get; init; }
}

/// <summary>PatientHistory in src/Homescreen/types.ts.</summary>
public record PatientHistoryDto(PatientWithAgeDto Patient, List<PatientVisitDto> Visits);

/// <summary>PatientVisit in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record PatientVisitDto(
    int RecordId,
    DateTime VisitDate,
    string VisitType,
    string ChiefComplaint,
    string Status,
    bool IsCurrent,
    VisitVitalsDto Vitals,
    List<VisitSymptomDto> Symptoms,
    VisitAiDto Ai,
    VisitReviewDto Review,
    StaffRefDto? RecordedBy,
    StaffRefDto? TreatedBy)
{
    public static PatientVisitDto From(PatientRecord r) => new(
        r.RecordId,
        r.VisitDate,
        r.VisitType,
        r.ChiefComplaint,
        r.Status,
        r.IsCurrent,
        new VisitVitalsDto(r.VitalsTemperature, r.VitalsBloodPressure, r.VitalsHeartRate, r.VitalsOxygenLevel, r.VitalsRespiratoryRate),
        r.RecordSymptoms
            .Select(rs => new VisitSymptomDto(rs.SymptomId, rs.Symptom.SymptomName, rs.Symptom.Category, rs.Severity, rs.Duration, rs.Notes))
            .ToList(),
        new VisitAiDto(
            r.AiUrgencyScore,
            r.AiTriageLevel,
            r.AiConfidence,
            r.AiReasoning,
            JsonColumn.ReadList<string>(r.AiSuggestedTests),
            JsonColumn.ReadList<DifferentialDiagnosisDto>(r.AiDifferentialDiagnosis)),
        new VisitReviewDto(r.OverrideStatus, r.OverrideReason, r.FinalTriageLevel, r.Diagnosis),
        StaffRefDto.FromOrNull(r.Recorder),
        StaffRefDto.FromOrNull(r.Treater));
}

[SnakeCaseJson]
public record VisitVitalsDto(double? Temperature, string? BloodPressure, int? HeartRate, double? OxygenLevel, int? RespiratoryRate);

[SnakeCaseJson]
public record VisitSymptomDto(int SymptomId, string Name, string Category, string Severity, string Duration, string? Notes);

[SnakeCaseJson]
public record VisitAiDto(
    int UrgencyScore,
    string TriageLevel,
    double? Confidence,
    string Reasoning,
    List<string> SuggestedTests,
    List<DifferentialDiagnosisDto> DifferentialDiagnosis);

[SnakeCaseJson]
public record VisitReviewDto(string OverrideStatus, string? OverrideReason, string? FinalTriageLevel, string? Diagnosis);

/// <summary>A staff member referenced from a record (recorded_by, treated_by, recorder).</summary>
[SnakeCaseJson]
public record StaffRefDto(int UserId, string FirstName, string LastName, string Position)
{
    public static StaffRefDto? FromOrNull(HealthcareWorker? w) =>
        w is null ? null : new(w.UserId, w.FirstName, w.LastName, w.Position);
}
