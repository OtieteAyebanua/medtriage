using System.Security.Claims;
using System.Text.Encodings.Web;
using MedTriage.Server.Services.Admin;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Common.Auth;

public static class AdminAuthentication
{
    public const string Scheme = "AdminSession";
    public const string CookieName = "medtriage_admin";
    public const string LoginRateLimit = "admin-login";
}

/// <summary>
/// Signs the request in from the medtriage_admin cookie. Separate from the staff session: admin controllers
/// opt in with [Authorize(AuthenticationSchemes = AdminAuthentication.Scheme)], and a staff cookie never satisfies it.
/// </summary>
public sealed class AdminSessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAdminAuthService adminAuth) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.Cookies[AdminAuthentication.CookieName];
        if (string.IsNullOrEmpty(token)) return AuthenticateResult.NoResult();

        if (!await adminAuth.IsValidSessionAsync(token, Context.RequestAborted)) return AuthenticateResult.Fail("Admin session expired");

        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "Facility admin")], Scheme.Name));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.Cookies.Delete(AdminAuthentication.CookieName);
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        await Response.WriteAsJsonAsync(new ErrorResponse("Admin session expired", Code: "UNAUTHENTICATED"));
    }
}
