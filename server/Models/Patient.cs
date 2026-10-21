namespace MedTriage.Server.Models;

/// <summary>A registered patient. Table: patients. Matches PatientItem in src/Homescreen/types.ts.</summary>
public class Patient
{
    public int PatientId { get; set; }
    public string FirstName { get; set; } = null!;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = null!;
    public DateOnly DateOfBirth { get; set; }
    public string Gender { get; set; } = null!;
    public string? Email { get; set; }

    /// <summary>A+, A-, B+, B-, AB+, AB-, O+ or O-.</summary>
    public string BloodType { get; set; } = null!;

    public string? Allergies { get; set; }
    public string? ChronicConditions { get; set; }

    /// <summary>Relative path inside UPLOAD_DIR, e.g. patients/12-1760000000000.jpg. Changes on every upload.</summary>
    public string? PhotoPath { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<PatientRecord> Records { get; set; } = new List<PatientRecord>();
}
