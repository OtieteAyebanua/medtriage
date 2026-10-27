using System.Globalization;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Admin;

public class PractitionerService(
    IDocumentRepository<HealthcareWorker> workers,
    IDocumentRepository<Session> sessions,
    IPasswordHasher<HealthcareWorker> hasher) : IPractitionerService
{
    public const int MinPasswordLength = 8;
    private const int MaxPasswordLength = 128;
    private static readonly string[] Genders = ["Female", "Male", "Other"];

    public async Task<List<PractitionerDto>> ListAsync(CancellationToken ct = default)
    {
        var list = await workers.Query()
            .OrderByDescending(w => w.CreatedAt)
            .ThenByDescending(w => w.UserId)
            .ToListAsync(ct);
        return list.Select(PractitionerDto.From).ToList();
    }

    public async Task<PractitionerDto> CreateAsync(SavePractitionerRequest request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        // The console only submits after the admin confirms they checked ID and licence
        var worker = new HealthcareWorker { IsActive = true, VerifiedAt = now, CreatedAt = now };
        var password = await ApplyAsync(worker, request, passwordRequired: true, ct);
        worker.PasswordHash = hasher.HashPassword(worker, password!);

        await workers.AddAsync(worker, ct);
        await workers.SaveChangesAsync(ct);
        return PractitionerDto.From(worker);
    }

    public async Task<PractitionerDto> UpdateAsync(int userId, SavePractitionerRequest request, CancellationToken ct = default)
    {
        var worker = await workers.GetByIdAsync(userId, ct) ?? throw ApiException.NotFound("Practitioner not found");

        var password = await ApplyAsync(worker, request, passwordRequired: false, ct);
        if (password is not null)
        {
            worker.PasswordHash = hasher.HashPassword(worker, password);
            await SignOutEverywhereAsync(userId, ct);
        }

        await workers.SaveChangesAsync(ct);
        return PractitionerDto.From(worker);
    }

    public async Task<PractitionerDto> SetActiveAsync(int userId, SetPractitionerStatusRequest request, CancellationToken ct = default)
    {
        var active = request.Active ?? throw ApiException.BadRequest("active is required", "active");
        var worker = await workers.GetByIdAsync(userId, ct) ?? throw ApiException.NotFound("Practitioner not found");

        worker.IsActive = active;
        if (!active) await SignOutEverywhereAsync(userId, ct);

        await workers.SaveChangesAsync(ct);
        return PractitionerDto.From(worker);
    }

    /// <summary>Validates the request onto <paramref name="worker"/>. Returns the new password, or null when none was given.</summary>
    private async Task<string?> ApplyAsync(HealthcareWorker worker, SavePractitionerRequest request, bool passwordRequired, CancellationToken ct)
    {
        var employeeId = Validate.RequiredString(request.EmployeeId, "employeeId", 30).ToUpperInvariant();
        var firstName = Validate.RequiredString(request.FirstName, "firstName", 50);
        var middleName = Validate.OptionalString(request.MiddleName, "middleName", 50);
        var lastName = Validate.RequiredString(request.LastName, "lastName", 50);
        var email = Validate.OptionalEmail(request.Email) ?? throw ApiException.BadRequest("email is required", "email");
        var phone = Validate.OptionalString(request.Phone, "phone", 30);
        var gender = Validate.OneOf(request.Gender, Genders, "gender");
        var position = Validate.OneOf(request.Position, ClinicalValues.Positions, "position");
        var department = Validate.OptionalString(request.Department, "department", 100);
        var licenseNumber = Validate.OptionalString(request.LicenseNumber, "licenseNumber", 50);
        var licenseExpiry = OptionalDate(request.LicenseExpiry, "licenseExpiry");

        // Clinical staff can't be verified without a current licence; administrators don't need one
        if (position != "admin")
        {
            if (licenseNumber is null) throw ApiException.BadRequest("A licence number is required for clinical staff", "licenseNumber");
            if (licenseExpiry is null) throw ApiException.BadRequest("Licence expiry is required for clinical staff", "licenseExpiry");
        }
        if (licenseExpiry < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw ApiException.BadRequest("This licence has expired. Ask for proof of renewal before continuing", "licenseExpiry");
        }

        var password = string.IsNullOrEmpty(request.Password) ? null : request.Password;
        if (password is null && passwordRequired) throw ApiException.BadRequest("password is required", "password");
        if (password is { Length: < MinPasswordLength or > MaxPasswordLength })
        {
            throw ApiException.BadRequest($"Password must be {MinPasswordLength}–{MaxPasswordLength} characters", "password");
        }

        // Stored IDs are upper-case and emails lower-case, but older rows may not be, so compare case-insensitively
        var id = worker.UserId;
        if (await workers.ExistsAsync(w => w.UserId != id && w.EmployeeId.ToUpper() == employeeId, ct))
        {
            throw new ApiException(StatusCodes.Status409Conflict, "This employee ID is already taken", "employeeId");
        }
        if (await workers.ExistsAsync(w => w.UserId != id && w.Email.ToLower() == email, ct))
        {
            throw new ApiException(StatusCodes.Status409Conflict, "Another account already uses this email", "email");
        }

        worker.EmployeeId = employeeId;
        worker.FirstName = firstName;
        worker.MiddleName = middleName;
        worker.LastName = lastName;
        worker.Email = email;
        worker.Phone = phone;
        worker.Gender = gender;
        worker.Position = position;
        worker.Department = department;
        worker.LicenseNumber = licenseNumber;
        worker.LicenseExpiry = licenseExpiry;
        return password;
    }

    private async Task SignOutEverywhereAsync(int userId, CancellationToken ct) =>
        sessions.RemoveRange(await sessions.ListAsync(s => s.UserId == userId, ct));

    private static DateOnly? OptionalDate(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            throw ApiException.BadRequest($"{field} must be a date like 2027-06-30", field);
        }
        return date;
    }
}
