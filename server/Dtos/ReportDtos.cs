using MedTriage.Server.Common;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

/// <summary>WardReport in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record WardReportDto(
    int? WindowDays,
    int TotalRecords,
    int AwaitingReview,
    Dictionary<int, int> AcuityDistribution,
    Dictionary<int, int> FinalDistribution,
    ReviewStatsDto ReviewStats,
    Dictionary<string, int> StatusDistribution,
    List<WardRecordDto> RecentRecords);

[SnakeCaseJson]
public record ReviewStatsDto(int Reviewed, int Accepted, int Overridden, int Pending, int? AgreementRate);

/// <summary>WardRecord in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record WardRecordDto(
    int RecordId,
    int PatientId,
    string ChiefComplaint,
    int AiUrgencyScore,
    string AiTriageLevel,
    string? FinalTriageLevel,
    string OverrideStatus,
    string Status,
    DateTime VisitDate,
    WardPatientDto Patient,
    StaffRefDto? Recorder)
{
    public static WardRecordDto From(PatientRecord r) => new(
        r.RecordId,
        r.PatientId,
        r.ChiefComplaint,
        r.AiUrgencyScore,
        r.AiTriageLevel,
        r.FinalTriageLevel,
        r.OverrideStatus,
        r.Status,
        r.VisitDate,
        new WardPatientDto(r.Patient.PatientId, r.Patient.FirstName, r.Patient.LastName),
        StaffRefDto.FromOrNull(r.Recorder));
}

[SnakeCaseJson]
public record WardPatientDto(int PatientId, string FirstName, string LastName);
