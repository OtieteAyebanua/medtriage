using MedTriage.Server.Common;

namespace MedTriage.Server.Dtos;

public record RunTriageRequest(
    int? PatientId,
    string? VisitType,
    string? ChiefComplaint,
    TriageVitalsRequest? Vitals,
    List<TriageSymptomRequest?>? Symptoms,
    TriageScreeningRequest? Screening = null);

/// <summary>All optional: null means "not measured". Numbers may also be sent as numeric strings.</summary>
public record TriageVitalsRequest(
    double? Temperature,
    string? BloodPressure,
    double? HeartRate,
    double? OxygenLevel,
    double? RespiratoryRate);

public record TriageSymptomRequest(int? SymptomId, string? Severity, string? Duration, string? Notes);

/// <summary>Diagnosis-model inputs. All optional: null means "not asked".</summary>
/// <param name="SymptomFlags">Keyed by the names in ClinicalValues.SymptomFlags, e.g. { "chills": true, "cough": false }.</param>
public record TriageScreeningRequest(
    bool? Pregnant,
    bool? RainySeason,
    double? DaysFebrile,
    string? Avpu,
    string? Mobility,
    Dictionary<string, bool>? SymptomFlags);

/// <summary>One possible condition. Probability is 0–1.</summary>
public record DifferentialDiagnosisDto(string Condition, double Probability, string Rationale);

/// <param name="Model">Which model set the level.</param>
/// <param name="LevelProbabilities">The model's probability for each level, keyed 1–5.</param>
[SnakeCaseJson]
public record TriageResponse(
    bool Success,
    int RecordId,
    string Model,
    Dictionary<int, double> LevelProbabilities,
    TriageResultDto Triage);

/// <summary>TriageResult in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record TriageResultDto(
    int UrgencyLevel,
    string UrgencyCategory,
    string TriageLevel,
    double? Confidence,
    string Reasoning,
    List<DifferentialDiagnosisDto> DifferentialDiagnoses);
