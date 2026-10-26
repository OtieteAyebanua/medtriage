namespace MedTriage.Server.Services.Triage;

/// <summary>The local model interface used by <see cref="InferenceService"/>.</summary>
public interface ITriageModel
{
    /// <summary>"random_forest".</summary>
    string Engine { get; }

    /// <summary>Shown to staff, e.g. "MedTriage Random Forest".</summary>
    string Name { get; }

    /// <summary>
    /// The model's assessment, already validated. Throws on any failure (unreachable, timeout, invalid reply);
    /// the caller then falls back to the rule engine.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct);
}
