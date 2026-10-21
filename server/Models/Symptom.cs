namespace MedTriage.Server.Models;

/// <summary>Master symptom catalogue. Table: symptoms. Matches SymptomItem in src/Homescreen/types.ts.</summary>
public class Symptom
{
    public int SymptomId { get; set; }
    public string SymptomName { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Description { get; set; } = null!;

    /// <summary>1–5 baseline urgency weight.</summary>
    public int SeverityScale { get; set; }

    public string? RelatedConditions { get; set; }

    /// <summary>Comma-separated; the symptom search matches against it.</summary>
    public string? Synonyms { get; set; }

    /// <summary>One string; the UI splits it on "?" into separate questions.</summary>
    public string? FollowUpQuestions { get; set; }

    public ICollection<RecordSymptom> RecordSymptoms { get; set; } = new List<RecordSymptom>();
}
