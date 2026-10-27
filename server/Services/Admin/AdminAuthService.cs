using System.Security.Cryptography;
using System.Text;
using MedTriage.Server.Common;
using MedTriage.Server.Common.Auth;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Admin;

public class AdminAuthService(IDocumentRepository<AdminSession> sessions, IOptionsMonitor<AdminOptions> options) : IAdminAuthService
{
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);

    public async Task<AdminLoginResult> LoginAsync(AdminLoginRequest request, CancellationToken ct = default)
    {
        var password = request.Password ?? "";
        if (password.Length == 0) throw ApiException.BadRequest("Password is required", "password");

        var configured = options.CurrentValue.Password;
        if (string.IsNullOrEmpty(configured))
        {
            throw new ApiException(StatusCodes.Status503ServiceUnavailable,
                "The admin console is not set up. Set Admin:Password in the server's appsettings.json and restart it.",
                code: "ADMIN_NOT_CONFIGURED");
        }

        // Compare hashes so the check takes the same time whatever the input length
        var matches = CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(password)), SHA256.HashData(Encoding.UTF8.GetBytes(configured)));
        if (!matches) throw new ApiException(StatusCodes.Status401Unauthorized, "Incorrect admin password");

        // Clear expired admin sessions while we're here
        var now = DateTime.UtcNow;
        sessions.RemoveRange(await sessions.ListAsync(s => s.ExpiresAt < now, ct));

        var token = SessionTokens.New();
        var expiresAt = now.Add(SessionLifetime);
        await sessions.AddAsync(new AdminSession { Token = SessionTokens.Hash(token), ExpiresAt = expiresAt, CreatedAt = now }, ct);
        await sessions.SaveChangesAsync(ct);

        return new AdminLoginResult(token, expiresAt);
    }

    public async Task<bool> IsValidSessionAsync(string? token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return false;

        var hash = SessionTokens.Hash(token);
        var now = DateTime.UtcNow;
        return await sessions.ExistsAsync(s => s.Token == hash && s.ExpiresAt > now, ct);
    }

    public async Task LogoutAsync(string? token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return;

        var hash = SessionTokens.Hash(token);
        var session = await sessions.FirstOrDefaultAsync(s => s.Token == hash, tracking: true, ct: ct);
        if (session is null) return;

        sessions.Remove(session);
        await sessions.SaveChangesAsync(ct);
    }
}
