using System.Text.Json.Serialization;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

public record LoginRequest(string? EmployeeId, string? Password);

/// <summary>Public profile of a signed-in worker. Never includes the password hash.</summary>
public record WorkerDto(
    int UserId,
    string EmployeeId,
    string FirstName,
    string? MiddleName,
    string LastName,
    string Email,
    string Position,
    string Gender)
{
    public static WorkerDto From(HealthcareWorker w) =>
        new(w.UserId, w.EmployeeId, w.FirstName, w.MiddleName, w.LastName, w.Email, w.Position, w.Gender);
}

public record LoginResponse(bool Success, WorkerDto Worker);

public record SessionResponse(
    bool Authenticated,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] WorkerDto? Worker,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);

public record SuccessResponse(bool Success = true);
