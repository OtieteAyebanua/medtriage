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
/// <param name="Engine">"rules", "ollama" or "external". Returned to the client and logged, not stored.</param>
/// <param name="Model">The AI model's name (e.g. "qwen2.5:1.5b"), or null for the rule engine.</param>
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
    /// <summary>
    /// Which AI model to use alongside the rule engine:
    /// "ollama" (a local model, see <see cref="Ollama"/>), "http" (the external contract at <see cref="Url"/>),
    /// "rules" (rule engine only) or "auto" ("http" when <see cref="Url"/> is set, otherwise "rules").
    /// </summary>
    public string Provider { get; set; } = "auto";

    /// <summary>External model endpoint for the "http" provider.</summary>
    public string? Url { get; set; }

    public int TimeoutMs { get; set; } = 5000;

    /// <summary>Sent as "Authorization: Bearer …" to the external model when set.</summary>
    public string? ApiKey { get; set; }

    public OllamaOptions Ollama { get; set; } = new();
}

public class OllamaOptions
{
    public string Url { get; set; } = "http://localhost:11434";

    /// <summary>Must be downloaded first: <c>ollama pull qwen2.5:1.5b</c>.</summary>
    public string Model { get; set; } = "qwen2.5:1.5b";

    /// <summary>Small models on a CPU take several seconds; give up (and use the rule engine) after this.</summary>
    public int TimeoutMs { get; set; } = 60000;

    /// <summary>How long Ollama keeps the model in memory after a request, so the next triage is fast.</summary>
    public string KeepAlive { get; set; } = "30m";
}
