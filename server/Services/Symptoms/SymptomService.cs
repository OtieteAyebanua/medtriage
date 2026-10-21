using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Symptoms;

public class SymptomService(IDocumentRepository<Symptom> symptoms) : ISymptomService
{
    public async Task<List<SymptomDto>> ListAsync(string? category, CancellationToken ct = default)
    {
        var q = symptoms.Query();

        var filter = category?.Trim();
        if (!string.IsNullOrEmpty(filter)) q = q.Where(s => s.Category == filter);

        var list = await q
            .OrderBy(s => s.Category)
            .ThenByDescending(s => s.SeverityScale)
            .ThenBy(s => s.SymptomName)
            .ToListAsync(ct);

        return list.Select(SymptomDto.From).ToList();
    }
}
