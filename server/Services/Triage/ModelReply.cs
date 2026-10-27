using System.Text.Json;
using System.Text.Json.Serialization;

namespace MedTriage.Server.Services.Triage;

/// <summary>The snake_case JSON exchanged with the local diagnosis-model sidecar.</summary>
public static class ModelReply
{
    public static readonly JsonSerializerOptions Wire = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public record Diagnosis(string? Condition, double? Probability, string? Rationale);

    /// <summary>Probabilities are keyed "1"–"5".</summary>
    public record Triage(int? Level, Dictionary<string, double>? Probabilities, List<string>? Findings, string? Note);
}
