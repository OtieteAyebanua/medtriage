namespace MedTriage.Server.Services.Triage;

/// <summary>Triage level from the built-in rule engine. Possible conditions may be replaced by <see cref="DiagnosisModel"/>.</summary>
public class InferenceService(RuleTriageEngine rules) : IInferenceService
{
    public Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default) =>
        Task.FromResult(rules.Evaluate(request));
}
