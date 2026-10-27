using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

// What the rule engine assesses.

public record InferenceRequest(
    InferencePatient Patient,
    string VisitType,
    string ChiefComplaint,
    List<InferenceSymptom> Symptoms,
    InferenceVitals Vitals);

public record InferencePatient(int? Age, string? Sex, string? BloodType, string? ChronicConditions, string? Allergies);

public record InferenceSymptom(int SymptomId, string Name, string? Category, string Severity, string Duration, string? Notes);

public record InferenceVitals(double? Temperature, string? BloodPressure, int? HeartRate, double? OxygenLevel, int? RespiratoryRate);

/// <summary>Triage assessment.</summary>
/// <param name="Engine">Always "rules". Returned to the client and logged, not stored.</param>
/// <param name="Model">Always null; kept so the API response shape stays the same.</param>
/// <param name="SafetyRaisedFrom">Always null; kept so the API response shape stays the same.</param>
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
    /// <summary>Loopback-only URL for the diagnosis-model sidecar (diagnosis_service.py).</summary>
    public string DiagnosisModelUrl { get; set; } = "http://127.0.0.1:8002/diagnose";

    public int TimeoutMs { get; set; } = 5000;
}
