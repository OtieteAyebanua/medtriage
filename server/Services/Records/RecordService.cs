using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Records;

public class RecordService(IDocumentRepository<PatientRecord> records) : IRecordService
{
    public async Task<List<QueueItemDto>> GetQueueAsync(CancellationToken ct = default)
    {
        var queue = await records.Query()
            .Where(r => r.IsCurrent && (r.Status == "waiting" || r.Status == "triaged" || r.OverrideStatus == "pending"))
            .Include(r => r.Patient)
            .Include(r => r.Recorder)
            .Include(r => r.RecordSymptoms).ThenInclude(rs => rs.Symptom)
            .OrderBy(r => r.AiUrgencyScore) // 1 = immediate
            .ThenBy(r => r.VisitDate)       // then longest waiting
            .AsSplitQuery()
            .ToListAsync(ct);

        return queue.Select(QueueItemDto.From).ToList();
    }

    public async Task<ReviewedRecordDto> ReviewAsync(int recordId, ReviewRequest request, int doctorUserId, CancellationToken ct = default)
    {
        if (recordId <= 0) throw ApiException.BadRequest("Invalid record ID", "id");

        var action = Validate.OneOf(request.OverrideAction, ClinicalValues.ReviewActions, "overrideAction");
        var disposition = Validate.OneOf(request.DischargeAction, ClinicalValues.Dispositions, "dischargeAction");
        var diagnosis = Validate.OptionalString(request.Diagnosis, "diagnosis", 1000);

        var record = await records.GetByIdAsync(recordId, ct) ?? throw ApiException.NotFound("Record not found");

        var finalLevel = record.AiTriageLevel;
        string? reason = null;

        if (action == "overridden")
        {
            finalLevel = Validate.OneOf(request.FinalTriageLevel, ClinicalValues.TriageLevels, "finalTriageLevel");
            reason = Validate.OptionalString(request.OverrideReason, "overrideReason", 2000)
                ?? throw ApiException.BadRequest("A reason is required when overriding the AI triage level", "overrideReason");
            if (finalLevel == record.AiTriageLevel)
            {
                throw ApiException.BadRequest(
                    "Override level is the same as the AI level — choose \"accepted\" instead", "finalTriageLevel");
            }
        }

        record.OverrideStatus = action;
        record.OverrideReason = reason;
        record.FinalTriageLevel = finalLevel;
        record.Diagnosis = diagnosis;
        record.Status = disposition;
        record.AssignedTo ??= doctorUserId;
        record.TreatedBy = doctorUserId;

        await records.SaveChangesAsync(ct);
        return ReviewedRecordDto.From(record);
    }
}
