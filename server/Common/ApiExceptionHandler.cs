using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Common;

/// <summary>Converts exceptions into the error format clients expect.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, body) = exception switch
        {
            ApiException api => (api.StatusCode, new ErrorResponse(api.Message, api.Field, api.Code)),
            BadHttpRequestException bad => (bad.StatusCode, new ErrorResponse(
                bad.StatusCode == StatusCodes.Status413PayloadTooLarge ? "Request is too large" : "Malformed request")),
            _ => (StatusCodes.Status500InternalServerError, new ErrorResponse("Something went wrong on the facility server")),
        };

        if (status >= 500)
        {
            logger.LogError(exception, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
        }

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(body, ct);
        return true;
    }

    /// <summary>
    /// Used for [ApiController] model-binding failures (malformed JSON, a word where a number belongs, …)
    /// so they return the same { error, field } shape instead of ProblemDetails.
    /// </summary>
    public static IActionResult FromModelState(ActionContext context)
    {
        // A JSON error ("$.vitals.temperature") also adds a vaguer "request is required" error; prefer the precise one.
        var errors = context.ModelState.Where(kv => kv.Value is { Errors.Count: > 0 }).ToList();
        var (key, entry) = errors.FirstOrDefault(kv => kv.Key.StartsWith('$'), errors[0]);
        var field = key.StartsWith("$.") ? key[2..] : key;
        if (string.IsNullOrEmpty(field) || field == "$") field = null;

        var message = entry!.Errors[0].ErrorMessage;
        if (field is null || string.IsNullOrEmpty(message) || message.Contains("could not be converted"))
        {
            message = field is null ? "Request body is not valid JSON" : $"{field} has an invalid value";
        }

        return new BadRequestObjectResult(new ErrorResponse(message, field));
    }
}
