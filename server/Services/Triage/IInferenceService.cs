namespace MedTriage.Server.Services.Triage;

public interface IInferenceService
{
    /// <summary>
    /// Assess one patient with the local Random Forest and <see cref="RuleTriageEngine"/> as a safety floor
    /// and fallback when the local model fails. Never throws for model failures.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default);
}
