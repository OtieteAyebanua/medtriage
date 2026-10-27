using System.Reflection;
using MedTriage.Server.Common;
using MedTriage.Server.Dtos;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Services.Triage;

public class TriageService(
    IDocumentRepository<Patient> patients,
    IDocumentRepository<Symptom> symptoms,
    IDocumentRepository<PatientRecord> records,
    IInferenceService inference,
    DiagnosisModel diagnosis) : ITriageService
{
    public async Task<TriageResponse> RunAsync(RunTriageRequest request, int recordedByUserId, CancellationToken ct = default)
    {
        // ---- Validate input ----
        var patientId = Validate.PositiveId(request.PatientId, "patientId");
        var visitType = Validate.OneOf(request.VisitType, ClinicalValues.VisitTypes, "visitType", fallback: "walk_in");
        var chiefComplaint = Validate.RequiredString(request.ChiefComplaint, "chiefComplaint", 1000);

        var v = request.Vitals;
        var temperature = Validate.OptionalNumber(v?.Temperature, "vitals.temperature", 25, 45);
        var bloodPressure = Validate.OptionalBloodPressure(v?.BloodPressure, "vitals.bloodPressure");
        var heartRate = ToInt(Validate.OptionalNumber(v?.HeartRate, "vitals.heartRate", 20, 250));
        var oxygenLevel = Validate.OptionalNumber(v?.OxygenLevel, "vitals.oxygenLevel", 50, 100);
        var respiratoryRate = ToInt(Validate.OptionalNumber(v?.RespiratoryRate, "vitals.respiratoryRate", 4, 80));

        var symptomInputs = (request.Symptoms ?? [])
            .Select((s, i) => new
            {
                SymptomId = Validate.PositiveId(s?.SymptomId, $"symptoms[{i}].symptomId"),
                Severity = Validate.OneOf(s?.Severity, ClinicalValues.Severities, $"symptoms[{i}].severity", fallback: "moderate"),
                Duration = Validate.OptionalString(s?.Duration, $"symptoms[{i}].duration", 100) ?? "unknown",
                Notes = Validate.OptionalString(s?.Notes, $"symptoms[{i}].notes", 1000),
            })
            .ToList();

        var sc = request.Screening;
        var daysFebrile = ToInt(Validate.OptionalNumber(sc?.DaysFebrile, "screening.daysFebrile", 0, 365));
        var avpu = string.IsNullOrWhiteSpace(sc?.Avpu) ? null : Validate.OneOf(sc.Avpu, ClinicalValues.AvpuLevels, "screening.avpu");
        var mobility = string.IsNullOrWhiteSpace(sc?.Mobility)
            ? null
            : Validate.OneOf(sc.Mobility, ClinicalValues.MobilityLevels, "screening.mobility");
        var symptomFlags = sc?.SymptomFlags ?? [];
        var unknownFlags = symptomFlags.Keys.Where(k => !FlagProperties.ContainsKey(k)).ToList();
        if (unknownFlags.Count > 0)
        {
            throw ApiException.BadRequest($"Unknown symptom flags: {string.Join(", ", unknownFlags)}", "screening.symptomFlags");
        }

        var symptomIds = symptomInputs.Select(s => s.SymptomId).ToList();
        if (symptomIds.Distinct().Count() != symptomIds.Count)
        {
            throw ApiException.BadRequest("Each symptom can only be listed once", "symptoms");
        }

        // ---- Resolve references ----
        var patient = await patients.FirstOrDefaultAsync(p => p.PatientId == patientId, ct: ct)
            ?? throw ApiException.NotFound("Patient not found");

        var catalogue = symptomIds.Count == 0
            ? []
            : (await symptoms.ListAsync(s => symptomIds.Contains(s.SymptomId), ct)).ToDictionary(s => s.SymptomId);
        var unknown = symptomIds.Where(id => !catalogue.ContainsKey(id)).ToList();
        if (unknown.Count > 0)
        {
            throw ApiException.BadRequest($"Unknown symptom IDs: {string.Join(", ", unknown)}", "symptoms");
        }

        // ---- 1. Diagnosis model (runs alongside triage; never fails the request) ----
        var diagnosisTask = diagnosis.DiagnoseAsync(new DiagnosisRequest(
            ClinicalValues.AgeInYears(patient.DateOfBirth),
            patient.Gender,
            sc?.Pregnant,
            sc?.RainySeason,
            daysFebrile,
            temperature,
            heartRate,
            respiratoryRate,
            Systolic(bloodPressure),
            oxygenLevel,
            avpu,
            mobility,
            symptomFlags), ct);

        // ---- 2. Local model inference, with the rule engine as safety fallback ----
        var result = await inference.AssessAsync(new InferenceRequest(
            new InferencePatient(
                ClinicalValues.AgeFrom(patient.DateOfBirth),
                patient.Gender,
                patient.BloodType,
                patient.ChronicConditions,
                patient.Allergies),
            visitType,
            chiefComplaint,
            symptomInputs
                .Select(s => new InferenceSymptom(
                    s.SymptomId, catalogue[s.SymptomId].SymptomName, catalogue[s.SymptomId].Category, s.Severity, s.Duration, s.Notes))
                .ToList(),
            new InferenceVitals(temperature, bloodPressure, heartRate, oxygenLevel, respiratoryRate)), ct);

        // The diagnosis model's conditions replace the rule engine's pattern-matched ones when it has any
        var conditions = await diagnosisTask;
        if (conditions.Count > 0) result = result with { DifferentialDiagnosis = conditions };

        // ---- 3. Save: retire the previous current assessment, add the new record and its symptoms ----
        var previous = await records.Query(tracking: true)
            .Where(r => r.PatientId == patientId && r.IsCurrent)
            .ToListAsync(ct);
        foreach (var old in previous) old.IsCurrent = false;

        var record = new PatientRecord
        {
            PatientId = patientId,
            RecordedBy = recordedByUserId,
            VisitType = visitType,
            ChiefComplaint = chiefComplaint,
            VitalsTemperature = temperature,
            VitalsBloodPressure = bloodPressure,
            VitalsHeartRate = heartRate,
            VitalsOxygenLevel = oxygenLevel,
            VitalsRespiratoryRate = respiratoryRate,
            Pregnant = sc?.Pregnant,
            RainySeason = sc?.RainySeason,
            DaysFebrile = daysFebrile,
            Avpu = avpu,
            Mobility = mobility,
            AiUrgencyScore = result.UrgencyScore,
            AiTriageLevel = result.TriageLevel,
            AiConfidence = result.Confidence,
            AiReasoning = result.Reasoning,
            AiSuggestedTests = JsonColumn.Write(result.SuggestedTests),
            AiDifferentialDiagnosis = JsonColumn.Write(result.DifferentialDiagnosis),
            OverrideStatus = "pending",
            FinalTriageLevel = result.TriageLevel,
            Status = "triaged",
            IsCurrent = true,
            VisitDate = DateTime.UtcNow,
            RecordSymptoms = symptomInputs
                .Select(s => new RecordSymptom { SymptomId = s.SymptomId, Severity = s.Severity, Duration = s.Duration, Notes = s.Notes })
                .ToList(),
        };
        foreach (var (flag, value) in symptomFlags) FlagProperties[flag].SetValue(record, value);
        await records.AddAsync(record, ct);

        // One SaveChanges = one transaction, so the old record is only retired if the new one is saved
        await records.SaveChangesAsync(ct);

        return new TriageResponse(
            Success: true,
            record.RecordId,
            result.Engine,
            result.Model,
            result.SafetyRaisedFrom,
            new TriageResultDto(
                result.UrgencyScore,
                result.TriageLevel.Replace('_', ' ').ToUpperInvariant(),
                result.TriageLevel,
                result.Confidence,
                result.Reasoning,
                result.SuggestedTests,
                result.DifferentialDiagnosis));
    }

    private static int? ToInt(double? value) => value is null ? null : (int)Math.Round(value.Value);

    /// <summary>Systolic part of a reading already normalised to "sys/dia".</summary>
    private static int? Systolic(string? bloodPressure) =>
        bloodPressure is null ? null : int.Parse(bloodPressure[..bloodPressure.IndexOf('/')]);

    // Symptom flag -> PatientRecord property, e.g. abdominal_pain -> AbdominalPain
    private static readonly Dictionary<string, PropertyInfo> FlagProperties = ClinicalValues.SymptomFlags.ToDictionary(
        f => f,
        f => typeof(PatientRecord).GetProperty(string.Concat(f.Split('_').Select(w => char.ToUpperInvariant(w[0]) + w[1..])))
            ?? throw new InvalidOperationException($"PatientRecord has no property for symptom flag '{f}'"));
}
