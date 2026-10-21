using MedTriage.Server.Common;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

/// <summary>QueueRecord in src/Homescreen/types.ts (camelCase).</summary>
public record QueueItemDto(
    int RecordId,
    int PatientId,
    string PatientName,
    string? PatientPhoto,
    int Age,
    string Gender,
    string VisitType,
    string ChiefComplaint,
    QueueVitalsDto Vitals,
    List<string> Symptoms,
    QueueAiTriageDto AiTriage,
    DateTime VisitDate,
    string Status,
    string OverrideStatus,
    string RecordedBy)
{
    public static QueueItemDto From(PatientRecord r) => new(
        r.RecordId,
        r.PatientId,
        $"{r.Patient.FirstName} {r.Patient.LastName}",
        r.Patient.PhotoPath,
        ClinicalValues.AgeFrom(r.Patient.DateOfBirth),
        r.Patient.Gender,
        r.VisitType,
        r.ChiefComplaint,
        new QueueVitalsDto(r.VitalsTemperature, r.VitalsBloodPressure, r.VitalsHeartRate, r.VitalsOxygenLevel, r.VitalsRespiratoryRate),
        r.RecordSymptoms.Select(rs => rs.Symptom.SymptomName).ToList(),
        new QueueAiTriageDto(
            r.AiUrgencyScore,
            r.AiTriageLevel,
            r.AiReasoning,
            JsonColumn.ReadList<string>(r.AiSuggestedTests),
            JsonColumn.ReadList<DifferentialDiagnosisDto>(r.AiDifferentialDiagnosis)),
        r.VisitDate,
        r.Status,
        r.OverrideStatus,
        $"{(r.Recorder.Position == "doctor" ? "Dr. " : "")}{r.Recorder.FirstName} {r.Recorder.LastName}");
}

public record QueueVitalsDto(double? Temperature, string? BloodPressure, int? HeartRate, double? OxygenLevel, int? RespiratoryRate);

public record QueueAiTriageDto(
    int Score,
    string Level,
    string Reasoning,
    List<string> SuggestedTests,
    List<DifferentialDiagnosisDto> DifferentialDiagnosis);

public record QueueResponse(List<QueueItemDto> Queue);

public record ReviewRequest(
    string? OverrideAction,
    string? FinalTriageLevel,
    string? OverrideReason,
    string? Diagnosis,
    string? DischargeAction);

[SnakeCaseJson]
public record ReviewedRecordDto(
    int RecordId,
    string OverrideStatus,
    string? OverrideReason,
    string? FinalTriageLevel,
    string? Diagnosis,
    string Status,
    int? TreatedBy)
{
    public static ReviewedRecordDto From(PatientRecord r) =>
        new(r.RecordId, r.OverrideStatus, r.OverrideReason, r.FinalTriageLevel, r.Diagnosis, r.Status, r.TreatedBy);
}

public record ReviewResponse(bool Success, ReviewedRecordDto Record);
