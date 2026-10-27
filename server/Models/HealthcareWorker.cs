namespace MedTriage.Server.Models;

/// <summary>Staff who sign in to the app. Table: healthcare_workers.</summary>
public class HealthcareWorker
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = null!;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = null!;
    public string EmployeeId { get; set; } = null!;
    public string Gender { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;

    /// <summary>doctor, nurse, lab_tech, pharmacist or admin.</summary>
    public string Position { get; set; } = null!;

    public string? Phone { get; set; }
    public string? Department { get; set; }

    /// <summary>Professional registration / licence number (MDCN, NMCN, …). Not required for admin staff.</summary>
    public string? LicenseNumber { get; set; }
    public DateOnly? LicenseExpiry { get; set; }

    /// <summary>Deactivated workers can't sign in. Set from the admin console.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When an admin confirmed the worker's identity and licence.</summary>
    public DateTime? VerifiedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<Session> Sessions { get; set; } = new List<Session>();
    public ICollection<PatientRecord> RecordedRecords { get; set; } = new List<PatientRecord>();
    public ICollection<PatientRecord> AssignedRecords { get; set; } = new List<PatientRecord>();
    public ICollection<PatientRecord> TreatedRecords { get; set; } = new List<PatientRecord>();
}
