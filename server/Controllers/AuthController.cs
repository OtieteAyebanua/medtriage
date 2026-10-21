using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedTriage.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth) : ControllerBase
{
    /// <summary>1. Sign in with employee ID (or email) and password; sets the session cookie.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await auth.LoginAsync(request, ct);

        Response.Cookies.Append(SessionAuthentication.CookieName, result.Token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = result.ExpiresAt,
        });

        return new LoginResponse(true, WorkerDto.From(result.Worker));
    }

    /// <summary>2. Restore the signed-in worker from the cookie on page load.</summary>
    [HttpGet("session")]
    [AllowAnonymous]
    public async Task<ActionResult<SessionResponse>> Session(CancellationToken ct)
    {
        var worker = User.Identity?.IsAuthenticated == true ? await auth.GetWorkerAsync(User.GetUserId(), ct) : null;
        if (worker is null)
        {
            Response.Cookies.Delete(SessionAuthentication.CookieName);
            return Unauthorized(new SessionResponse(false, null, "Session expired"));
        }

        return new SessionResponse(true, WorkerDto.From(worker));
    }

    /// <summary>3. End the session and clear the cookie. Always succeeds.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult<SuccessResponse>> Logout(CancellationToken ct)
    {
        await auth.LogoutAsync(Request.Cookies[SessionAuthentication.CookieName], ct);
        Response.Cookies.Delete(SessionAuthentication.CookieName);
        return new SuccessResponse();
    }
}
