using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MedTriage.Server.Controllers;

/// <summary>Sign-in for the /admin console. Uses its own cookie; a staff session never grants admin access.</summary>
[ApiController]
[Route("api/admin/auth")]
[AllowAnonymous]
public class AdminAuthController(IAdminAuthService adminAuth) : ControllerBase
{
    /// <summary>15. Sign in with the facility admin password; sets the admin cookie.</summary>
    [HttpPost("login")]
    [EnableRateLimiting(AdminAuthentication.LoginRateLimit)]
    public async Task<ActionResult<SuccessResponse>> Login(AdminLoginRequest request, CancellationToken ct)
    {
        var result = await adminAuth.LoginAsync(request, ct);

        Response.Cookies.Append(AdminAuthentication.CookieName, result.Token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = result.ExpiresAt,
        });

        return new SuccessResponse();
    }

    /// <summary>16. Whether the admin cookie is still a valid session.</summary>
    [HttpGet("session")]
    public async Task<ActionResult<AdminSessionResponse>> Session(CancellationToken ct)
    {
        if (await adminAuth.IsValidSessionAsync(Request.Cookies[AdminAuthentication.CookieName], ct))
        {
            return new AdminSessionResponse(true);
        }

        Response.Cookies.Delete(AdminAuthentication.CookieName);
        return Unauthorized(new AdminSessionResponse(false, "Session expired"));
    }

    /// <summary>17. End the admin session and clear the cookie. Always succeeds.</summary>
    [HttpPost("logout")]
    public async Task<ActionResult<SuccessResponse>> Logout(CancellationToken ct)
    {
        await adminAuth.LogoutAsync(Request.Cookies[AdminAuthentication.CookieName], ct);
        Response.Cookies.Delete(AdminAuthentication.CookieName);
        return new SuccessResponse();
    }
}
