using MedTriage.Server.Common;
using MedTriage.Server.Dtos;

namespace MedTriage.Server.Services.Triage;

/// <summary>
/// Built-in rule-based triage. Runs on every triage: it is the safety floor under the AI model's level, and the
/// whole result when no model is configured or the model fails (see <see cref="InferenceService"/>).
/// Ported from the original src/lib/triage-engine.ts: red-flag vitals and symptoms set the urgency
/// (1 = immediate … 5 = non-urgent), then symptom patterns produce a ranked differential diagnosis.
/// </summary>
public class RuleTriageEngine
{
    public InferenceResult Evaluate(InferenceRequest input)
    {
        var names = input.Symptoms.Select(s => s.Name.ToLowerInvariant()).ToList();
        var complaint = input.ChiefComplaint.ToLowerInvariant();
        bool AnySymptom(params string[] fragments) => names.Any(n => fragments.Any(n.Contains));

        var reasons = new List<string>();
        var tests = new List<string>();
        var diagnoses = new List<DifferentialDiagnosisDto>();
        var score = 5;
        void Raise(int to) => score = Math.Min(score, to);

        var v = input.Vitals;
        var spo2 = v.OxygenLevel;
        var hr = v.HeartRate;
        var rr = v.RespiratoryRate;
        var temp = v.Temperature;

        // ---- 1. Red flags and life-threatening vitals ----
        var isUnconscious = AnySymptom("unconscious", "altered", "coma")
            || complaint.Contains("unconscious") || complaint.Contains("collapsed");
        var hasChestPain = AnySymptom("chest pain") || complaint.Contains("chest pain");
        var hasNuchalRigidity = AnySymptom("neck stiffness", "nuchal rigidity");

        if (spo2 is < 90)
        {
            Raise(1);
            reasons.Add($"Critical hypoxia detected (SpO2 {spo2}% < 90%). Immediate oxygenation therapy indicated.");
            tests.AddRange(["Emergency Arterial Blood Gas (ABG)", "Chest X-Ray"]);
        }
        else if (spo2 is < 94)
        {
            Raise(2);
            reasons.Add($"Mild to moderate hypoxemia (SpO2 {spo2}%).");
            tests.AddRange(["Pulse Oximetry Monitoring", "Chest Radiography"]);
        }

        if (isUnconscious)
        {
            Raise(1);
            reasons.Add("Impaired consciousness / neurological depression requires immediate resuscitation pathway.");
            tests.AddRange(["Blood Glucose Test (Rule out hypoglycemia)", "Emergency Neurological Assessment"]);
        }

        if (hasChestPain)
        {
            Raise(1);
            reasons.Add("Acute chest pain presentation warrants immediate exclusion of Acute Coronary Syndrome.");
            tests.AddRange(["12-Lead Electrocardiogram (ECG)", "Serum Troponin I/T", "Creatine Kinase-MB"]);
        }

        if (hasNuchalRigidity)
        {
            Raise(2);
            reasons.Add("Nuchal rigidity / neck stiffness presentation strongly indicates acute meningeal irritation.");
            tests.AddRange(["Lumbar Puncture (CSF analysis)", "Blood Cultures", "Full Blood Count (FBC)"]);
        }

        if (temp is >= 39.5)
        {
            Raise(2);
            reasons.Add($"Hyperpyrexia observed (Core Temp {temp}°C >= 39.5°C). High risk of febrile convulsions or sepsis.");
        }
        else if (temp is >= 38.0)
        {
            Raise(3);
            reasons.Add($"Significant pyrexia (Core Temp {temp}°C).");
        }
        else if (temp is < 35.5)
        {
            Raise(2);
            reasons.Add($"Hypothermia (Core Temp {temp}°C < 35.5°C). Potential septic shock marker.");
        }

        if (hr is > 120 or < 45)
        {
            Raise(2);
            reasons.Add($"Hemodynamic compromise: Heart rate abnormal at {hr} bpm.");
        }

        if (rr is > 28)
        {
            Raise(2);
            reasons.Add($"Severe tachypnea (Respiratory rate {rr} breaths/min).");
        }

        // ---- Symptom weights ----
        var hasFever = AnySymptom("fever") || temp is >= 38.0;
        var hasHeadache = AnySymptom("headache");
        var hasVomiting = AnySymptom("vomit");
        var hasDiarrhoea = AnySymptom("diarrh"); // matches "diarrhea" and the catalogue's "diarrhoea"
        var hasCough = AnySymptom("cough");
        var hasDyspnoea = AnySymptom("shortness of breath", "dyspnea", "dyspnoea");
        var hasAbdominalPain = AnySymptom("abdominal");

        if (score > 3 && (hasFever || hasDyspnoea || hasAbdominalPain))
        {
            score = 3;
            reasons.Add($"Presenting {Describe((hasFever, "fever"), (hasDyspnoea, "shortness of breath"), (hasAbdominalPain, "abdominal pain"))} " +
                        "warrants prompt assessment within 30 minutes.");
        }

        if (score > 4 && (hasHeadache || hasVomiting || hasDiarrhoea || hasCough))
        {
            score = 4;
            reasons.Add($"Stable vital signs, but {Describe((hasHeadache, "headache"), (hasVomiting, "vomiting"), (hasDiarrhoea, "diarrhoea"), (hasCough, "cough"))} " +
                        "should be assessed within 60 minutes.");
        }

        // ---- 2. Differential diagnosis (tropical primary-care focus) ----
        if (hasFever || complaint.Contains("malaria") || complaint.Contains("fever"))
        {
            var p = 0.55;
            if (hasHeadache) p += 0.20;
            if (hasVomiting) p += 0.10;
            if (temp is > 38.5) p += 0.10;
            diagnoses.Add(new("Plasmodium Falciparum Malaria", Round(Math.Min(p, 0.94)),
                "Fever with characteristic chills, headache, and secondary gastrointestinal symptoms in endemic setting."));
            tests.AddRange(["Malaria Rapid Diagnostic Test (mRDT)", "Thick and Thin Blood Smear for Parasitemia"]);
        }

        if (hasNuchalRigidity || (hasFever && hasHeadache && isUnconscious))
        {
            var p = 0.60;
            if (hasNuchalRigidity) p += 0.25;
            if (hasHeadache) p += 0.10;
            diagnoses.Add(new("Acute Bacterial / Viral Meningitis", Round(Math.Min(p, 0.92)),
                "Classic triad of fever, severe cephalalgia, and positive signs of meningeal irritation."));
        }

        if (hasFever && (hasAbdominalPain || hasDiarrhoea))
        {
            var p = 0.45;
            if (hasAbdominalPain) p += 0.25;
            if (hasHeadache) p += 0.15;
            diagnoses.Add(new("Typhoid Fever (Salmonella Enterica)", Round(Math.Min(p, 0.85)),
                "Step-ladder pyrexia associated with gastrointestinal discomfort and tenderness."));
            tests.AddRange(["Widal Test / Typhoid IgG/IgM Rapid Test", "Stool & Blood Cultures"]);
        }

        if (hasCough || hasDyspnoea || rr is > 22)
        {
            var p = 0.40;
            if (hasDyspnoea) p += 0.25;
            if (hasFever) p += 0.20;
            diagnoses.Add(new("Lower Respiratory Tract Infection (Pneumonia)", Round(Math.Min(p, 0.88)),
                "Persistent productive cough with elevated respiratory effort and thermal elevation."));
            tests.AddRange(["Sputum Microscopic Examination", "Chest Radiograph"]);
        }

        if (hasVomiting && hasDiarrhoea)
        {
            diagnoses.Add(new("Acute Infectious Gastroenteritis with Dehydration Risk", 0.78,
                "Concurrent emesis and frequent diarrheal output requiring fluid electrolyte replenishment."));
            tests.AddRange(["Serum Electrolytes, Urea & Creatinine (E/U/Cr)", "Stool Routine and Microscopy"]);
        }

        if (diagnoses.Count == 0)
        {
            diagnoses.Add(new("Undifferentiated Acute Febrile / Clinical Illness", 0.50,
                "Non-specific presentation requiring full clinical baseline and doctor workup."));
            tests.AddRange(["Full Blood Count (FBC)", "Urinalysis"]);
        }

        if (reasons.Count == 0)
        {
            reasons.Add("Patient presents with mild, stable clinical parameters and low-urgency indicators.");
        }

        return new InferenceResult(
            score,
            ClinicalValues.TriageLevelFromScore(score),
            Confidence: null,
            string.Join(" ", reasons),
            tests.Distinct().ToList(),
            diagnoses.OrderByDescending(d => d.Probability).ToList(),
            Engine: "rules");
    }

    private static double Round(double p) => Math.Round(p, 2);

    /// <summary>"fever", "fever and cough", "fever, cough and vomiting" for the findings that are present.</summary>
    private static string Describe(params (bool Present, string Name)[] findings)
    {
        var names = findings.Where(f => f.Present).Select(f => f.Name).ToList();
        return names.Count <= 1 ? string.Concat(names) : $"{string.Join(", ", names[..^1])} and {names[^1]}";
    }
}
