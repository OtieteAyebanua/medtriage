using System.Text;
using System.Text.Json;
using MedTriage.Server.Dtos;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// What the diagnosis sidecar sees: the training-CSV inputs, unencoded. diagnosis_model.json says how the
/// sidecar codes sex, avpu and mobility. Sent as snake_case JSON; null means not measured or not asked.
/// </summary>
public record DiagnosisRequest(
    double? AgeYears,
    string? Sex,
    bool? Pregnant,
    bool? RainySeason,
    int? DaysFebrile,
    double? TempC,
    int? HeartRate,
    int? RespRate,
    int? SystolicBp,
    double? Spo2,
    string? Avpu,
    string? Mobility,
    Dictionary<string, bool> SymptomFlags);

/// <summary>Calls the diagnosis-model sidecar (Models/newmodel.joblib) on a loopback address only.</summary>
public class DiagnosisModel(HttpClient http, IOptions<InferenceOptions> options, ILogger<DiagnosisModel> logger)
{
    private record Reply(List<ModelReply.Diagnosis?>? Diagnoses);

    /// <summary>The model's most likely conditions, or an empty list when it is unavailable or had too little to go on.</summary>
    public async Task<List<DifferentialDiagnosisDto>> DiagnoseAsync(DiagnosisRequest request, CancellationToken ct)
    {
        var config = options.Value;
        try
        {
            if (!Uri.TryCreate(config.DiagnosisModelUrl, UriKind.Absolute, out var endpoint) || !endpoint.IsLoopback)
            {
                throw new InvalidOperationException("The diagnosis model endpoint must use localhost or a loopback IP address.");
            }

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(config.TimeoutMs);

            using var message = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                // Content-Length rather than chunked; see RandomForestTriageModel
                Content = new StringContent(JsonSerializer.Serialize(request, ModelReply.Wire), Encoding.UTF8, "application/json"),
            };

            using var response = await http.SendAsync(message, timeout.Token);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<Reply>(ModelReply.Wire, timeout.Token);
            return (body?.Diagnoses ?? [])
                .Where(d => !string.IsNullOrWhiteSpace(d?.Condition) && d.Probability is >= 0 and <= 1)
                .Select(d => new DifferentialDiagnosisDto(d!.Condition!.Trim(), Math.Round(d.Probability!.Value, 2), d.Rationale?.Trim() ?? ""))
                .OrderByDescending(d => d.Probability)
                .ToList();
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Diagnosis model failed, keeping the rule engine's possible conditions: {Error}", ex.Message);
            return [];
        }
    }
}
