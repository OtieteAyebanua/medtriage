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

/// <param name="Engine">"rules", "ollama" or "external".</param>
/// <param name="Model">The AI model's name, e.g. "qwen2.5:1.5b"; null for the rule engine.</param>
/// <param name="SafetyRaisedFrom">The AI model's own level when the rule engine raised it to a more urgent one.</param>
[SnakeCaseJson]
public record TriageResponse(bool Success, int RecordId, string Engine, string? Model, int? SafetyRaisedFrom, TriageResultDto Triage);

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
