namespace MedTriage.Server.Services.Triage;

public interface IInferenceService
{
    /// <summary>
    /// Assess one patient. Uses the external model when Inference:Url is set, and falls back to
    /// <see cref="RuleTriageEngine"/> if it isn't, times out, or returns something invalid. Never throws for model failures.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default);
}
