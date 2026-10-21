using System.Security.Claims;
using System.Text.Encodings.Web;
using MedTriage.Server.Services.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Common.Auth;

public static class SessionAuthentication
{
    public const string Scheme = "Session";
    public const string CookieName = "medtriage_session";
}

/// <summary>
/// Signs the request in from the medtriage_session cookie. Controllers then use [Authorize] /
/// [Authorize(Roles = "doctor")] as usual; the worker's position is the role claim.
/// </summary>
public sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAuthService auth) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.Cookies[SessionAuthentication.CookieName];
        if (string.IsNullOrEmpty(token)) return AuthenticateResult.NoResult();

        var worker = await auth.GetWorkerBySessionTokenAsync(token, Context.RequestAborted);
        if (worker is null) return AuthenticateResult.Fail("Session expired");

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, worker.UserId.ToString()),
            new(ClaimTypes.Name, $"{worker.FirstName} {worker.LastName}"),
            new(ClaimTypes.Role, worker.Position),
        ];
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.Cookies.Delete(SessionAuthentication.CookieName);
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        await Response.WriteAsJsonAsync(new ErrorResponse("Not signed in", Code: "UNAUTHENTICATED"));
    }

    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        await Response.WriteAsJsonAsync(new ErrorResponse("Your role is not allowed to do this", Code: "FORBIDDEN"));
    }
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>The signed-in worker's user_id. Only call on authenticated requests.</summary>
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new InvalidOperationException("Request is not authenticated"));
}
