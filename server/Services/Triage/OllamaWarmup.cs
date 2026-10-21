using System.Net;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// When "Inference:Provider" is "ollama": loads the model into memory as the server starts (so the first triage
/// isn't slow), and says clearly in the console if Ollama isn't running or the model isn't downloaded.
/// Triage keeps working either way, using the rule engine.
/// </summary>
public sealed class OllamaWarmup(IOptions<InferenceOptions> options, IHttpClientFactory httpFactory, ILogger<OllamaWarmup> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = options.Value;
        if (!string.Equals(config.Provider.Trim(), "ollama", StringComparison.OrdinalIgnoreCase)) return;

        var ollama = config.Ollama;
        using var http = httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromMinutes(3); // loading a model from disk can take a while the first time

        try
        {
            // An empty prompt just loads the model and keeps it in memory
            using var response = await http.PostAsJsonAsync(
                $"{ollama.Url.TrimEnd('/')}/api/generate", new { model = ollama.Model, keep_alive = ollama.KeepAlive }, stoppingToken);

            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                logger.LogWarning(
                    "AI model {Model} isn't downloaded. Run \"ollama pull {Model}\" on this computer. Until then, triage uses the rule engine",
                    ollama.Model, ollama.Model);
            }
            else if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Ollama couldn't load {Model} ({Status}). Triage uses the rule engine until it can",
                    ollama.Model, (int)response.StatusCode);
            }
            else
            {
                logger.LogWarning("AI model {Model} is loaded and ready (Ollama at {Url})", ollama.Model, ollama.Url);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !stoppingToken.IsCancellationRequested)
        {
            logger.LogWarning(
                "Ollama isn't running at {Url}. Start the Ollama app on this computer to use the AI model; until then, triage uses the rule engine",
                ollama.Url);
        }
    }
}
