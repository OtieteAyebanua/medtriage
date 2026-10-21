namespace MedTriage.Server.Services.Triage;

/// <summary>An AI model that can assess a patient. <see cref="InferenceService"/> picks one from "Inference:Provider".</summary>
public interface ITriageModel
{
    /// <summary>"ollama" or "external".</summary>
    string Engine { get; }

    /// <summary>Shown to staff, e.g. "qwen2.5:1.5b".</summary>
    string Name { get; }

    /// <summary>
    /// The model's assessment, already validated. Throws on any failure (unreachable, timeout, invalid reply);
    /// the caller then falls back to the rule engine.
    /// </summary>
    Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct);
}
