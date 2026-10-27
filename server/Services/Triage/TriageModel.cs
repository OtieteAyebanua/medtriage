using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <param name="Probabilities">Probability for each level, 1–5.</param>
/// <param name="Reasoning">The probabilities in words, plus the abnormal vitals and danger signs the model was given.</param>
public record TriagePrediction(int Level, Dictionary<int, double> Probabilities, string Reasoning);

/// <summary>Calls the triage-level model (Models/triage_model.joblib) in the local sidecar, on a loopback address only.</summary>
public class TriageModel(HttpClient http, IOptions<InferenceOptions> options, ILogger<TriageModel> logger)
{
    public const string Name = "random-forest";

    private static readonly string[] LevelNames = ["Immediate", "Emergent", "Urgent", "Less urgent", "Non-urgent"];

    /// <summary>The model's prediction, or null when it is unavailable.</summary>
    public async Task<TriagePrediction?> PredictAsync(ModelInputs inputs, CancellationToken ct)
    {
        var config = options.Value;
        try
        {
            if (!Uri.TryCreate(config.TriageModelUrl, UriKind.Absolute, out var endpoint) || !endpoint.IsLoopback)
            {
                throw new InvalidOperationException("The triage model endpoint must use localhost or a loopback IP address.");
            }

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(config.TimeoutMs);

            using var message = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                // Content-Length rather than chunked: the sidecar's plain HTTP server reads by length
                Content = new StringContent(JsonSerializer.Serialize(inputs, ModelReply.Wire), Encoding.UTF8, "application/json"),
            };

            using var response = await http.SendAsync(message, timeout.Token);
            response.EnsureSuccessStatusCode();

            var reply = await response.Content.ReadFromJsonAsync<ModelReply.Triage>(ModelReply.Wire, timeout.Token);
            var probabilities = (reply?.Probabilities ?? [])
                .Where(p => int.TryParse(p.Key, out var k) && k is >= 1 and <= 5 && p.Value is >= 0 and <= 1)
                .ToDictionary(p => int.Parse(p.Key), p => Math.Round(p.Value, 4));
            if (reply?.Level is not int level || !probabilities.ContainsKey(level))
            {
                throw new InvalidOperationException("The triage model returned no usable level.");
            }

            return new TriagePrediction(level, probabilities, Explain(probabilities, reply.Findings ?? [], reply.Note));
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Triage model failed: {Error}", ex.Message);
            return null;
        }
    }

    /// <summary>"Triage model: Level 2 Emergent 68%, Level 3 Urgent 24%. Findings: SpO2 89%, …"</summary>
    private static string Explain(Dictionary<int, double> probabilities, List<string> findings, string? note)
    {
        var ranked = probabilities.Where(p => p.Value >= 0.05).OrderByDescending(p => p.Value)
            .Select(p => $"Level {p.Key} {LevelNames[p.Key - 1]} {p.Value:P0}");
        return $"Triage model: {string.Join(", ", ranked)}."
            + (findings.Count > 0 ? $" Findings: {string.Join(", ", findings)}." : " No abnormal vital signs or danger signs recorded.")
            + (note is null ? "" : $" {note}");
    }
}
