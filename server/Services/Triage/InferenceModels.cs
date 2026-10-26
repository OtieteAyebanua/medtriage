using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

// What the local Random Forest service sees. Sent as snake_case JSON; see "Local inference" in API_README.md.

public record InferenceRequest(
    InferencePatient Patient,
    string VisitType,
    string ChiefComplaint,
    List<InferenceSymptom> Symptoms,
    InferenceVitals Vitals);

public record InferencePatient(int? Age, string? Sex, string? BloodType, string? ChronicConditions, string? Allergies);

public record InferenceSymptom(int SymptomId, string Name, string? Category, string Severity, string Duration, string? Notes);

public record InferenceVitals(double? Temperature, string? BloodPressure, int? HeartRate, double? OxygenLevel, int? RespiratoryRate);

/// <summary>Normalised AI output, whichever engine produced it.</summary>
/// <param name="Engine">"rules" or "random_forest". Returned to the client and logged, not stored.</param>
/// <param name="Model">The model's name, or null for the rule engine.</param>
/// <param name="SafetyRaisedFrom">The model's own level when the rule engine overruled it with a more urgent one.</param>
public record InferenceResult(
    int UrgencyScore,
    string TriageLevel,
    double? Confidence,
    string Reasoning,
    List<string> SuggestedTests,
    List<DifferentialDiagnosisDto> DifferentialDiagnosis,
    string Engine,
    string? Model = null,
    int? SafetyRaisedFrom = null);

public class InferenceOptions
{
    /// <summary>Loopback-only URL for the local Random Forest sidecar.</summary>
    public string LocalModelUrl { get; set; } = "http://127.0.0.1:8001/triage";

    public int TimeoutMs { get; set; } = 5000;

    public string ModelName { get; set; } = "MedTriage Random Forest";
}
