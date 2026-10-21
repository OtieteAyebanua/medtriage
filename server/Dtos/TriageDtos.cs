using MedTriage.Server.Common;

namespace MedTriage.Server.Dtos;

public record RunTriageRequest(
    int? PatientId,
    string? VisitType,
    string? ChiefComplaint,
    TriageVitalsRequest? Vitals,
    List<TriageSymptomRequest?>? Symptoms);

/// <summary>All optional: null means "not measured". Numbers may also be sent as numeric strings.</summary>
public record TriageVitalsRequest(
    double? Temperature,
    string? BloodPressure,
    double? HeartRate,
    double? OxygenLevel,
    double? RespiratoryRate);

public record TriageSymptomRequest(int? SymptomId, string? Severity, string? Duration, string? Notes);

/// <summary>One possible condition. Probability is 0–1.</summary>
public record DifferentialDiagnosisDto(string Condition, double Probability, string Rationale);

[SnakeCaseJson]
public record TriageResponse(bool Success, int RecordId, string Engine, TriageResultDto Triage);

/// <summary>TriageResult in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record TriageResultDto(
    int UrgencyLevel,
    string UrgencyCategory,
    string TriageLevel,
    double? Confidence,
    string Reasoning,
    List<string> RecommendedTests,
    List<DifferentialDiagnosisDto> DifferentialDiagnoses);
