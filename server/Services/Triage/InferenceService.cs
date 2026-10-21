using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// Combines the AI model chosen by "Inference:Provider" with the built-in rule engine:
/// <list type="bullet">
/// <item>No model configured, or it fails (unreachable, too slow, invalid reply): the rule engine's result.</item>
/// <item>Otherwise the model's result, with the rule engine as a <b>safety floor</b>: if the rules find the patient
/// more urgent than the model does, the more urgent level wins and the reasoning says so. A small model can then add
/// explanation and possible conditions, but can never under-triage a red flag the rules catch.</item>
/// </list>
/// </summary>
public class InferenceService(
    IOptions<InferenceOptions> options,
    RuleTriageEngine rules,
    OllamaTriageModel ollama,
    ExternalTriageModel external,
    ILogger<InferenceService> logger) : IInferenceService
{
    public async Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default)
    {
        var ruleResult = rules.Evaluate(request);

        var model = SelectModel();
        if (model is null) return ruleResult;

        InferenceResult modelResult;
        try
        {
            modelResult = await model.AssessAsync(request, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("AI model {Model} ({Engine}) failed, using the rule engine instead: {Error}", model.Name, model.Engine, ex.Message);
            return ruleResult;
        }

        return ApplySafetyFloor(modelResult, ruleResult);
    }

    private ITriageModel? SelectModel()
    {
        var config = options.Value;
        return config.Provider.Trim().ToLowerInvariant() switch
        {
            "ollama" => ollama,
            "http" => external,
            "rules" => null,
            _ => string.IsNullOrWhiteSpace(config.Url) ? null : external, // "auto"
        };
    }

    private const int MaxMergedTests = 6;

    /// <summary>The model's result, raised to the rule engine's level if that is more urgent (1 = most urgent).</summary>
    public static InferenceResult ApplySafetyFloor(InferenceResult model, InferenceResult rules)
    {
        // A model that gave no tests or conditions still gets the rule engine's
        var tests = model.SuggestedTests.Count > 0 ? model.SuggestedTests : rules.SuggestedTests;
        var conditions = model.DifferentialDiagnosis.Count > 0 ? model.DifferentialDiagnosis : rules.DifferentialDiagnosis;

        if (rules.UrgencyScore >= model.UrgencyScore)
        {
            return model with { SuggestedTests = tests, DifferentialDiagnosis = conditions };
        }

        return model with
        {
            UrgencyScore = rules.UrgencyScore,
            TriageLevel = rules.TriageLevel,
            Reasoning = $"{model.Reasoning} Safety check: the rule engine raised this from Level {model.UrgencyScore} to Level {rules.UrgencyScore}. {rules.Reasoning}",
            // The model's tests first, then the rules' for the red flags it missed; capped so the list stays readable
            SuggestedTests = tests.Concat(rules.SuggestedTests).Distinct(StringComparer.OrdinalIgnoreCase).Take(MaxMergedTests).ToList(),
            DifferentialDiagnosis = conditions,
            SafetyRaisedFrom = model.UrgencyScore,
        };
    }
}
