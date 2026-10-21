using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Symptoms;

public interface ISymptomService
{
    /// <summary>The symptom catalogue, optionally for one category.</summary>
    Task<List<SymptomDto>> ListAsync(string? category, CancellationToken ct = default);
}
