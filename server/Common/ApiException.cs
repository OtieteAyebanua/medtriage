namespace MedTriage.Server.Common;

/// <summary>
/// Thrown by services for any expected failure (bad input, not found, …).
/// <see cref="ApiExceptionHandler"/> turns it into the JSON error body described in API_README.md.
/// </summary>
public class ApiException(int statusCode, string message, string? field = null, string? code = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string? Field { get; } = field;
    public string? Code { get; } = code;

    public static ApiException BadRequest(string message, string? field = null) => new(StatusCodes.Status400BadRequest, message, field);
    public static ApiException NotFound(string message) => new(StatusCodes.Status404NotFound, message);
    public static ApiException PayloadTooLarge(string message) => new(StatusCodes.Status413PayloadTooLarge, message);
    public static ApiException UnsupportedMediaType(string message) => new(StatusCodes.Status415UnsupportedMediaType, message);
}
