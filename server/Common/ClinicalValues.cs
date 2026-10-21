namespace MedTriage.Server.Common;

/// <summary>Allowed values for coded columns. See "Enums" in API_README.md. The database enforces these too.</summary>
public static class ClinicalValues
{
    public static readonly string[] Positions = ["doctor", "nurse", "lab_tech", "pharmacist", "admin"];
    public static readonly string[] VisitTypes = ["walk_in", "emergency", "referral", "follow_up"];
    public static readonly string[] BloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    public static readonly string[] Severities = ["mild", "moderate", "severe"];

    /// <summary>Index + 1 is the urgency score: 1 = immediate … 5 = non_urgent.</summary>
    public static readonly string[] TriageLevels = ["immediate", "emergent", "urgent", "less_urgent", "non_urgent"];

    public static readonly string[] OverrideStatuses = ["pending", "accepted", "overridden"];
    public static readonly string[] ReviewActions = ["accepted", "overridden"];
    public static readonly string[] RecordStatuses = ["waiting", "triaged", "in_progress", "treated", "discharged", "referred"];
    public static readonly string[] Dispositions = ["in_progress", "treated", "discharged", "referred"];

    public static string TriageLevelFromScore(int score) => TriageLevels[Math.Clamp(score, 1, 5) - 1];

    /// <summary>1–5, or 0 when the level is unknown.</summary>
    public static int ScoreFromTriageLevel(string? level) => Array.IndexOf(TriageLevels, level) + 1;

    public static int AgeFrom(DateOnly dateOfBirth)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth > today.AddYears(-age)) age--;
        return Math.Max(0, age);
    }
}
