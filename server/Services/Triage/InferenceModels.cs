using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

// What the AI sees. Sent to the external model as snake_case JSON; see "Inference service" in API_README.md.

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
/// <param name="Engine">"external" or "rules". Logged and returned to the client, not stored.</param>
public record InferenceResult(
    int UrgencyScore,
    string TriageLevel,
    double? Confidence,
    string Reasoning,
    List<string> SuggestedTests,
    List<DifferentialDiagnosisDto> DifferentialDiagnosis,
    string Engine);

public class InferenceOptions
{
    /// <summary>External model endpoint. Empty → built-in rule engine.</summary>
    public string? Url { get; set; }

    public int TimeoutMs { get; set; } = 5000;

    /// <summary>Sent as "Authorization: Bearer …" when set.</summary>
    public string? ApiKey { get; set; }
}
