namespace MedTriage.Server.Models;

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

    // Diagnosis-model inputs. Named after the training CSV columns; null means not asked.
    // age_years, sex, temp_c, spo2 and systolic_bp come from the patient and the vitals above.
    public bool? Pregnant { get; set; }
    public bool? RainySeason { get; set; }
    public int? DaysFebrile { get; set; }

    /// <summary>alert, voice, pain or unresponsive.</summary>
    public string? Avpu { get; set; }

    /// <summary>walking, with_help or immobile.</summary>
    public string? Mobility { get; set; }

    public bool? Chills { get; set; }
    public bool? Headache { get; set; }
    public bool? Vomiting { get; set; }
    public bool? Nausea { get; set; }
    public bool? Diarrhea { get; set; }
    public bool? Constipation { get; set; }
    public bool? AbdominalPain { get; set; }
    public bool? Cough { get; set; }
    public bool? Sputum { get; set; }
    public bool? BloodInSputum { get; set; }
    public bool? ChestPain { get; set; }
    public bool? DifficultyBreathing { get; set; }
    public bool? SoreThroat { get; set; }
    public bool? RunnyNose { get; set; }
    public bool? LossOfSmell { get; set; }
    public bool? Rash { get; set; }
    public bool? Itching { get; set; }
    public bool? NeckStiffness { get; set; }
    public bool? Convulsions { get; set; }
    public bool? Bleeding { get; set; }
    public bool? JointMusclePain { get; set; }
    public bool? PainBehindEyes { get; set; }
    public bool? RedEyes { get; set; }
    public bool? Jaundice { get; set; }
    public bool? DarkUrine { get; set; }
    public bool? Dysuria { get; set; }
    public bool? UrinaryFrequency { get; set; }
    public bool? Fatigue { get; set; }
    public bool? LossOfAppetite { get; set; }
    public bool? Sweating { get; set; }
    public bool? WeightLoss { get; set; }
    public bool? SwollenLymphNodes { get; set; }
    public bool? Dehydration { get; set; }

    /// <summary>Triage Early Warning Score (SATS).</summary>
    public int? TewsScore { get; set; }

    /// <summary>red, orange, yellow or green (SATS).</summary>
    public string? TriageCategory { get; set; }

    // AI assessment
    /// <summary>1 (immediate) to 5 (non-urgent).</summary>
    public int AiUrgencyScore { get; set; }

    /// <summary>immediate, emergent, urgent, less_urgent or non_urgent.</summary>
    public string AiTriageLevel { get; set; } = null!;

    /// <summary>0–1: the triage model's probability for the level it chose.</summary>
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
