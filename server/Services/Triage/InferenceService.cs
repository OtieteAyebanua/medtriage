using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

public class InferenceService(
    HttpClient http,
    IOptions<InferenceOptions> options,
    RuleTriageEngine rules,
    ILogger<InferenceService> logger) : IInferenceService
{
    // The external model speaks snake_case JSON
    private static readonly JsonSerializerOptions Wire = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public async Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct = default)
    {
        var config = options.Value;
        if (!string.IsNullOrWhiteSpace(config.Url))
        {
            try
            {
                return await CallExternalAsync(config, request, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Inference service at {Url} failed; falling back to the rule engine", config.Url);
            }
        }

        return rules.Evaluate(request);
    }

    private async Task<InferenceResult> CallExternalAsync(InferenceOptions config, InferenceRequest request, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(config.TimeoutMs);

        using var message = new HttpRequestMessage(HttpMethod.Post, config.Url)
        {
            Content = JsonContent.Create(request, options: Wire),
        };
        if (!string.IsNullOrEmpty(config.ApiKey))
        {
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiKey);
        }

        using var response = await http.SendAsync(message, timeout.Token);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ExternalResponse>(Wire, timeout.Token)
            ?? throw new InvalidDataException("Empty response");
        return Normalize(body);
    }

    /// <summary>Validates the model's reply strictly. A bad reply must never produce a bad record.</summary>
    private static InferenceResult Normalize(ExternalResponse body)
    {
        if (body.UrgencyScore is not (>= 1 and <= 5)) throw new InvalidDataException("urgency_score must be 1–5");
        if (string.IsNullOrWhiteSpace(body.Reasoning)) throw new InvalidDataException("reasoning is required");

        var score = (int)Math.Round(body.UrgencyScore.Value);
        var level = ClinicalValues.TriageLevels.Contains(body.TriageLevel)
            ? body.TriageLevel!
            : ClinicalValues.TriageLevelFromScore(score);
        var confidence = body.Confidence is >= 0 and <= 1 ? body.Confidence : null;

        var tests = (body.SuggestedTests ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t!.Trim())
            .ToList();

        var diagnoses = (body.DifferentialDiagnosis ?? [])
            .Where(d => !string.IsNullOrWhiteSpace(d?.Condition) && d.Probability is not null)
            .Select(d => new DifferentialDiagnosisDto(
                d!.Condition!,
                // Accept 72 as well as 0.72
                Math.Clamp(d.Probability > 1 ? d.Probability.Value / 100 : d.Probability!.Value, 0, 1),
                d.Rationale ?? ""))
            .OrderByDescending(d => d.Probability)
            .ToList();

        return new InferenceResult(score, level, confidence, body.Reasoning.Trim(), tests, diagnoses, Engine: "external");
    }

    private record ExternalResponse(
        double? UrgencyScore,
        string? TriageLevel,
        double? Confidence,
        string? Reasoning,
        List<string?>? SuggestedTests,
        List<ExternalDiagnosis?>? DifferentialDiagnosis);

    private record ExternalDiagnosis(string? Condition, double? Probability, string? Rationale);
}
