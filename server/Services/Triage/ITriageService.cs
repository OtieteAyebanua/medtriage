using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

public interface ITriageService
{
    /// <summary>
    /// Runs the AI on an assessment and saves it as the patient's current record, which puts it in the review queue.
    /// </summary>
    Task<TriageResponse> RunAsync(RunTriageRequest request, int recordedByUserId, CancellationToken ct = default);
}
