using System.Security.Cryptography;
using System.Text;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Auth;

public class AuthService(
    IDocumentRepository<HealthcareWorker> workers,
    IDocumentRepository<Session> sessions,
    IPasswordHasher<HealthcareWorker> hasher) : IAuthService
{
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(24);

    // Same message for unknown ID and wrong password, so responses don't reveal which IDs exist.
    private const string InvalidCredentials = "Invalid employee ID or password";

    // Compared against when the worker doesn't exist, so both cases take the same time.
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<HealthcareWorker>().HashPassword(null!, "not-a-real-password"));

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var identifier = request.EmployeeId?.Trim() ?? "";
        var password = request.Password ?? "";
        if (identifier.Length == 0 || password.Length == 0)
        {
            throw ApiException.BadRequest("Employee ID and password are required");
        }

        // Employee ID or email, case-insensitive
        var upper = identifier.ToUpperInvariant();
        var worker = await workers.FirstOrDefaultAsync(
            w => w.EmployeeId.ToUpper() == upper || w.Email.ToUpper() == upper, tracking: true, ct: ct);

        var verdict = hasher.VerifyHashedPassword(worker!, worker?.PasswordHash ?? DummyHash.Value, password);
        if (worker is null || verdict == PasswordVerificationResult.Failed)
        {
            throw new ApiException(StatusCodes.Status401Unauthorized, InvalidCredentials);
        }

        if (verdict == PasswordVerificationResult.SuccessRehashNeeded)
        {
            worker.PasswordHash = hasher.HashPassword(worker, password);
        }

        // Clear this worker's expired sessions while we're here
        var now = DateTime.UtcNow;
        sessions.RemoveRange(await sessions.ListAsync(s => s.UserId == worker.UserId && s.ExpiresAt < now, ct));

        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var expiresAt = now.Add(SessionLifetime);
        await sessions.AddAsync(new Session { Token = HashToken(token), UserId = worker.UserId, ExpiresAt = expiresAt, CreatedAt = now }, ct);
        await sessions.SaveChangesAsync(ct);

        return new LoginResult(worker, token, expiresAt);
    }

    public async Task<HealthcareWorker?> GetWorkerBySessionTokenAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return null;

        var hash = HashToken(token);
        var session = await sessions.Query(tracking: true)
            .Include(s => s.Worker)
            .FirstOrDefaultAsync(s => s.Token == hash, ct);
        if (session is null) return null;

        if (session.ExpiresAt < DateTime.UtcNow)
        {
            sessions.Remove(session);
            await sessions.SaveChangesAsync(ct);
            return null;
        }

        return session.Worker;
    }

    public Task<HealthcareWorker?> GetWorkerAsync(int userId, CancellationToken ct = default) =>
        workers.FirstOrDefaultAsync(w => w.UserId == userId, ct: ct);

    public async Task LogoutAsync(string? token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return;

        var hash = HashToken(token);
        var session = await sessions.FirstOrDefaultAsync(s => s.Token == hash, tracking: true, ct: ct);
        if (session is null) return;

        sessions.Remove(session);
        await sessions.SaveChangesAsync(ct);
    }

    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
