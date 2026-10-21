using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// An external model server speaking the contract in API_README.md ("Inference service"):
/// POST the <see cref="InferenceRequest"/> as snake_case JSON to "Inference:Url", get a <see cref="ModelReply.Body"/> back.
/// </summary>
public class ExternalTriageModel(HttpClient http, IOptions<InferenceOptions> options) : ITriageModel
{
    public string Engine => "external";

    public string Name => "external model";

    public async Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct)
    {
        var config = options.Value;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(config.TimeoutMs);

        using var message = new HttpRequestMessage(HttpMethod.Post, config.Url)
        {
            Content = JsonContent.Create(request, options: ModelReply.Wire),
        };
        if (!string.IsNullOrEmpty(config.ApiKey))
        {
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiKey);
        }

        using var response = await http.SendAsync(message, timeout.Token);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ModelReply.Body>(ModelReply.Wire, timeout.Token)
            ?? throw new InvalidDataException("Empty response");
        return ModelReply.Normalize(body, Engine, model: null);
    }
}
