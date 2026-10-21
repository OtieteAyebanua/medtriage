namespace MedTriage.Server.Services.Triage;

public interface IInferenceService
{
    /// <summary>
    /// Assess one patient with the AI model chosen by "Inference:Provider", using <see cref="RuleTriageEngine"/>
    /// as a safety floor and as the fallback when there's no model or it fails. Never throws for model failures.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default);
}
