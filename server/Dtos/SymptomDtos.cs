using MedTriage.Server.Common;
using MedTriage.Server.Models;

namespace MedTriage.Server.Dtos;

/// <summary>SymptomItem in src/Homescreen/types.ts.</summary>
[SnakeCaseJson]
public record SymptomDto(
    int SymptomId,
    string SymptomName,
    string Category,
    string Description,
    int SeverityScale,
    string? RelatedConditions,
    string? Synonyms,
    string? FollowUpQuestions)
{
    public static SymptomDto From(Symptom s) =>
        new(s.SymptomId, s.SymptomName, s.Category, s.Description, s.SeverityScale, s.RelatedConditions, s.Synonyms, s.FollowUpQuestions);
}

public record SymptomListResponse(List<SymptomDto> Symptoms);
