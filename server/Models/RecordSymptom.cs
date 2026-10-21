namespace MedTriage.Server.Models;

/// <summary>A symptom recorded on a visit. Table: record_symptoms.</summary>
public class RecordSymptom
{
    public int RecordSymptomId { get; set; }
    public int RecordId { get; set; }
    public int SymptomId { get; set; }

    /// <summary>mild, moderate or severe (stored lowercase).</summary>
    public string Severity { get; set; } = null!;

    public string Duration { get; set; } = null!;
    public string? Notes { get; set; }

    public PatientRecord Record { get; set; } = null!;
    public Symptom Symptom { get; set; } = null!;
}
