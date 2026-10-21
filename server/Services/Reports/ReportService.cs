using System.Linq.Expressions;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Reports;

public class ReportService(IDocumentRepository<PatientRecord> records) : IReportService
{
    public async Task<WardReportDto> GetWardReportAsync(int? days, CancellationToken ct = default)
    {
        var windowDays = days is > 0 ? days : null;
        var window = records.Query();
        if (windowDays is not null)
        {
            var since = DateTime.UtcNow.AddDays(-windowDays.Value);
            window = window.Where(r => r.VisitDate >= since);
        }

        var total = await window.CountAsync(ct);
        var awaitingReview = await window.CountAsync(r => r.IsCurrent && r.OverrideStatus == "pending", ct);
        var byAiLevel = await CountByAsync(window, r => r.AiTriageLevel, ct);
        var byFinalLevel = await CountByAsync(window, r => r.FinalTriageLevel, ct);
        var byOverride = await CountByAsync(window, r => r.OverrideStatus, ct);
        var byStatus = await CountByAsync(window, r => r.Status, ct);

        var recent = await window
            .Include(r => r.Patient)
            .Include(r => r.Recorder)
            .OrderByDescending(r => r.VisitDate)
            .Take(10)
            .ToListAsync(ct);

        var accepted = byOverride.GetValueOrDefault("accepted");
        var overridden = byOverride.GetValueOrDefault("overridden");
        var reviewed = accepted + overridden;

        return new WardReportDto(
            windowDays,
            total,
            awaitingReview,
            ByLevelNumber(byAiLevel),
            ByLevelNumber(byFinalLevel),
            new ReviewStatsDto(
                reviewed,
                accepted,
                overridden,
                byOverride.GetValueOrDefault("pending"),
                // How often doctors agree with the AI, as a whole percent: the key governance metric for the model
                reviewed > 0 ? (int)Math.Round(accepted * 100.0 / reviewed) : null),
            byStatus,
            recent.Select(WardRecordDto.From).ToList());
    }

    private static Task<Dictionary<string, int>> CountByAsync(
        IQueryable<PatientRecord> query, Expression<Func<PatientRecord, string?>> key, CancellationToken ct) =>
        query.GroupBy(key)
            .Select(g => new { Key = g.Key ?? "", Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    /// <summary>{ "urgent": 8, … } → { 1: 0, 2: 0, 3: 8, 4: 0, 5: 0 }, always with all five levels.</summary>
    private static Dictionary<int, int> ByLevelNumber(Dictionary<string, int> byLevel) =>
        Enumerable.Range(1, 5).ToDictionary(n => n, n => byLevel.GetValueOrDefault(ClinicalValues.TriageLevelFromScore(n)));
}
