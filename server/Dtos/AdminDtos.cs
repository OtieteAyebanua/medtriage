using System.Text.Json.Serialization;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

public record AdminLoginRequest(string? Password);

public record AdminSessionResponse(
    bool Authenticated,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);

/// <summary>Practitioner in src/api.ts. A worker as the admin console sees it; never includes the password hash.</summary>
public record PractitionerDto(
    int UserId,
    string EmployeeId,
    string FirstName,
    string? MiddleName,
    string LastName,
    string Email,
    string? Phone,
    string Gender,
    string Position,
    string? Department,
    string? LicenseNumber,
    DateOnly? LicenseExpiry,
    bool Active,
    DateTime? VerifiedAt,
    DateTime CreatedAt)
{
    public static PractitionerDto From(HealthcareWorker w) => new(
        w.UserId, w.EmployeeId, w.FirstName, w.MiddleName, w.LastName, w.Email, w.Phone, w.Gender, w.Position,
        w.Department, w.LicenseNumber, w.LicenseExpiry, w.IsActive, w.VerifiedAt, w.CreatedAt);
}

public record PractitionerListResponse(List<PractitionerDto> Practitioners);

public record PractitionerResponse(PractitionerDto Practitioner);

/// <summary>Body of POST and PUT /api/admin/practitioners. On PUT, <see cref="Password"/> is optional and resets it.</summary>
public record SavePractitionerRequest(
    string? EmployeeId,
    string? FirstName,
    string? MiddleName,
    string? LastName,
    string? Email,
    string? Phone,
    string? Gender,
    string? Position,
    string? Department,
    string? LicenseNumber,
    string? LicenseExpiry,
    string? Password);

public record SetPractitionerStatusRequest(bool? Active);
