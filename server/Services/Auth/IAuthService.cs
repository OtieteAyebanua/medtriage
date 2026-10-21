using MedTriage.Server.Dtos;
using MedTriage.Server.Models;

namespace MedTriage.Server.Services.Auth;

public interface IAuthService
{
    /// <summary>Checks the credentials and opens a session. Throws 400/401 <see cref="Common.ApiException"/> on failure.</summary>
    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>The worker who owns a valid, unexpired session token, or null.</summary>
    Task<HealthcareWorker?> GetWorkerBySessionTokenAsync(string token, CancellationToken ct = default);

    Task<HealthcareWorker?> GetWorkerAsync(int userId, CancellationToken ct = default);

    /// <summary>Deletes the session. Does nothing if it's already gone.</summary>
    Task LogoutAsync(string? token, CancellationToken ct = default);
}

/// <param name="Token">The raw token for the cookie. Only its SHA-256 hash is stored.</param>
public record LoginResult(HealthcareWorker Worker, string Token, DateTime ExpiresAt);
