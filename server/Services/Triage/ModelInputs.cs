namespace MedTriage.Server.Services.Triage;

/// <summary>
/// What both sidecar models see (diagnosis_service.py): the training-CSV inputs, unencoded. Sent as snake_case
/// JSON; null means not measured or not asked.
/// </summary>
public record ModelInputs(
    double? AgeYears,
    string? Sex,
    bool? Pregnant,
    bool? RainySeason,
    int? DaysFebrile,
    double? TempC,
    int? HeartRate,
    int? RespRate,
    int? SystolicBp,
    double? Spo2,
    string? Avpu,
    string? Mobility,
    Dictionary<string, bool> SymptomFlags);

public class InferenceOptions
{
    /// <summary>Loopback-only URL for the diagnosis-model sidecar (diagnosis_service.py).</summary>
    public string DiagnosisModelUrl { get; set; } = "http://127.0.0.1:8002/diagnose";

    /// <summary>Loopback-only URL for the triage-level model, served by the same sidecar.</summary>
    public string TriageModelUrl { get; set; } = "http://127.0.0.1:8002/triage";

    public int TimeoutMs { get; set; } = 5000;
}
