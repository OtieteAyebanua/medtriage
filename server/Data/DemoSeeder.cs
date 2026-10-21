using MedTriage.Server.Common;
using MedTriage.Server.Models;
using MedTriage.Server.Services.Triage;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MedTriage.Server.Data;

/// <summary>
/// Fills an empty database with realistic demo data so the app is usable straight after install:
/// 8 staff (password from "DemoData:Password", default demo123), a 33-symptom catalogue, 20 patients and
/// ~45 visits over the last 30 days. Visits are run through the real rule engine, most are reviewed by a
/// doctor (a few overridden) and the newest stay pending so the review queue has work in it.
///
/// Runs on startup when "DemoData:Enabled" is true and there are no staff accounts yet.
/// Ported from the original prisma/seed.ts.
/// </summary>
public static class DemoSeeder
{
    public static async Task SeedIfEmptyAsync(IServiceProvider services, string password, CancellationToken ct = default)
    {
        var db = services.GetRequiredService<MedTriageDbContext>();
        if (await db.HealthcareWorkers.AnyAsync(ct) || await db.Patients.AnyAsync(ct)) return;

        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DemoSeeder));
        var hasher = services.GetRequiredService<IPasswordHasher<HealthcareWorker>>();
        var engine = services.GetRequiredService<RuleTriageEngine>();
        var rng = new DemoRandom(20260919);

        // ---- Staff ----
        var workers = Workers.Select(w =>
        {
            var worker = new HealthcareWorker
            {
                EmployeeId = w.EmployeeId, FirstName = w.First, MiddleName = w.Middle, LastName = w.Last,
                Gender = w.Gender, Email = w.Email, Position = w.Position, CreatedAt = DaysAgo(60),
            };
            worker.PasswordHash = hasher.HashPassword(worker, password);
            return worker;
        }).ToList();
        db.HealthcareWorkers.AddRange(workers);

        // ---- Symptom catalogue ----
        var symptoms = Symptoms.Select(s => new Symptom
        {
            SymptomName = s.Name, Category = s.Category, SeverityScale = s.Severity, Description = s.Description,
            RelatedConditions = s.Related, Synonyms = s.Synonyms, FollowUpQuestions = s.FollowUp,
        }).ToList();
        db.Symptoms.AddRange(symptoms);
        var symptomByName = symptoms.ToDictionary(s => s.SymptomName);

        // ---- Patients ----
        var patients = Patients.Select((p, i) => (Demo: p, Entity: new Patient
        {
            FirstName = p.First, MiddleName = p.Middle, LastName = p.Last, DateOfBirth = DateOnly.Parse(p.Dob),
            Gender = p.Gender, BloodType = p.BloodType, Email = p.Email, Allergies = p.Allergies,
            ChronicConditions = p.Chronic, CreatedAt = DaysAgo(40 - i, 8 + i % 8, i * 7 % 60),
        })).ToList();
        db.Patients.AddRange(patients.Select(p => p.Entity));

        await db.SaveChangesAsync(ct);

        // ---- Visits: each patient 1–4, spread over 30 days; the newest 6 stay pending for the review queue ----
        var doctors = workers.Where(w => w.Position == "doctor").ToList();
        var nurses = workers.Where(w => w.Position == "nurse").ToList();

        var plan = new List<(DemoPatient Demo, Patient Entity, Scenario Scenario, int Day)>();
        foreach (var (demo, entity) in patients)
        {
            var fitting = Scenarios.Where(s => s.Fits?.Invoke(demo) ?? true).ToList();
            var count = 1 + (int)(rng.Next() * 3) + (rng.Next() < 0.25 ? 1 : 0);
            for (var k = 0; k < count; k++) plan.Add((demo, entity, rng.Pick(fitting), (int)rng.Between(0, 30)));
        }
        plan = plan.OrderByDescending(v => v.Day).ToList(); // oldest first

        const int pendingCount = 6;
        for (var i = plan.Count - pendingCount; i < plan.Count; i++)
        {
            plan[i] = plan[i] with { Day = i >= plan.Count - 3 ? 0 : 1 };
        }

        var latestByPatient = new Dictionary<int, PatientRecord>();
        int reviewed = 0, overridden = 0;

        for (var i = 0; i < plan.Count; i++)
        {
            var (demo, patient, scenario, day) = plan[i];
            var nurse = rng.Pick(nurses);
            var doctor = rng.Pick(doctors);
            var pending = i >= plan.Count - pendingCount;
            var hour = pending && day == 0 ? Math.Max(6, DateTime.Now.Hour - (int)rng.Between(0, 3)) : (int)rng.Between(7, 20);
            var visitDate = DaysAgo(day, hour, (int)rng.Between(0, 59));

            var v = scenario.Vitals;
            double? temperature = v.Temp is null ? null : Math.Round(rng.Between(v.Temp[0], v.Temp[1]), 1);
            var bloodPressure = v.Bp is null ? null : rng.Pick(v.Bp);
            int? heartRate = v.Hr is null ? null : (int)Math.Round(rng.Between(v.Hr[0], v.Hr[1]));
            double? oxygen = v.Spo2 is null ? null : Math.Round(rng.Between(v.Spo2[0], v.Spo2[1]));
            int? respiratory = v.Rr is null ? null : (int)Math.Round(rng.Between(v.Rr[0], v.Rr[1]));

            // Run the real engine so the AI fields match the inputs
            var ai = engine.Evaluate(new InferenceRequest(
                new InferencePatient(ClinicalValues.AgeFrom(patient.DateOfBirth), patient.Gender, patient.BloodType, patient.ChronicConditions, patient.Allergies),
                scenario.VisitType,
                scenario.Complaint,
                scenario.Symptoms.Select(s => new InferenceSymptom(
                    symptomByName[s.Name].SymptomId, s.Name, symptomByName[s.Name].Category, s.Severity, s.Duration, s.Notes)).ToList(),
                new InferenceVitals(temperature, bloodPressure, heartRate, oxygen, respiratory)));

            var willOverride = !pending && scenario.Override is not null && scenario.Override.Value.Level != ai.TriageLevel;

            var record = new PatientRecord
            {
                PatientId = patient.PatientId,
                RecordedBy = nurse.UserId,
                VisitType = scenario.VisitType,
                ChiefComplaint = scenario.Complaint,
                VitalsTemperature = temperature,
                VitalsBloodPressure = bloodPressure,
                VitalsHeartRate = heartRate,
                VitalsOxygenLevel = oxygen,
                VitalsRespiratoryRate = respiratory,
                AiUrgencyScore = ai.UrgencyScore,
                AiTriageLevel = ai.TriageLevel,
                AiConfidence = Math.Round(rng.Between(0.62, 0.97), 2),
                AiReasoning = ai.Reasoning,
                AiSuggestedTests = JsonColumn.Write(ai.SuggestedTests),
                AiDifferentialDiagnosis = JsonColumn.Write(ai.DifferentialDiagnosis),
                AssignedTo = pending ? null : doctor.UserId,
                OverrideStatus = pending ? "pending" : willOverride ? "overridden" : "accepted",
                OverrideReason = willOverride ? scenario.Override!.Value.Reason : null,
                FinalTriageLevel = willOverride ? scenario.Override!.Value.Level : ai.TriageLevel,
                Diagnosis = pending ? null : scenario.Diagnosis,
                TreatedBy = pending ? null : doctor.UserId,
                Status = pending ? "triaged" : scenario.Outcome,
                IsCurrent = false,
                VisitDate = visitDate,
                RecordSymptoms = scenario.Symptoms.Select(s => new RecordSymptom
                {
                    SymptomId = symptomByName[s.Name].SymptomId, Severity = s.Severity, Duration = s.Duration, Notes = s.Notes,
                }).ToList(),
            };
            db.PatientRecords.Add(record);
            latestByPatient[patient.PatientId] = record;
            if (!pending) reviewed++;
            if (willOverride) overridden++;
        }

        // Exactly one current assessment per patient: their latest visit
        foreach (var record in latestByPatient.Values) record.IsCurrent = true;

        await db.SaveChangesAsync(ct);
        logger.LogWarning(
            "Demo data created: {Workers} staff (password \"{Password}\"), {Symptoms} symptoms, {Patients} patients, {Visits} visits ({Reviewed} reviewed, {Overridden} overridden, {Pending} awaiting review)",
            workers.Count, password, symptoms.Count, patients.Count, plan.Count, reviewed, overridden, plan.Count - reviewed);
    }

    /// <summary>Local time <paramref name="days"/> ago at the given hour, as UTC.</summary>
    private static DateTime DaysAgo(int days, int hour = 9, int minute = 0) =>
        DateTime.Today.AddDays(-days).AddHours(hour).AddMinutes(minute).ToUniversalTime();

    /// <summary>Deterministic generator, so every demo install looks the same.</summary>
    private sealed class DemoRandom(long seed)
    {
        private long _state = seed;

        public double Next()
        {
            _state = (_state * 1103515245 + 12345) & 0x7fffffff;
            return _state / (double)0x7fffffff;
        }

        public double Between(double min, double max) => min + Next() * (max - min);

        public T Pick<T>(IReadOnlyList<T> items) => items[(int)(Next() * items.Count) % items.Count];
    }

    /* ---------------- Data ---------------- */

    private record DemoWorker(string EmployeeId, string First, string? Middle, string Last, string Gender, string Email, string Position);

    private static readonly DemoWorker[] Workers =
    [
        new("HW-DOC-001", "Amina", "Fatima", "Bello", "Female", "amina.bello@hospital.lan", "doctor"),
        new("HW-NUR-002", "Grace", "Chioma", "Okafor", "Female", "grace.okafor@hospital.lan", "nurse"),
        new("HW-NUR-003", "Ibrahim", "Musa", "Danladi", "Male", "ibrahim.danladi@hospital.lan", "nurse"),
        new("HW-LAB-004", "Samuel", "Olu", "Adeyemi", "Male", "samuel.adeyemi@hospital.lan", "lab_tech"),
        new("HW-ADM-005", "Khadija", "Zainab", "Umar", "Female", "admin@hospital.lan", "admin"),
        new("HW-DOC-006", "Chukwuemeka", null, "Obi", "Male", "emeka.obi@hospital.lan", "doctor"),
        new("HW-NUR-007", "Halima", "Abubakar", "Sadiq", "Female", "halima.sadiq@hospital.lan", "nurse"),
        new("HW-PHA-008", "Tunde", "Olawale", "Bakare", "Male", "tunde.bakare@hospital.lan", "pharmacist"),
    ];

    private record DemoSymptom(string Name, string Category, int Severity, string Description, string Related, string Synonyms, string FollowUp);

    private static readonly DemoSymptom[] Symptoms =
    [
        // Systemic
        new("High Fever", "systemic", 4, "Elevated core body temperature above 38.5°C", "Malaria, Typhoid Fever, Sepsis, Meningitis", "pyrexia, hot body, chills, temperature", "Is the fever intermittent or continuous? Any rigors or shivering? Has the patient taken antimalarials?"),
        new("Generalised Weakness / Fatigue", "systemic", 2, "Marked loss of energy and reduced ability to perform usual activities", "Anaemia, Malaria, Dehydration, Diabetes", "tiredness, body weakness, malaise, lethargy", "How many days has it lasted? Any weight loss? Is the patient eating normally?"),
        new("Loss of Appetite", "systemic", 1, "Reduced desire to eat over several days", "Typhoid Fever, Hepatitis, Depression", "anorexia, not eating, poor feeding", "How long has the patient eaten less than usual? Any nausea with it?"),
        new("Excessive Sweating / Night Sweats", "systemic", 2, "Drenching sweats, especially at night", "Tuberculosis, Malaria, Lymphoma", "sweating at night, drenching sweat", "Do the sweats soak the bedding? Any cough longer than 2 weeks? Any weight loss?"),
        // Neurological
        new("Severe Headache", "neurological", 3, "Intense, persistent head pain", "Meningitis, Malaria, Hypertensive crisis, Migraine", "head pain, migraine, throbbing head", "Is it the worst headache of the patient’s life? Sudden or gradual onset? Any visual changes or vomiting?"),
        new("Neck Stiffness (Nuchal Rigidity)", "neurological", 5, "Painful resistance to passive neck flexion", "Meningitis, Subarachnoid haemorrhage", "stiff neck, cannot bend neck, nuchal rigidity", "Can the patient touch chin to chest? Any sensitivity to light? Any rash?"),
        new("Altered Consciousness / Confusion", "neurological", 5, "Reduced alertness, disorientation or unresponsiveness", "Cerebral malaria, Meningitis, Hypoglycaemia, Sepsis, Stroke", "confused, drowsy, unconscious, not responding, coma, collapsed", "Does the patient respond to voice or pain? Any history of diabetes? Any recent seizures or head injury?"),
        new("Seizures / Convulsions", "neurological", 5, "Episodes of uncontrolled shaking or loss of consciousness", "Cerebral malaria, Epilepsy, Febrile convulsion, Eclampsia", "fits, convulsing, shaking, epilepsy", "How long did the fit last? Is it the first episode? Was there fever before it? Is the patient pregnant?"),
        new("Dizziness / Fainting", "neurological", 3, "Light-headedness or brief loss of consciousness", "Anaemia, Dehydration, Hypotension, Arrhythmia", "faint, light-headed, syncope, vertigo, collapsed", "Did the patient fully lose consciousness? Does it happen on standing? Any palpitations?"),
        new("Weakness on One Side of Body", "neurological", 5, "Sudden unilateral limb or facial weakness", "Stroke, Transient ischaemic attack", "hemiparesis, face drooping, cannot move arm, slurred speech", "When exactly did it start? Any facial droop or speech difficulty? Known hypertension?"),
        // Respiratory
        new("Shortness of Breath (Dyspnea)", "respiratory", 4, "Difficulty breathing or breathlessness at rest or on exertion", "Pneumonia, Asthma, Heart failure, Anaemia", "breathless, cannot breathe, difficulty breathing, dyspnea, dyspnoea", "Does it occur at rest or only on exertion? Any wheeze? Can the patient speak in full sentences?"),
        new("Persistent Cough", "respiratory", 2, "Cough lasting more than one week", "Pneumonia, Tuberculosis, Bronchitis, Asthma", "coughing, chesty cough, dry cough", "Is it productive? Any blood in the sputum? Longer than 2 weeks? Any TB contact?"),
        new("Coughing up Blood", "respiratory", 4, "Blood in sputum (haemoptysis)", "Tuberculosis, Pneumonia, Pulmonary embolism", "haemoptysis, hemoptysis, blood in sputum, blood when coughing", "How much blood — streaks or cupfuls? Any weight loss or night sweats?"),
        new("Wheezing", "respiratory", 3, "High-pitched whistling sound on breathing out", "Asthma, COPD, Bronchiolitis, Allergic reaction", "whistling chest, tight chest, noisy breathing", "Known asthma? Any inhaler used today? Any recent exposure to smoke or dust?"),
        new("Sore Throat", "respiratory", 1, "Pain or scratchiness in the throat", "Pharyngitis, Tonsillitis, Common cold", "throat pain, painful swallowing", "Difficulty swallowing? Any white patches on the tonsils? Any fever?"),
        // Cardiac
        new("Chest Pain", "cardiac", 5, "Pressure, tightness or pain in the chest", "Acute coronary syndrome, Pneumonia, Pulmonary embolism, Pericarditis", "chest tightness, chest pressure, heart pain", "Does it spread to the arm, jaw or back? Worse on breathing in? Any sweating or nausea with it?"),
        new("Palpitations", "cardiac", 3, "Awareness of fast, irregular or pounding heartbeat", "Arrhythmia, Anaemia, Thyrotoxicosis, Anxiety", "racing heart, heart pounding, irregular heartbeat", "Is the beat regular or irregular? Any dizziness or chest pain with it? Caffeine or stimulant use?"),
        new("Swollen Legs / Ankles", "cardiac", 2, "Bilateral pitting oedema of the lower limbs", "Heart failure, Kidney disease, Pre-eclampsia, Liver disease", "oedema, edema, swollen feet, puffy legs", "Both legs or one? Any breathlessness lying flat? Is the patient pregnant?"),
        // Gastrointestinal
        new("Severe Abdominal Pain", "gastrointestinal", 4, "Intense pain anywhere in the abdomen", "Appendicitis, Typhoid perforation, Ectopic pregnancy, Intestinal obstruction", "stomach pain, belly pain, tummy ache, abdominal cramps", "Where exactly is the pain? Is the abdomen rigid or tender? Last menstrual period? Passing stool and gas?"),
        new("Persistent Vomiting", "gastrointestinal", 3, "Repeated vomiting over several hours", "Gastroenteritis, Malaria, Intestinal obstruction, Pregnancy", "throwing up, vomit, emesis, being sick", "How many times today? Any blood or bile? Can the patient keep fluids down?"),
        new("Profuse Diarrhea", "gastrointestinal", 3, "Three or more loose or watery stools in 24 hours", "Gastroenteritis, Cholera, Typhoid, Dysentery", "loose stools, watery stool, running stomach, purging", "How many stools today? Any blood or mucus? Is the patient passing urine normally? Rice-water appearance?"),
        new("Blood in Stool", "gastrointestinal", 4, "Visible fresh or dark blood in faeces", "Dysentery, Peptic ulcer, Haemorrhoids, Typhoid", "bloody stool, melaena, melena, black stool", "Bright red or black and tarry? Any abdominal pain? Any NSAID use?"),
        new("Yellow Eyes / Skin (Jaundice)", "gastrointestinal", 3, "Yellow discolouration of sclera or skin", "Hepatitis, Severe malaria, Sickle cell crisis, Biliary obstruction", "jaundice, yellow eyes, yellow skin", "Dark urine or pale stools? Any itching? Any alcohol or herbal medicine use?"),
        new("Signs of Dehydration", "gastrointestinal", 4, "Sunken eyes, dry mouth, reduced skin turgor or reduced urine output", "Gastroenteritis, Cholera, Diabetic ketoacidosis", "dehydrated, sunken eyes, dry mouth, not passing urine", "When did the patient last pass urine? Is the patient drinking? Is the child lethargic?"),
        // Musculoskeletal
        new("Joint Pain / Swelling", "musculoskeletal", 2, "Pain, warmth or swelling in one or more joints", "Sickle cell crisis, Septic arthritis, Rheumatoid arthritis, Gout", "arthralgia, painful joints, swollen knee", "One joint or many? Any fever? Known sickle cell disease?"),
        new("Bone Pain (Sickle Cell Crisis)", "musculoskeletal", 4, "Severe deep bone pain in a known sickle cell patient", "Vaso-occlusive crisis, Osteomyelitis", "crisis, bone pain, sickle cell pain", "Where is the pain? Any chest pain or breathlessness (acute chest syndrome)? Fluid intake today?"),
        new("Injury / Trauma", "musculoskeletal", 3, "Recent physical injury, fall, road traffic accident or assault", "Fracture, Head injury, Internal bleeding", "accident, fall, wound, fracture, RTA", "How did it happen? Any loss of consciousness? Any bleeding that will not stop? Can the patient bear weight?"),
        // Dermatological
        new("Skin Rash", "dermatological", 2, "New rash anywhere on the body", "Measles, Chickenpox, Drug reaction, Meningococcal sepsis", "spots, skin eruption, hives, itchy skin", "Does the rash fade when pressed with a glass? Any fever? Any new medicines? Any contact with measles?"),
        new("Wound / Abscess", "dermatological", 2, "Open wound, boil or collection of pus", "Cellulitis, Abscess, Tetanus risk", "boil, pus, sore, ulcer, cut", "How old is the wound? Any spreading redness? Tetanus vaccination up to date?"),
        // Genitourinary / obstetric
        new("Painful Urination", "genitourinary", 2, "Burning or pain when passing urine", "Urinary tract infection, STI, Schistosomiasis", "dysuria, burning urine, frequent urination", "Any blood in the urine? Any flank pain or fever? Any discharge?"),
        new("Vaginal Bleeding in Pregnancy", "obstetric", 5, "Any bleeding per vaginam in a pregnant woman", "Miscarriage, Ectopic pregnancy, Placenta praevia, Abruption", "bleeding pregnant, spotting, antepartum haemorrhage", "How many weeks pregnant? How heavy is the bleeding? Any abdominal pain? Any dizziness?"),
        new("Labour Pains / Contractions", "obstetric", 4, "Regular painful uterine contractions", "Labour, Preterm labour, Placental abruption", "contractions, in labour, waters broken", "How many weeks pregnant? How far apart are the contractions? Have the waters broken? Is the baby moving?"),
        // ENT
        new("Ear Pain / Discharge", "ent", 1, "Pain in the ear or fluid draining from the ear canal", "Otitis media, Otitis externa", "earache, ear discharge, pus from ear", "One ear or both? Any fever? Any hearing loss?"),
    ];

    private record DemoPatient(string First, string? Middle, string Last, string Dob, string Gender, string BloodType, string? Email, string? Allergies, string? Chronic);

    private static readonly DemoPatient[] Patients =
    [
        new("Musa", "Aliyu", "Garba", "1994-05-12", "Male", "O+", "musa.garba@example.com", "Penicillin", "Hypertension"),
        new("Blessing", "Ngozi", "Eze", "2001-11-23", "Female", "B+", "blessing.eze@example.com", null, "Asthma"),
        new("Emeka", "Chukwudi", "Nwosu", "2018-03-08", "Male", "A+", null, "Sulfa drugs", "Sickle Cell Disease (HbSS)"),
        new("Aisha", "Mohammed", "Yusuf", "1987-09-02", "Female", "O-", "aisha.yusuf@example.com", null, "Type 2 Diabetes"),
        new("Chinedu", null, "Okonkwo", "1959-01-17", "Male", "AB+", null, "NSAIDs (Ibuprofen)", "Hypertension, Chronic kidney disease stage 2"),
        new("Fatima", "Hauwa", "Abdullahi", "1998-07-30", "Female", "A-", "fatima.abdullahi@example.com", null, null),
        new("Oluwaseun", "Adebayo", "Adeyinka", "1976-12-05", "Male", "B-", null, null, "Peptic ulcer disease"),
        new("Ngozi", "Adaeze", "Okoro", "2023-06-14", "Female", "O+", null, null, null),
        new("Ibrahim", null, "Suleiman", "1948-04-21", "Male", "O+", null, "Aspirin", "Hypertension, Benign prostatic hyperplasia"),
        new("Chiamaka", "Precious", "Uche", "2010-10-09", "Female", "A+", "chiamaka.uche@example.com", "Peanuts", "Asthma"),
        new("Yakubu", "Danjuma", "Bala", "1982-02-28", "Male", "B+", null, null, null),
        new("Halimat", "Sadia", "Lawal", "1996-08-19", "Female", "O+", "halimat.lawal@example.com", null, "Pregnant — 28 weeks (G2P1)"),
        new("Tochukwu", null, "Anyanwu", "2016-05-03", "Male", "AB-", null, null, "Sickle Cell Disease (HbSS)"),
        new("Rukayat", "Omolara", "Balogun", "1969-11-11", "Female", "A+", null, "Latex", "Type 2 Diabetes, Hypertension"),
        new("Samuel", "Ikechukwu", "Nnamdi", "2004-01-25", "Male", "O+", "samuel.nnamdi@example.com", null, null),
        new("Maryam", null, "Idris", "1991-03-15", "Female", "B+", null, "Chloroquine", null),
        new("Abubakar", "Sani", "Tanko", "2021-09-27", "Male", "A+", null, null, null),
        new("Ifeoma", "Grace", "Chukwu", "1953-07-07", "Female", "O-", null, null, "Congestive heart failure, Hypertension"),
        new("Danladi", null, "Audu", "1985-06-18", "Male", "B+", "danladi.audu@example.com", null, "HIV (on ART)"),
        new("Zainab", "Aliyu", "Shehu", "2013-12-02", "Female", "O+", null, "Penicillin", null),
    ];

    private record VitalRanges(double[]? Temp = null, string[]? Bp = null, int[]? Hr = null, int[]? Spo2 = null, int[]? Rr = null);

    private record ScenarioSymptom(string Name, string Severity, string Duration, string? Notes = null);

    private record Scenario(
        string Complaint,
        string VisitType,
        ScenarioSymptom[] Symptoms,
        VitalRanges Vitals,
        string Diagnosis,
        string Outcome,
        (string Level, string Reason)? Override = null,
        Func<DemoPatient, bool>? Fits = null);

    private static bool IsChild(DemoPatient p) => DateOnly.Parse(p.Dob) > DateOnly.FromDateTime(DateTime.Today.AddYears(-16));
    private static bool IsAdult(DemoPatient p) => !IsChild(p);
    private static bool IsElderly(DemoPatient p) => DateOnly.Parse(p.Dob) < DateOnly.FromDateTime(DateTime.Today.AddYears(-60));
    private static bool Has(DemoPatient p, string condition) => p.Chronic?.Contains(condition, StringComparison.OrdinalIgnoreCase) == true;

    private static readonly Scenario[] Scenarios =
    [
        new("High fever and headache for 3 days, shivering at night", "walk_in",
            [new("High Fever", "moderate", "3–7 days", "Intermittent, worse in the evenings"), new("Severe Headache", "moderate", "3–7 days"), new("Generalised Weakness / Fatigue", "mild", "3–7 days")],
            new(Temp: [38.4, 39.3], Bp: ["118/76", "122/80", "110/72"], Hr: [92, 108], Spo2: [96, 99], Rr: [16, 20]),
            "Uncomplicated Plasmodium falciparum malaria", "treated"),
        new("Fever, stiff neck and vomiting since this morning", "emergency",
            [new("High Fever", "severe", "Less than 24 hours"), new("Neck Stiffness (Nuchal Rigidity)", "severe", "Less than 24 hours", "Cannot touch chin to chest"), new("Persistent Vomiting", "moderate", "Less than 24 hours"), new("Severe Headache", "severe", "Less than 24 hours", "Photophobia present")],
            new(Temp: [39.4, 40.1], Bp: ["104/66", "110/70"], Hr: [112, 128], Spo2: [94, 97], Rr: [22, 26]),
            "Acute bacterial meningitis — started ceftriaxone", "referred"),
        new("Child has been vomiting and purging since yesterday, very weak", "walk_in",
            [new("Profuse Diarrhea", "severe", "1–2 days", "8 watery stools today, no blood"), new("Persistent Vomiting", "moderate", "1–2 days"), new("Signs of Dehydration", "moderate", "Less than 24 hours", "Sunken eyes, drinks eagerly")],
            new(Temp: [37.6, 38.3], Hr: [120, 150], Spo2: [96, 99], Rr: [24, 32]),
            "Acute gastroenteritis with some dehydration — ORS Plan B", "treated", Fits: IsChild),
        new("Crushing chest pain spreading to left arm, sweating", "emergency",
            [new("Chest Pain", "severe", "Less than 24 hours", "Started 40 min ago while walking"), new("Shortness of Breath (Dyspnea)", "moderate", "Less than 24 hours"), new("Excessive Sweating / Night Sweats", "moderate", "Less than 24 hours")],
            new(Temp: [36.6, 37.2], Bp: ["150/95", "162/100", "138/88"], Hr: [98, 118], Spo2: [93, 96], Rr: [20, 24]),
            "Suspected acute coronary syndrome — aspirin given, referred for ECG/troponin", "referred",
            Fits: p => IsAdult(p) && !Has(p, "pregnant")),
        new("Cough for two weeks, now coughing up blood and losing weight", "walk_in",
            [new("Persistent Cough", "moderate", "More than 2 weeks", "Productive, worse at night"), new("Coughing up Blood", "mild", "3–7 days", "Streaks in sputum"), new("Excessive Sweating / Night Sweats", "moderate", "1–2 weeks"), new("Loss of Appetite", "mild", "1–2 weeks")],
            new(Temp: [37.4, 38.2], Bp: ["112/70", "118/74"], Hr: [84, 100], Spo2: [94, 97], Rr: [18, 22]),
            "Presumptive pulmonary TB — sputum GeneXpert requested", "in_progress",
            ("urgent", "Haemoptysis with constitutional symptoms; needs same-day sputum and isolation, not routine."), IsAdult),
        new("Difficulty breathing and wheezing, inhaler not helping", "emergency",
            [new("Shortness of Breath (Dyspnea)", "severe", "Less than 24 hours", "Cannot complete sentences"), new("Wheezing", "severe", "Less than 24 hours"), new("Persistent Cough", "mild", "1–2 days")],
            new(Temp: [36.8, 37.4], Bp: ["124/80", "130/84"], Hr: [110, 126], Spo2: [88, 92], Rr: [28, 34]),
            "Acute severe asthma exacerbation — nebulised salbutamol, steroids", "in_progress", Fits: p => Has(p, "asthma")),
        new("Severe pain in both legs and back, known sickle cell", "walk_in",
            [new("Bone Pain (Sickle Cell Crisis)", "severe", "1–2 days", "Pain score 9/10, not relieved by paracetamol"), new("Generalised Weakness / Fatigue", "moderate", "1–2 days"), new("Yellow Eyes / Skin (Jaundice)", "mild", "3–7 days")],
            new(Temp: [37.2, 38.1], Bp: ["108/68", "114/72"], Hr: [100, 118], Spo2: [93, 97], Rr: [20, 24]),
            "Vaso-occlusive sickle cell crisis — IV fluids and analgesia", "in_progress",
            ("emergent", "Known HbSS with severe pain and borderline SpO2 — must rule out acute chest syndrome quickly."), p => Has(p, "sickle")),
        new("Fever for a week, stomach pain, not eating, now has diarrhoea", "walk_in",
            [new("High Fever", "moderate", "1–2 weeks", "Step-ladder pattern"), new("Severe Abdominal Pain", "moderate", "3–7 days", "Diffuse, tender lower abdomen"), new("Loss of Appetite", "moderate", "1–2 weeks"), new("Profuse Diarrhea", "mild", "1–2 days")],
            new(Temp: [38.6, 39.4], Bp: ["104/66", "110/70"], Hr: [76, 96], Spo2: [96, 99], Rr: [16, 20]),
            "Typhoid fever — Widal reactive, started ciprofloxacin", "treated", Fits: IsAdult),
        new("Bleeding since last night, 28 weeks pregnant", "emergency",
            [new("Vaginal Bleeding in Pregnancy", "moderate", "Less than 24 hours", "Soaked two pads overnight"), new("Dizziness / Fainting", "mild", "Less than 24 hours"), new("Severe Abdominal Pain", "mild", "Less than 24 hours", "Intermittent tightening")],
            new(Temp: [36.7, 37.1], Bp: ["96/60", "100/64"], Hr: [102, 116], Spo2: [97, 99], Rr: [18, 22]),
            "Antepartum haemorrhage — ?placenta praevia, referred to obstetric unit", "referred",
            ("immediate", "APH at 28 weeks with tachycardia and borderline BP — immediate obstetric referral, not urgent."), p => Has(p, "pregnant")),
        new("Sore throat and mild fever for two days", "walk_in",
            [new("Sore Throat", "moderate", "1–2 days", "Painful swallowing, no white patches"), new("High Fever", "mild", "1–2 days")],
            new(Temp: [37.6, 38.3], Bp: ["116/74", "120/78"], Hr: [72, 88], Spo2: [97, 99], Rr: [14, 18]),
            "Viral pharyngitis — symptomatic treatment", "discharged"),
        new("Burning when passing urine, going frequently", "walk_in",
            [new("Painful Urination", "moderate", "3–7 days"), new("High Fever", "mild", "1–2 days")],
            new(Temp: [37.3, 38.0], Bp: ["118/76", "124/80"], Hr: [70, 86], Spo2: [97, 99], Rr: [14, 18]),
            "Uncomplicated urinary tract infection — nitrofurantoin", "discharged", Fits: IsAdult),
        new("Fell from motorcycle, pain in right leg, small cut on forehead", "emergency",
            [new("Injury / Trauma", "moderate", "Less than 24 hours", "RTA 1 hour ago, no loss of consciousness"), new("Wound / Abscess", "mild", "Less than 24 hours", "3 cm laceration, bleeding controlled")],
            new(Temp: [36.5, 37.0], Bp: ["126/82", "134/86"], Hr: [88, 104], Spo2: [97, 99], Rr: [16, 20]),
            "Closed fracture right tibia (X-ray) + scalp laceration — sutured, tetanus toxoid given", "referred",
            ("urgent", "Suspected long-bone fracture; needs analgesia, X-ray and splinting within 30 minutes."), IsAdult),
        new("Child with fever and body rash for 3 days, red eyes", "walk_in",
            [new("High Fever", "moderate", "3–7 days"), new("Skin Rash", "moderate", "1–2 days", "Started behind ears, spreading down; blanches on pressure"), new("Persistent Cough", "mild", "3–7 days")],
            new(Temp: [38.5, 39.5], Hr: [110, 138], Spo2: [95, 98], Rr: [24, 30]),
            "Measles — vitamin A given, isolated, notified", "treated", Fits: IsChild),
        new("Swollen legs and breathless when lying down", "follow_up",
            [new("Swollen Legs / Ankles", "moderate", "1–2 weeks", "Pitting to mid-shin, both legs"), new("Shortness of Breath (Dyspnea)", "moderate", "1–2 weeks", "Needs 3 pillows to sleep"), new("Generalised Weakness / Fatigue", "moderate", "1–2 weeks")],
            new(Temp: [36.5, 37.1], Bp: ["146/92", "152/96"], Hr: [88, 104], Spo2: [92, 95], Rr: [20, 24]),
            "Decompensated heart failure — furosemide adjusted", "in_progress", Fits: IsElderly),
        new("Sudden weakness of the left arm and face, slurred speech", "emergency",
            [new("Weakness on One Side of Body", "severe", "Less than 24 hours", "Onset 2 hours ago, left arm and face"), new("Severe Headache", "mild", "Less than 24 hours"), new("Dizziness / Fainting", "mild", "Less than 24 hours")],
            new(Temp: [36.6, 37.2], Bp: ["178/104", "186/108"], Hr: [80, 96], Spo2: [95, 98], Rr: [16, 20]),
            "Acute stroke (likely ischaemic) — referred for CT within window", "referred",
            ("immediate", "FAST-positive stroke within the thrombolysis window; hemiparesis was not weighted by the model."), p => IsAdult(p) && Has(p, "hypertension")),
        new("Convulsed twice at home this morning with high fever", "emergency",
            [new("Seizures / Convulsions", "severe", "Less than 24 hours", "Two generalised fits, each ~2 min"), new("High Fever", "severe", "1–2 days"), new("Altered Consciousness / Confusion", "moderate", "Less than 24 hours", "Drowsy but responds to voice")],
            new(Temp: [39.6, 40.3], Hr: [130, 160], Spo2: [93, 97], Rr: [28, 36]),
            "Cerebral malaria — IV artesunate started", "in_progress", Fits: IsChild),
        new("Routine follow-up for blood pressure, feeling fine", "follow_up",
            [],
            new(Temp: [36.4, 36.9], Bp: ["128/82", "134/86", "122/78"], Hr: [66, 80], Spo2: [97, 99], Rr: [12, 16]),
            "Hypertension — controlled, continue amlodipine", "discharged", Fits: p => Has(p, "hypertension")),
        new("Ear pain and discharge for 4 days", "walk_in",
            [new("Ear Pain / Discharge", "moderate", "3–7 days", "Right ear, yellow discharge"), new("High Fever", "mild", "1–2 days")],
            new(Temp: [37.4, 38.1], Hr: [80, 110], Spo2: [97, 99], Rr: [16, 24]),
            "Acute suppurative otitis media — amoxicillin", "discharged"),
        new("Palpitations and dizziness on and off for a week", "walk_in",
            [new("Palpitations", "moderate", "1–2 weeks", "Irregular, lasts minutes"), new("Dizziness / Fainting", "mild", "1–2 weeks"), new("Generalised Weakness / Fatigue", "mild", "1–2 weeks")],
            new(Temp: [36.5, 37.0], Bp: ["112/70", "118/76"], Hr: [104, 124], Spo2: [96, 99], Rr: [16, 20]),
            "Palpitations ?arrhythmia vs anaemia — ECG and FBC requested", "in_progress", Fits: IsAdult),
        new("Black stools and stomach pain, has ulcer", "walk_in",
            [new("Blood in Stool", "moderate", "1–2 days", "Black, tarry stools x3"), new("Severe Abdominal Pain", "moderate", "3–7 days", "Epigastric, worse when hungry"), new("Dizziness / Fainting", "mild", "Less than 24 hours")],
            new(Temp: [36.6, 37.1], Bp: ["100/64", "106/68"], Hr: [96, 112], Spo2: [96, 99], Rr: [16, 20]),
            "Upper GI bleed from peptic ulcer — IV PPI, referred for endoscopy", "referred",
            ("emergent", "Melaena with tachycardia and soft BP suggests significant bleed."), p => Has(p, "ulcer")),
        new("Boil on the thigh getting bigger and painful", "walk_in",
            [new("Wound / Abscess", "moderate", "3–7 days", "4 cm fluctuant swelling, left thigh")],
            new(Temp: [37.0, 37.8], Bp: ["118/76", "124/80"], Hr: [72, 90], Spo2: [97, 99], Rr: [14, 18]),
            "Thigh abscess — incised and drained", "treated"),
    ];
}
