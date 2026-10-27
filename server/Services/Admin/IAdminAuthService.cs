using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Admin;

public interface IAdminAuthService
{
    /// <summary>Checks the facility admin password and opens an admin session. Throws 400/401/503 <see cref="Common.ApiException"/> on failure.</summary>
    Task<AdminLoginResult> LoginAsync(AdminLoginRequest request, CancellationToken ct = default);

    /// <summary>Whether the token belongs to a valid, unexpired admin session.</summary>
    Task<bool> IsValidSessionAsync(string? token, CancellationToken ct = default);

    /// <summary>Deletes the admin session. Does nothing if it's already gone.</summary>
    Task LogoutAsync(string? token, CancellationToken ct = default);
}

/// <param name="Token">The raw token for the cookie. Only its SHA-256 hash is stored.</param>
public record AdminLoginResult(string Token, DateTime ExpiresAt);

/// <summary>The "Admin" section of appsettings.</summary>
public class AdminOptions
{
    /// <summary>The facility admin password. When empty, the admin console can't be signed in to.</summary>
    public string? Password { get; set; }
}
