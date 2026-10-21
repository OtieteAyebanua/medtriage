using System.Text.Json;

namespace MedTriage.Server.Common;

/// <summary>Reads and writes the JSON text columns (ai_suggested_tests, ai_differential_diagnosis).</summary>
public static class JsonColumn
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static string Write<T>(T value) => JsonSerializer.Serialize(value, Options);

    /// <summary>Parsed value, or an empty list when the column is null or not valid JSON.</summary>
    public static List<T> ReadList<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, Options) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
