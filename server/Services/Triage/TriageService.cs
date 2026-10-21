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
    IInferenceService inference) : ITriageService
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

        // ---- 1. Inference (external model if configured, otherwise the rule engine) ----
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

        // ---- 2. Save: retire the previous current assessment, add the new record and its symptoms ----
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
        await records.AddAsync(record, ct);

        // One SaveChanges = one transaction, so the old record is only retired if the new one is saved
        await records.SaveChangesAsync(ct);

        return new TriageResponse(
            Success: true,
            record.RecordId,
            result.Engine,
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
}
