namespace MedTriage.Server.Models;

/// <summary>
/// One visit / triage assessment, including the AI result and the doctor's review.
/// Table: patient_records. See "Record lifecycle" in API_README.md.
/// </summary>
public class PatientRecord
{
    public int RecordId { get; set; }
    public int PatientId { get; set; }

    /// <summary>The worker who ran the triage (taken from the session).</summary>
    public int RecordedBy { get; set; }

    /// <summary>walk_in, emergency, referral or follow_up.</summary>
    public string VisitType { get; set; } = null!;

    public string ChiefComplaint { get; set; } = null!;

    // Vitals: null when not measured
    public double? VitalsTemperature { get; set; }
    public string? VitalsBloodPressure { get; set; }
    public int? VitalsHeartRate { get; set; }
    public double? VitalsOxygenLevel { get; set; }
    public int? VitalsRespiratoryRate { get; set; }

    // AI assessment
    /// <summary>1 (immediate) to 5 (non-urgent).</summary>
    public int AiUrgencyScore { get; set; }

    /// <summary>immediate, emergent, urgent, less_urgent or non_urgent.</summary>
    public string AiTriageLevel { get; set; } = null!;

    /// <summary>0–1; null for the rule engine.</summary>
    public double? AiConfidence { get; set; }

    public string AiReasoning { get; set; } = null!;

    /// <summary>JSON array of strings.</summary>
    public string? AiSuggestedTests { get; set; }

    /// <summary>JSON array of { condition, probability, rationale }.</summary>
    public string? AiDifferentialDiagnosis { get; set; }

    // Doctor review
    public int? AssignedTo { get; set; }

    /// <summary>pending, accepted or overridden.</summary>
    public string OverrideStatus { get; set; } = "pending";

    public string? OverrideReason { get; set; }

    /// <summary>Triage level key after review; set to the AI level when the record is created.</summary>
    public string? FinalTriageLevel { get; set; }

    public string? Diagnosis { get; set; }
    public int? TreatedBy { get; set; }

    /// <summary>waiting, triaged, in_progress, treated, discharged or referred.</summary>
    public string Status { get; set; } = "waiting";

    /// <summary>True only for the patient's latest assessment.</summary>
    public bool IsCurrent { get; set; } = true;

    public DateTime VisitDate { get; set; }

    public Patient Patient { get; set; } = null!;
    public HealthcareWorker Recorder { get; set; } = null!;
    public HealthcareWorker? Assignee { get; set; }
    public HealthcareWorker? Treater { get; set; }
    public ICollection<RecordSymptom> RecordSymptoms { get; set; } = new List<RecordSymptom>();
}
