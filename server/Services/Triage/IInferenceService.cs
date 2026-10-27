namespace MedTriage.Server.Services.Triage;

public interface IInferenceService
{
    /// <summary>
    /// Assess one patient with <see cref="RuleTriageEngine"/>.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default);
}
