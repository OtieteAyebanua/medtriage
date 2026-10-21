using System.Text.Json;
using System.Text.Json.Serialization;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// The JSON an AI model replies with (snake_case), and its strict validation.
/// A bad model reply must never produce a bad record: anything invalid throws, and the rule engine is used instead.
/// </summary>
public static class ModelReply
{
    public static readonly JsonSerializerOptions Wire = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public record Body(
        double? UrgencyScore,
        string? TriageLevel,
        double? Confidence,
        string? Reasoning,
        List<string?>? SuggestedTests,
        List<Diagnosis?>? DifferentialDiagnosis);

    public record Diagnosis(string? Condition, double? Probability, string? Rationale);

    public static InferenceResult Normalize(Body body, string engine, string? model)
    {
        if (body.UrgencyScore is not (>= 1 and <= 5)) throw new InvalidDataException("urgency_score must be 1–5");
        if (string.IsNullOrWhiteSpace(body.Reasoning)) throw new InvalidDataException("reasoning is required");

        var score = (int)Math.Round(body.UrgencyScore.Value);
        var level = ClinicalValues.TriageLevels.Contains(body.TriageLevel) ? body.TriageLevel! : ClinicalValues.TriageLevelFromScore(score);
        var confidence = body.Confidence is >= 0 and <= 1 ? body.Confidence : null;

        var tests = (body.SuggestedTests ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var diagnoses = (body.DifferentialDiagnosis ?? [])
            .Where(d => !string.IsNullOrWhiteSpace(d?.Condition) && d.Probability is not null)
            .Select(d => new DifferentialDiagnosisDto(
                d!.Condition!.Trim(),
                // Accept 72 as well as 0.72
                Math.Round(Math.Clamp(d.Probability > 1 ? d.Probability.Value / 100 : d.Probability!.Value, 0, 1), 2),
                d.Rationale?.Trim() ?? ""))
            .OrderByDescending(d => d.Probability)
            .ToList();

        return new InferenceResult(score, level, confidence, body.Reasoning.Trim(), tests, diagnoses, engine, model);
    }
}
