using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>Calls the Random Forest sidecar using a loopback address only.</summary>
public class RandomForestTriageModel(HttpClient http, IOptions<InferenceOptions> options) : ITriageModel
{
    public string Engine => "random_forest";

    public string Name => options.Value.ModelName;

    public async Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct)
    {
        var config = options.Value;
        if (!Uri.TryCreate(config.LocalModelUrl, UriKind.Absolute, out var endpoint) || !endpoint.IsLoopback)
        {
            throw new InvalidOperationException("The Random Forest endpoint must use localhost or a loopback IP address.");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(config.TimeoutMs);

        using var message = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            // Materialize JSON so the local Python service receives Content-Length rather than
            // an HTTP/1.1 chunked body, which BaseHTTPRequestHandler does not decode.
            Content = new StringContent(JsonSerializer.Serialize(request, ModelReply.Wire), Encoding.UTF8, "application/json"),
        };

        using var response = await http.SendAsync(message, timeout.Token);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<ModelReply.Body>(ModelReply.Wire, timeout.Token)
            ?? throw new InvalidDataException("Empty response from the local Random Forest service");
        return ModelReply.Normalize(body, Engine, Name);
    }
}
