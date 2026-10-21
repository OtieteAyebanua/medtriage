using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Records;

public interface IRecordService
{
    /// <summary>Current assessments awaiting a doctor, most urgent first, then longest waiting.</summary>
    Task<List<QueueItemDto>> GetQueueAsync(CancellationToken ct = default);

    /// <summary>Doctor sign-off: accept or override the AI level, record diagnosis and disposition.</summary>
    Task<ReviewedRecordDto> ReviewAsync(int recordId, ReviewRequest request, int doctorUserId, CancellationToken ct = default);
}
