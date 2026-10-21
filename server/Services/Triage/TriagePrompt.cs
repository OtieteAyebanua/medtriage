using System.Globalization;
using System.Text;
using System.Text.Json;

namespace MedTriage.Server.Services.Triage;

/// <summary>What a language model is told, and the JSON shape it must answer in.</summary>
public static class TriagePrompt
{
    public const string System = """
        You are a triage assistant for nurses at a primary healthcare facility in Nigeria.
        Assign an urgency level on this 5-level scale:
        1 = immediate: life-threatening. Unresponsive or confused, seizures, severe breathing difficulty, oxygen saturation below 90%, signs of shock, crushing chest pain, stroke signs.
        2 = emergent: see within 10 minutes. Stiff neck with fever, oxygen saturation 90-93%, temperature 39.5 °C or higher, heart rate above 120 or below 45, respiratory rate above 28, bleeding in pregnancy, severe pain.
        3 = urgent: see within 30 minutes. Fever 38-39.4 °C, moderate pain, shortness of breath with normal oxygen, vomiting or diarrhoea with signs of dehydration.
        4 = less urgent: see within 60 minutes. Stable, with mild symptoms such as cough, headache or mild diarrhoea.
        5 = non-urgent: routine care. Stable with no worrying symptoms, or a planned follow-up.

        Rules:
        - Use only the information given. Never invent symptoms, vital signs or history.
        - Normal vital signs with only mild symptoms means level 4 or 5.
        - When in doubt between two levels, choose the more urgent one.
        - Allergies and chronic conditions are background information, not diagnoses. Never list an allergy as a condition.
        - Fever in this region is malaria until proven otherwise; also consider typhoid, pneumonia, tuberculosis, gastroenteritis, meningitis, sickle cell crisis, and complications of hypertension, diabetes and pregnancy.

        Answer in JSON:
        - reasoning: at most 2 short sentences explaining the level, naming the specific vital signs or symptoms that drove it.
        - urgency_score: the level, 1 to 5.
        - differential_diagnosis: up to 3 likely causes of the current complaint, most likely first, each with a probability between 0 and 1 and a one-sentence rationale.
        - suggested_tests: up to 4 simple tests a primary care facility can do (e.g. malaria rapid test, full blood count, urinalysis, blood glucose).
        - confidence: how sure you are of the level, between 0 and 1.
        """;

    /// <summary>
    /// JSON schema for Ollama's structured output. "reasoning" comes first so the model explains
    /// itself before it commits to a level.
    /// </summary>
    public static readonly JsonElement ResponseSchema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "reasoning": { "type": "string" },
            "urgency_score": { "type": "integer", "minimum": 1, "maximum": 5 },
            "differential_diagnosis": {
              "type": "array",
              "maxItems": 3,
              "items": {
                "type": "object",
                "properties": {
                  "condition": { "type": "string" },
                  "probability": { "type": "number", "minimum": 0, "maximum": 1 },
                  "rationale": { "type": "string" }
                },
                "required": ["condition", "probability", "rationale"]
              }
            },
            "suggested_tests": { "type": "array", "maxItems": 4, "items": { "type": "string" } },
            "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
          },
          "required": ["reasoning", "urgency_score", "differential_diagnosis", "suggested_tests", "confidence"]
        }
        """).RootElement;

    /// <summary>The patient's assessment in plain words, e.g. "Patient: 32-year-old male. …".</summary>
    public static string Describe(InferenceRequest r)
    {
        var c = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        var p = r.Patient;

        var who = p.Age is { } age ? $"{age}-year-old {p.Sex?.ToLowerInvariant() ?? "patient"}" : p.Sex ?? "patient of unknown age";
        sb.AppendLine($"Patient: {who}.{(string.IsNullOrWhiteSpace(p.BloodType) ? "" : $" Blood type {p.BloodType}.")}");
        sb.AppendLine($"Chronic conditions: {p.ChronicConditions ?? "none recorded"}. Allergies: {p.Allergies ?? "none recorded"}.");
        sb.AppendLine($"Visit type: {r.VisitType.Replace('_', '-')}.");
        sb.AppendLine($"Chief complaint: \"{r.ChiefComplaint}\"");

        var v = r.Vitals;
        var measured = new List<string>();
        var missing = new List<string>();
        void Vital(string name, string? value) => (value is null ? missing : measured).Add(value is null ? name : $"{name} {value}");
        Vital("temperature", v.Temperature?.ToString("0.0", c) + (v.Temperature is null ? null : " °C"));
        Vital("blood pressure", v.BloodPressure is null ? null : $"{v.BloodPressure} mmHg");
        Vital("heart rate", v.HeartRate is null ? null : $"{v.HeartRate} bpm");
        Vital("oxygen saturation", v.OxygenLevel is null ? null : $"{v.OxygenLevel.Value.ToString("0", c)}%");
        Vital("respiratory rate", v.RespiratoryRate is null ? null : $"{v.RespiratoryRate} breaths/min");
        sb.AppendLine($"Vital signs: {(measured.Count > 0 ? string.Join("; ", measured) : "none measured")}.");
        if (missing.Count > 0 && measured.Count > 0) sb.AppendLine($"Not measured: {string.Join(", ", missing)}.");

        if (r.Symptoms.Count == 0)
        {
            sb.AppendLine("Symptoms: none selected.");
        }
        else
        {
            sb.AppendLine("Symptoms:");
            foreach (var s in r.Symptoms)
            {
                sb.Append($"- {s.Name} ({s.Severity}, {s.Duration})");
                sb.AppendLine(string.IsNullOrWhiteSpace(s.Notes) ? "" : $". Notes: {s.Notes}");
            }
        }

        return sb.ToString().TrimEnd();
    }
}
