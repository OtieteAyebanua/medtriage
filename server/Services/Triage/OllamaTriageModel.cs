using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// A small language model running locally in Ollama (default qwen2.5:1.5b), asked for a triage assessment
/// as JSON in a fixed shape (Ollama's structured outputs). Runs offline on the server computer.
/// </summary>
public class OllamaTriageModel(HttpClient http, IOptions<InferenceOptions> options) : ITriageModel
{
    private OllamaOptions Config => options.Value.Ollama;

    public string Engine => "ollama";

    public string Name => Config.Model;

    public async Task<InferenceResult> AssessAsync(InferenceRequest request, CancellationToken ct)
    {
        var config = Config;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(config.TimeoutMs);

        var chat = new
        {
            model = config.Model,
            stream = false,
            keep_alive = config.KeepAlive,
            format = TriagePrompt.ResponseSchema,
            // Low temperature: the same patient should get the same answer
            options = new { temperature = 0.1, num_predict = 500 },
            messages = new[]
            {
                new { role = "system", content = TriagePrompt.System },
                new { role = "user", content = TriagePrompt.Describe(request) },
            },
        };

        using var response = await http.PostAsJsonAsync($"{config.Url.TrimEnd('/')}/api/chat", chat, timeout.Token);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(timeout.Token);
            throw new HttpRequestException($"Ollama answered {(int)response.StatusCode}: {error}");
        }

        var reply = await response.Content.ReadFromJsonAsync<ChatResponse>(timeout.Token);
        var content = reply?.Message?.Content;
        if (string.IsNullOrWhiteSpace(content)) throw new InvalidDataException("Ollama returned an empty message");

        var body = JsonSerializer.Deserialize<ModelReply.Body>(content, ModelReply.Wire)
            ?? throw new InvalidDataException("Ollama's reply was not the expected JSON");
        return ModelReply.Normalize(body, Engine, config.Model);
    }

    private record ChatResponse(ChatMessage? Message);

    private record ChatMessage(string? Role, string? Content);
}
