using System.Text.Json.Serialization;

namespace MedTriage.Server.Common;

/// <summary>Body of every error response: { "error": "...", "field"?: "...", "code"?: "..." }.</summary>
public record ErrorResponse(
    string Error,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Field = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null);
