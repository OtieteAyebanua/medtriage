using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Reports;

public interface IReportService
{
    /// <summary>Ward overview for the last <paramref name="days"/> days, or all time when null.</summary>
    Task<WardReportDto> GetWardReportAsync(int? days, CancellationToken ct = default);
}
