using System.Text;
using MedTriage.Server.Common;
using MedTriage.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace MedTriage.Server.Data;

public class MedTriageDbContext(DbContextOptions<MedTriageDbContext> options) : DbContext(options)
{
    public DbSet<HealthcareWorker> HealthcareWorkers => Set<HealthcareWorker>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<AdminSession> AdminSessions => Set<AdminSession>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientRecord> PatientRecords => Set<PatientRecord>();
    public DbSet<Symptom> Symptoms => Set<Symptom>();
    public DbSet<RecordSymptom> RecordSymptoms => Set<RecordSymptom>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<HealthcareWorker>(e =>
        {
            e.ToTable("healthcare_workers", t =>
                t.HasCheckConstraint("ck_healthcare_workers_position", $"position IN ({SqlList(ClinicalValues.Positions)})"));
            e.HasKey(w => w.UserId);
            e.Property(w => w.FirstName).HasMaxLength(50);
            e.Property(w => w.MiddleName).HasMaxLength(50);
            e.Property(w => w.LastName).HasMaxLength(50);
            e.Property(w => w.EmployeeId).HasMaxLength(30);
            e.Property(w => w.Gender).HasMaxLength(10);
            e.Property(w => w.Email).HasMaxLength(100);
            e.Property(w => w.Position).HasMaxLength(20);
            e.Property(w => w.Phone).HasMaxLength(30);
            e.Property(w => w.Department).HasMaxLength(100);
            e.Property(w => w.LicenseNumber).HasMaxLength(50);
            e.Property(w => w.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            e.HasIndex(w => w.EmployeeId).IsUnique();
            e.HasIndex(w => w.Email).IsUnique();
        });

        model.Entity<AdminSession>(e =>
        {
            e.ToTable("admin_sessions");
            e.HasKey(s => s.Id);
            e.Property(s => s.Token).HasMaxLength(100);
            e.Property(s => s.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            e.HasIndex(s => s.Token).IsUnique();
        });

        model.Entity<Session>(e =>
        {
            e.ToTable("sessions");
            e.HasKey(s => s.Id);
            e.Property(s => s.Token).HasMaxLength(100);
            e.Property(s => s.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            e.HasIndex(s => s.Token).IsUnique();
            e.HasIndex(s => s.UserId);
            e.HasOne(s => s.Worker)
                .WithMany(w => w.Sessions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Patient>(e =>
        {
            e.ToTable("patients", t =>
                t.HasCheckConstraint("ck_patients_blood_type", $"blood_type IN ({SqlList(ClinicalValues.BloodTypes)})"));
            e.HasKey(p => p.PatientId);
            e.Property(p => p.FirstName).HasMaxLength(50);
            e.Property(p => p.MiddleName).HasMaxLength(50);
            e.Property(p => p.LastName).HasMaxLength(50);
            e.Property(p => p.Gender).HasMaxLength(10);
            e.Property(p => p.Email).HasMaxLength(100);
            e.Property(p => p.BloodType).HasMaxLength(3);
            e.Property(p => p.Allergies).HasMaxLength(2000);
            e.Property(p => p.ChronicConditions).HasMaxLength(2000);
            e.Property(p => p.PhotoPath).HasMaxLength(255);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            e.HasIndex(p => new { p.LastName, p.FirstName });
            e.HasIndex(p => p.CreatedAt);
        });

        model.Entity<PatientRecord>(e =>
        {
            e.ToTable("patient_records", t =>
            {
                t.HasCheckConstraint("ck_patient_records_visit_type", $"visit_type IN ({SqlList(ClinicalValues.VisitTypes)})");
                t.HasCheckConstraint("ck_patient_records_ai_urgency_score", "ai_urgency_score BETWEEN 1 AND 5");
                t.HasCheckConstraint("ck_patient_records_ai_triage_level", $"ai_triage_level IN ({SqlList(ClinicalValues.TriageLevels)})");
                t.HasCheckConstraint("ck_patient_records_ai_confidence", "ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1");
                t.HasCheckConstraint("ck_patient_records_final_triage_level",
                    $"final_triage_level IS NULL OR final_triage_level IN ({SqlList(ClinicalValues.TriageLevels)})");
                t.HasCheckConstraint("ck_patient_records_override_status", $"override_status IN ({SqlList(ClinicalValues.OverrideStatuses)})");
                t.HasCheckConstraint("ck_patient_records_status", $"status IN ({SqlList(ClinicalValues.RecordStatuses)})");
                t.HasCheckConstraint("ck_patient_records_days_febrile", "days_febrile IS NULL OR days_febrile >= 0");
                t.HasCheckConstraint("ck_patient_records_avpu", $"avpu IS NULL OR avpu IN ({SqlList(ClinicalValues.AvpuLevels)})");
                t.HasCheckConstraint("ck_patient_records_mobility", $"mobility IS NULL OR mobility IN ({SqlList(ClinicalValues.MobilityLevels)})");
                t.HasCheckConstraint("ck_patient_records_tews_score", "tews_score IS NULL OR tews_score >= 0");
                t.HasCheckConstraint("ck_patient_records_triage_category",
                    $"triage_category IS NULL OR triage_category IN ({SqlList(ClinicalValues.TriageCategories)})");
            });
            e.HasKey(r => r.RecordId);
            e.Property(r => r.VisitType).HasMaxLength(20);
            e.Property(r => r.ChiefComplaint).HasMaxLength(1000);
            e.Property(r => r.VitalsBloodPressure).HasMaxLength(7);
            e.Property(r => r.Avpu).HasMaxLength(20);
            e.Property(r => r.Mobility).HasMaxLength(20);
            e.Property(r => r.TriageCategory).HasMaxLength(10);
            e.Property(r => r.AiTriageLevel).HasMaxLength(20);
            e.Property(r => r.OverrideStatus).HasMaxLength(20).HasDefaultValue("pending");
            e.Property(r => r.OverrideReason).HasMaxLength(2000);
            e.Property(r => r.FinalTriageLevel).HasMaxLength(20);
            e.Property(r => r.Diagnosis).HasMaxLength(1000);
            e.Property(r => r.Status).HasMaxLength(20).HasDefaultValue("waiting");
            e.Property(r => r.VisitDate).HasDefaultValueSql("CURRENT_TIMESTAMP");

            e.HasOne(r => r.Patient)
                .WithMany(p => p.Records)
                .HasForeignKey(r => r.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.Recorder)
                .WithMany(w => w.RecordedRecords)
                .HasForeignKey(r => r.RecordedBy)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.Assignee)
                .WithMany(w => w.AssignedRecords)
                .HasForeignKey(r => r.AssignedTo)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(r => r.Treater)
                .WithMany(w => w.TreatedRecords)
                .HasForeignKey(r => r.TreatedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // Patient history and "last 3 visits" lookups
            e.HasIndex(r => new { r.PatientId, r.VisitDate });
            // Review queue: current + pending, sorted by urgency then wait time
            e.HasIndex(r => new { r.IsCurrent, r.OverrideStatus, r.AiUrgencyScore, r.VisitDate });
            // Ward report window and recent activity
            e.HasIndex(r => r.VisitDate);
        });

        model.Entity<Symptom>(e =>
        {
            e.ToTable("symptoms", t =>
                t.HasCheckConstraint("ck_symptoms_severity_scale", "severity_scale BETWEEN 1 AND 5"));
            e.HasKey(s => s.SymptomId);
            e.Property(s => s.SymptomName).HasMaxLength(100);
            e.Property(s => s.Category).HasMaxLength(50);
            e.Property(s => s.Description).HasMaxLength(1000);
            e.HasIndex(s => s.SymptomName).IsUnique();
            e.HasIndex(s => s.Category);
        });

        model.Entity<RecordSymptom>(e =>
        {
            e.ToTable("record_symptoms", t =>
                t.HasCheckConstraint("ck_record_symptoms_severity", $"severity IN ({SqlList(ClinicalValues.Severities)})"));
            e.HasKey(rs => rs.RecordSymptomId);
            e.Property(rs => rs.Severity).HasMaxLength(10);
            e.Property(rs => rs.Duration).HasMaxLength(100);
            e.Property(rs => rs.Notes).HasMaxLength(1000);
            e.HasIndex(rs => new { rs.RecordId, rs.SymptomId }).IsUnique();
            e.HasOne(rs => rs.Record)
                .WithMany(r => r.RecordSymptoms)
                .HasForeignKey(rs => rs.RecordId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(rs => rs.Symptom)
                .WithMany(s => s.RecordSymptoms)
                .HasForeignKey(rs => rs.SymptomId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        foreach (var entity in model.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                // Column names follow the snake_case naming in API_README.md (FirstName -> first_name).
                property.SetColumnName(ToSnakeCase(property.Name));

                // SQLite has no timezone, so timestamps would read back as Kind=Unspecified and serialize
                // without "Z"; the browser would then parse them as local time. Everything is stored in UTC.
                if ((Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType) == typeof(DateTime))
                {
                    property.SetValueConverter(UtcDateTime);
                }
            }
        }
    }

    private static readonly ValueConverter<DateTime, DateTime> UtcDateTime = new(
        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    private static string SqlList(IEnumerable<string> values) =>
        string.Join(", ", values.Select(v => $"'{v}'"));

    private static string ToSnakeCase(string name)
    {
        var sb = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0) sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }
}
