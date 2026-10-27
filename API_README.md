# MedTriage AI: Backend API

This document describes every endpoint of the MedTriage API: the exact request and response shapes the frontend expects.

The response shapes match [`src/Homescreen/types.ts`](src/Homescreen/types.ts). If you change a shape here, change that file too.

In development the admin console password is `admin123` (`server/appsettings.Development.json`).

---

## Conventions

### Base path and format

- Every route lives under `/api`.
- Requests and responses are JSON unless noted (the photo routes use multipart and raw image bytes).
- Dates are ISO 8601 strings, e.g. `"2026-10-21T09:14:00.000Z"`. `dateOfBirth` is sent as `YYYY-MM-DD`.

### Authentication

- Sessions use an **httpOnly cookie** named `medtriage_session`, valid for 24 hours, with `SameSite=Lax` (and `Secure` in production).
- Every route except `POST /api/auth/login` requires a valid session.
- **Use a cookie, not a bearer token.** Patient photos load through a plain `<img src="/api/patients/:id/photo">`, and an `<img>` can't send an `Authorization` header.
- Always take the acting user (who recorded a triage, who reviewed it) from the session. Never trust a user ID sent by the client.

### Errors

Every error response has this body:

```json
{ "error": "Human-readable message", "field": "optionalFieldName", "code": "OPTIONAL_CODE" }
```

| Status | When | Notes |
|---|---|---|
| 400 | Validation failed | Include `field` so the UI can point at the input |
| 401 | No session, or it expired | `code: "UNAUTHENTICATED"`. Also clear the cookie. The frontend returns to the login screen |
| 403 | Signed in, but the role isn't allowed | `code: "FORBIDDEN"` |
| 404 | Patient, record or photo not found | |
| 413 | Photo larger than 5 MB | |
| 415 | Photo is not JPEG, PNG or WebP | |
| 500 | Anything unexpected | Log the details server-side and return a generic message |

### Field casing

The frontend expects mixed casing. Keep it as described here unless you also update `types.ts`:

- **Request bodies** use camelCase (`firstName`, `chiefComplaint`).
- **Patient, record, symptom and ward-report responses** use snake_case, i.e. the database column names (`patient_id`, `visit_date`).
- **The auth `worker` object and queue items** use camelCase (`userId`, `patientName`).

### Enums

| Name | Values |
|---|---|
| Staff position | `doctor`, `nurse`, `lab_tech`, `pharmacist`, `admin` |
| Visit type | `walk_in`, `emergency`, `referral`, `follow_up` |
| Blood type | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| Symptom severity | `mild`, `moderate`, `severe`. The UI sends `Mild`/`Moderate`/`Severe`, so accept any case and store lowercase |
| Triage level | `1` → `immediate`, `2` → `emergent`, `3` → `urgent`, `4` → `less_urgent`, `5` → `non_urgent` |
| Review (`override_status`) | `pending`, `accepted`, `overridden` |
| Record `status` | `waiting`, `triaged`, `in_progress`, `treated`, `discharged`, `referred` |
| Disposition (set by the review) | `in_progress`, `treated`, `discharged`, `referred` |
| AVPU | `alert`, `voice`, `pain`, `unresponsive` |
| Mobility | `walking`, `with_help`, `immobile` |
| Triage category (SATS) | `red`, `orange`, `yellow`, `green` |

---

## Data model

These are the main SQLite tables (see `server/Data/MedTriageDbContext.cs`). The response shapes are what matter to the frontend.

| Table | Key columns |
|---|---|
| `healthcare_workers` | `user_id`, `first_name`, `middle_name?`, `last_name`, `employee_id` (unique), `email` (unique), `gender`, `password_hash`, `position`, `created_at` |
| `sessions` | `id`, `token` (unique), `user_id` → worker, `expires_at`, `created_at` |
| `patients` | `patient_id`, `first_name`, `middle_name?`, `last_name`, `date_of_birth`, `gender`, `email?`, `blood_type`, `allergies?`, `chronic_conditions?`, `photo_path?`, `created_at` |
| `patient_records` (one per visit) | `record_id`, `patient_id`, `recorded_by` → worker, `visit_type`, `chief_complaint`, `vitals_temperature?`, `vitals_blood_pressure?`, `vitals_heart_rate?`, `vitals_oxygen_level?`, `vitals_respiratory_rate?`, diagnosis-model inputs (`pregnant?`, `rainy_season?`, `days_febrile?`, `avpu?`, `mobility?`, and 33 yes/no symptom flags `chills?` … `dehydration?`, named as in the training CSV), `tews_score?`, `triage_category?`, `ai_urgency_score` (1–5), `ai_triage_level`, `ai_confidence?`, `ai_reasoning`, `ai_suggested_tests?` (JSON array), `ai_differential_diagnosis?` (JSON array), `assigned_to?` → worker, `override_status`, `override_reason?`, `final_triage_level?`, `diagnosis?`, `treated_by?` → worker, `status`, `is_current`, `visit_date` |
| `symptoms` (catalogue) | `symptom_id`, `symptom_name` (unique), `category`, `description`, `severity_scale` (1–5), `related_conditions?`, `synonyms?`, `follow_up_questions?` |
| `record_symptoms` | `record_symptom_id`, `record_id`, `symptom_id`, `severity`, `duration`, `notes?` |

### Record lifecycle

1. **Triage (#11)** creates a record with `status: "triaged"`, `override_status: "pending"`, `final_triage_level` set to the AI level, and `is_current: true`. It also sets `is_current: false` on that patient's previous current record.
2. While `is_current` is true and the record is pending, it appears in the **review queue (#12)**.
3. **Doctor review (#13)** sets `override_status` to `accepted` or `overridden`, sets `status` to the chosen disposition, and records the doctor in `treated_by`. The record then leaves the queue.

---

## Endpoints

### Auth

#### 1. `POST /api/auth/login`

**Auth:** none · **Replaces:** `loginWithCredentials()` in [`src/auth/authService.ts:68`](src/auth/authService.ts#L68)

Request:

```json
{ "employeeId": "HW-DOC-001", "password": "demo123" }
```

`employeeId` may also be the worker's email. Match the email case-insensitively.

Response `200`, which also sets the `medtriage_session` cookie:

```json
{
  "success": true,
  "worker": {
    "userId": 1,
    "employeeId": "HW-DOC-001",
    "firstName": "Amina",
    "middleName": null,
    "lastName": "Bello",
    "email": "amina.bello@hospital.lan",
    "position": "doctor",
    "gender": "Female"
  }
}
```

Errors:
- `400`: `employeeId` or `password` is missing.
- `401`: `{ "error": "Invalid employee ID or password" }`. Use the same message whether the ID or the password was wrong. When the user doesn't exist, still run a hash comparison (against a dummy hash) so the timing doesn't reveal which IDs exist.

Never return `password_hash`.

#### 2. `GET /api/auth/session`

**Auth:** cookie · **Replaces:** the `localStorage`-only check in [`src/App.tsx:15`](src/App.tsx#L15)

The frontend calls this on page load to restore a signed-in user.

- `200`: `{ "authenticated": true, "worker": { …same shape as login… } }`
- `401`: `{ "authenticated": false, "error": "Session expired" }`. Also clear the cookie.

#### 3. `POST /api/auth/logout`

**Auth:** cookie · **Replaces:** `handleLogout` in [`src/App.tsx:34`](src/App.tsx#L34)

Deletes the session row and clears the cookie. Always respond `200 { "success": true }`, even if the session was already gone.

---

### Patients

#### 4. `GET /api/patients?q=`

**Auth:** signed in · **Replaces:** `INITIAL_PATIENTS` / `loadPatients` in [`src/Homescreen/index.tsx:45`](src/Homescreen/index.tsx#L45)

- `q` (optional) matches `first_name` or `last_name` (substring). The UI also filters client-side by ID and blood group, so `q` can wait.
- Order patients by `created_at`, newest first.
- Include each patient's **3 most recent** visits as `records`, newest first. The Patients tab shows "History (3+)" when it gets 3.

Response `200`:

```json
{
  "patients": [
    {
      "patient_id": 1,
      "first_name": "Babatunde",
      "middle_name": "Olusegun",
      "last_name": "Adeleke",
      "date_of_birth": "1984-06-12T00:00:00.000Z",
      "gender": "Male",
      "email": "babatunde.adeleke@example.com",
      "blood_type": "O+",
      "allergies": "Penicillin",
      "chronic_conditions": "Hypertension",
      "photo_path": "patients/1-1760000000000.jpg",
      "created_at": "2026-09-01T08:00:00.000Z",
      "records": [
        {
          "record_id": 101,
          "visit_date": "2026-10-19T10:30:00.000Z",
          "visit_type": "emergency",
          "chief_complaint": "Severe throbbing headache and fever for 3 days",
          "ai_urgency_score": 3,
          "final_triage_level": "urgent",
          "diagnosis": "Acute Uncomplicated Malaria",
          "status": "treated"
        }
      ]
    }
  ]
}
```

#### 5. `POST /api/patients`

**Auth:** signed in · **Replaces:** the mock in [`src/Homescreen/RegisterPatientModal.tsx:48`](src/Homescreen/RegisterPatientModal.tsx#L48)

Request:

```json
{
  "firstName": "Ngozi",
  "middleName": "Chioma",
  "lastName": "Okonjo",
  "dateOfBirth": "1976-08-04",
  "gender": "Female",
  "email": "ngozi.okonjo@example.com",
  "bloodType": "O-",
  "allergies": "Penicillin",
  "chronicConditions": "Type 2 Diabetes"
}
```

| Field | Rule |
|---|---|
| `firstName`, `lastName` | Required, trimmed, max 50 |
| `middleName` | Optional, max 50 |
| `dateOfBirth` | Required, a valid date, not in the future |
| `gender` | Required, max 10 (the UI sends `Female`, `Male` or `Other`) |
| `email` | Optional, max 100, must be a valid address, store lowercase |
| `bloodType` | Required, one of the blood types above |
| `allergies`, `chronicConditions` | Optional. Store an empty string as `null` |

Response `201`: `{ "success": true, "patient": { …patient object as in #4, without records… } }`

If the user picked a photo in the form, the frontend uploads it next with #7, using the new `patient_id`.

#### 6. `GET /api/patients/:id`

**Auth:** signed in · **Replaces:** the mock in [`src/Homescreen/PatientHistoryModal.tsx:34`](src/Homescreen/PatientHistoryModal.tsx#L34)

Returns the patient's profile and **every** visit, newest first. Parse the JSON columns (`ai_suggested_tests`, `ai_differential_diagnosis`) into arrays, falling back to `[]`.

Response `200`:

```json
{
  "patient": {
    "patient_id": 3,
    "first_name": "Fatima",
    "middle_name": "Zahra",
    "last_name": "Garba",
    "date_of_birth": "2001-03-15T00:00:00.000Z",
    "gender": "Female",
    "email": "fatima.garba@example.com",
    "blood_type": "B+",
    "allergies": "Sulphonamides",
    "chronic_conditions": "Asthma",
    "photo_path": null,
    "created_at": "2026-08-12T09:00:00.000Z",
    "age": 25
  },
  "visits": [
    {
      "record_id": 103,
      "visit_date": "2026-10-20T14:05:00.000Z",
      "visit_type": "emergency",
      "chief_complaint": "Sudden shortness of breath and wheezing",
      "status": "treated",
      "is_current": true,
      "vitals": {
        "temperature": 37.1,
        "blood_pressure": "124/82",
        "heart_rate": 112,
        "oxygen_level": 91,
        "respiratory_rate": 28
      },
      "symptoms": [
        { "symptom_id": 3, "name": "Shortness of Breath", "category": "respiratory", "severity": "severe", "duration": "Less than 24 hours", "notes": null }
      ],
      "ai": {
        "urgency_score": 2,
        "triage_level": "emergent",
        "confidence": 0.87,
        "reasoning": "Marked tachycardia, tachypnoea and SpO2 91%…",
        "suggested_tests": ["Peak Expiratory Flow (PEFR)", "Chest X-Ray"],
        "differential_diagnosis": [
          { "condition": "Acute Severe Asthma Exacerbation", "probability": 0.85, "rationale": "History of asthma with hypoxia." }
        ]
      },
      "review": {
        "override_status": "accepted",
        "override_reason": null,
        "final_triage_level": "emergent",
        "diagnosis": "Acute Moderate Asthma Exacerbation"
      },
      "recorded_by": { "user_id": 2, "first_name": "Grace", "last_name": "Okafor", "position": "nurse" },
      "treated_by": { "user_id": 1, "first_name": "Amina", "last_name": "Bello", "position": "doctor" }
    }
  ]
}
```

- `age` is computed from `date_of_birth`.
- The modal shows "Registered …" from `created_at`.
- `recorded_by` and `treated_by` are `null` when not set.

Errors: `400` for a non-numeric ID, `404` when the patient doesn't exist.

#### 7. `POST /api/patients/:id/photo`

**Auth:** signed in · **Called by:** `uploadPatientPhoto()` in [`src/api.ts`](src/api.ts), from the patient photo window (click a patient's avatar on the Patients tab) and after registering a patient

Request: `multipart/form-data` with the file in a field named **`photo`**.

The frontend shrinks every photo before uploading it ([`src/photoResize.ts`](src/photoResize.ts)): longest side at most 640 px, re-saved as JPEG at 85% quality, camera rotation applied, metadata such as GPS location removed. A phone photo arrives at roughly 50–100 KB. The server checks below still apply to anything that doesn't come through the app.

- Accept only JPEG, PNG or WebP, up to 5 MB. **Check the file's magic bytes**, not just its declared MIME type.
- Store the file (e.g. under `UPLOAD_DIR`) and save its relative path in `photo_path`.
- **`photo_path` must change on every upload** (e.g. `patients/12-1760000000000.jpg`). The frontend adds it to the image URL as a cache-buster.
- Delete the previous file after the new one is saved.

Response `200`: `{ "success": true, "patient": { …patient object, including the new photo_path… } }`

Errors: `400` (no `photo` field), `404` (no such patient), `413` (too large), `415` (wrong type).

#### 8. `GET /api/patients/:id/photo`

**Auth:** signed in (via the cookie, because this is loaded by `<img>`) · **Used by:** `photoUrl()` in [`src/Homescreen/clinical.ts:238`](src/Homescreen/clinical.ts#L238), which builds `/api/patients/:id/photo?v=<photo_path>`

Returns the raw image bytes with:
- `Content-Type`: the image's type
- `Cache-Control: private, max-age=31536000, immutable`. This is safe because the URL changes on every upload.

`404` when the patient has no photo or the file is missing. The UI falls back to initials.

#### 9. `DELETE /api/patients/:id/photo`

**Auth:** signed in · **Called by:** `removePatientPhoto()` in [`src/api.ts`](src/api.ts), from **Remove photo** in the patient photo window ([`PatientPhotoModal`](src/Homescreen/PatientPhotoModal.tsx)), after the user confirms.

Sets `photo_path` to `null`, deletes the file, and returns `200 { "success": true, "patient": { … } }`.

---

### Triage

#### 10. `GET /api/symptoms?category=`

**Auth:** signed in · **Replaces:** `INITIAL_SYMPTOMS` in [`src/Homescreen/index.tsx:56`](src/Homescreen/index.tsx#L56)

- `category` (optional) filters by exact category.
- Order by `category` ascending, then `severity_scale` descending, then `symptom_name` ascending.

Response `200`:

```json
{
  "symptoms": [
    {
      "symptom_id": 1,
      "symptom_name": "High Fever",
      "category": "systemic",
      "description": "Elevated core body temperature above 38.5°C",
      "severity_scale": 4,
      "related_conditions": "Malaria, Typhoid Fever, Sepsis, Meningitis",
      "synonyms": "pyrexia, hot body, chills, temperature",
      "follow_up_questions": "Is the fever intermittent or continuous? Any rigors or shivering?"
    }
  ]
}
```

- `synonyms` is a comma-separated string. The symptom search matches against it.
- `follow_up_questions` is one string. The UI splits it on `?` into separate questions, so end each question with `?`.

#### 11. `POST /api/triage`

**Auth:** signed in · **Replaces:** `runTriage` in [`src/Homescreen/TriageWizard.tsx:147`](src/Homescreen/TriageWizard.tsx#L147)

This is the core endpoint. It runs the AI on the assessment, saves the record and puts it in the review queue.

Request:

```json
{
  "patientId": 1,
  "visitType": "walk_in",
  "chiefComplaint": "High fever and headache for 3 days",
  "vitals": {
    "temperature": 39.4,
    "bloodPressure": "138/88",
    "heartRate": 104,
    "oxygenLevel": 97,
    "respiratoryRate": 20
  },
  "symptoms": [
    { "symptomId": 1, "severity": "Moderate", "duration": "3–7 days", "notes": "Worse at night" },
    { "symptomId": 2, "severity": "Severe", "duration": "1–2 days", "notes": "" }
  ],
  "screening": {
    "pregnant": false,
    "rainySeason": true,
    "daysFebrile": 3,
    "avpu": "alert",
    "mobility": "walking",
    "symptomFlags": { "chills": true, "headache": true, "cough": false }
  }
}
```

Validation:

| Field | Rule |
|---|---|
| `patientId` | Required positive integer. `404` if the patient doesn't exist |
| `visitType` | One of the visit types. Defaults to `walk_in` |
| `chiefComplaint` | Required, max 1000 |
| `vitals.temperature` | Optional, 25–45 °C |
| `vitals.bloodPressure` | Optional, format `120/80`, systolic 40–300, diastolic 20–200, diastolic < systolic |
| `vitals.heartRate` | Optional, 20–250 bpm (store as an integer) |
| `vitals.oxygenLevel` | Optional, 50–100 % |
| `vitals.respiratoryRate` | Optional, 4–80 /min (store as an integer) |
| `symptoms[]` | Optional array. `symptomId` must exist in the catalogue (`400 "Unknown symptom IDs: …"`). `severity` must be mild, moderate or severe in any case (default `moderate`). `duration` max 100 (default `"unknown"`). `notes` max 1000 |
| `screening` | Optional; every field may be null (not asked). `daysFebrile` 0–365, `avpu` and `mobility` from the enums, `symptomFlags` keys from the 33 checklist names (`400 "Unknown symptom flags: …"`). Saved on the record and sent to both [models](#local-inference) |

All vitals are optional. Treat a blank value or `null` as "not measured". Accept numbers or numeric strings.

Processing:
1. Validate the input, load the patient, and check the symptom IDs.
2. Send the inputs to the [triage model](#triage-model) and the [diagnosis model](#diagnosis-model). If the triage model is unavailable, answer `503 "The triage model isn't running. Start the model service and try again."` and save nothing.
3. In **one transaction**: set `is_current = false` on the patient's previous current record, create the new record (`recorded_by` = session user, `override_status: "pending"`, `status: "triaged"`, `final_triage_level` = AI level, `is_current: true`), and insert the `record_symptoms` rows.

Response `200`:

```json
{
  "success": true,
  "record_id": 48,
  "model": "random-forest",
  "level_probabilities": { "1": 0.05, "2": 0.19, "3": 0.68, "4": 0.08, "5": 0.01 },
  "triage": {
    "urgency_level": 3,
    "urgency_category": "URGENT",
    "triage_level": "urgent",
    "confidence": 0.68,
    "reasoning": "Triage model: Level 3 Urgent 68%, Level 2 Emergent 19%, Level 4 Less urgent 8%. Findings: temperature 39.2 °C.",
    "differential_diagnoses": [
      { "condition": "Acute Uncomplicated Malaria", "probability": 0.72, "rationale": "Classic triad of fever, rigors and headache." },
      { "condition": "Typhoid Fever", "probability": 0.2, "rationale": "Consider if fever persists." }
    ]
  }
}
```

- `urgency_level` is 1–5. The UI's result screen is driven by this number.
- `probability` is 0–1, sorted from highest to lowest.
- The [triage model](#triage-model) sets the level. `level_probabilities` (keyed `"1"`–`"5"`) holds its probability for each level, and `confidence` is the chosen level's probability.
- `differential_diagnoses` come from the [diagnosis model](#diagnosis-model); the list is empty when it is down or had too few inputs.
- `urgency_category` isn't displayed, but `TriageResult` in `types.ts` requires it.

#### 12. `GET /api/records/queue`

**Auth:** signed in · **Replaces:** `INITIAL_QUEUE` / `loadQueue` in [`src/Homescreen/index.tsx:61`](src/Homescreen/index.tsx#L61)

The UI only shows the queue tab to doctors. You can restrict this endpoint to doctors (403 otherwise); if you do, the frontend must only call it when the user is a doctor.

- Include records where `is_current = true` AND (`status` is `waiting` or `triaged`, OR `override_status` is `pending`).
- Sort by `ai_urgency_score` ascending (most urgent first), then `visit_date` ascending (longest waiting first).

Response `200`:

```json
{
  "queue": [
    {
      "recordId": 201,
      "patientId": 3,
      "patientName": "Fatima Garba",
      "patientPhoto": null,
      "age": 25,
      "gender": "Female",
      "visitType": "emergency",
      "chiefComplaint": "Acute asthmatic attack with severe wheezing",
      "vitals": {
        "temperature": 37.1,
        "bloodPressure": "124/82",
        "heartRate": 112,
        "oxygenLevel": 91,
        "respiratoryRate": 28
      },
      "symptoms": ["Shortness of Breath", "Generalised Weakness / Fatigue"],
      "aiTriage": {
        "score": 2,
        "level": "emergent",
        "reasoning": "Marked tachycardia, tachypnoea and SpO2 91%…",
        "suggestedTests": ["Peak Expiratory Flow (PEFR)", "Chest X-Ray"],
        "differentialDiagnosis": [
          { "condition": "Acute Severe Asthma Exacerbation", "probability": 0.85, "rationale": "…" }
        ]
      },
      "visitDate": "2026-10-21T09:14:00.000Z",
      "status": "triaged",
      "overrideStatus": "pending",
      "recordedBy": "Grace Okafor"
    }
  ]
}
```

- `patientPhoto` is the patient's `photo_path` (or `null`). The UI builds the image URL from it.
- `symptoms` is just the symptom names.
- `recordedBy` is the recorder's display name, prefixed with `Dr. ` when the recorder is a doctor.

#### 13. `PUT /api/records/:id/review`

**Auth:** **doctors only** (403 for other roles) · **Replaces:** `submit` in [`src/Homescreen/ReviewModal.tsx:30`](src/Homescreen/ReviewModal.tsx#L30)

The doctor signs off on an AI triage.

Request:

```json
{
  "overrideAction": "overridden",
  "finalTriageLevel": "immediate",
  "overrideReason": "Silent chest on auscultation — impending respiratory failure",
  "diagnosis": "Acute severe asthma",
  "dischargeAction": "in_progress"
}
```

| Field | Rule |
|---|---|
| `overrideAction` | Required: `accepted` or `overridden` |
| `dischargeAction` | Required: one of the dispositions |
| `diagnosis` | Optional, max 1000 |
| `finalTriageLevel` | Required when overridden. Must be a triage level key and **different** from the AI level |
| `overrideReason` | Required when overridden, max 2000 |

Effects:
- `accepted`: `final_triage_level` = the AI level and `override_reason` = `null`.
- `overridden`: store the doctor's level and reason.
- In both cases: `override_status` = `overrideAction`, `status` = `dischargeAction`, `diagnosis`, `treated_by` = session user, and `assigned_to` = session user if it was empty.

Response `200`: `{ "success": true, "record": { …updated record… } }`

Errors: `400` (validation), `403` (not a doctor), `404` (no such record).

---

### Reports

#### 14. `GET /api/reports/ward?days=`

**Auth:** signed in · **Replaces:** `INITIAL_WARD_REPORT` / `loadWardReport` in [`src/Homescreen/index.tsx:58`](src/Homescreen/index.tsx#L58)

`days` (optional) limits the counts to the last *N* days. Without it, the counts cover all time.

Response `200`:

```json
{
  "window_days": null,
  "total_records": 18,
  "awaiting_review": 2,
  "acuity_distribution": { "1": 1, "2": 4, "3": 8, "4": 4, "5": 1 },
  "final_distribution": { "1": 1, "2": 5, "3": 7, "4": 4, "5": 1 },
  "review_stats": {
    "reviewed": 16,
    "accepted": 14,
    "overridden": 2,
    "pending": 2,
    "agreement_rate": 88
  },
  "status_distribution": { "triaged": 2, "treated": 12, "discharged": 4 },
  "recent_records": [
    {
      "record_id": 201,
      "patient_id": 3,
      "chief_complaint": "Acute asthmatic attack with severe wheezing",
      "ai_urgency_score": 2,
      "ai_triage_level": "emergent",
      "final_triage_level": "emergent",
      "override_status": "pending",
      "status": "triaged",
      "visit_date": "2026-10-21T09:14:00.000Z",
      "patient": { "patient_id": 3, "first_name": "Fatima", "last_name": "Garba" },
      "recorder": { "first_name": "Grace", "last_name": "Okafor", "position": "nurse" }
    }
  ]
}
```

| Field | How to compute it |
|---|---|
| `total_records` | Records in the window |
| `awaiting_review` | Records with `is_current = true` and `override_status = "pending"` |
| `acuity_distribution` | Count per AI level (keys `1`–`5`, include zeros) |
| `final_distribution` | Count per `final_triage_level` (keys `1`–`5`, include zeros) |
| `review_stats.reviewed` | `accepted + overridden` |
| `review_stats.agreement_rate` | `round(accepted / reviewed × 100)` as a **whole-number percent** (e.g. `88`), or `null` when nothing has been reviewed yet |
| `status_distribution` | Count per record `status` |
| `recent_records` | The 10 newest records, with `patient` and `recorder` names |

---

### Admin

The admin console at `/admin` ([`src/admin/`](src/admin/)) is where a facility administrator adds **verified** practitioners: people whose identity and professional licence they have checked. Only accounts created here can sign in to the staff app.

**Admin auth is separate from staff auth.** It uses one facility admin password, `Admin:Password` in the server's appsettings (`admin123` in development; no default in production, where the login answers `503 ADMIN_NOT_CONFIGURED` until one is set), and its own httpOnly cookie, `medtriage_admin` (`SameSite=Strict`), valid for 8 hours. A staff session never grants admin access, and an admin session never grants staff access. `#15` is the only admin route that allows anonymous access. It is rate-limited to 5 attempts per minute per IP address (`429 RATE_LIMITED`).

Admin routes answer `401 { "code": "UNAUTHENTICATED" }` when the admin session is missing or expired; the console then returns to the password screen.

**Practitioner data model.** Add these columns to `healthcare_workers`: `phone?`, `department?`, `license_number?`, `license_expiry?` (date), `is_active` (default `true`), `verified_at?`. Existing rows get `is_active = true`.

**Effect on staff sign-in (#1, #2).** A worker with `is_active = false` can't sign in: answer `401` with the same "Invalid employee ID or password" message. Deactivating an account also deletes its `sessions` rows, so anyone signed in is signed out.

#### 15. `POST /api/admin/auth/login`

**Auth:** none · **Used by:** [`src/admin/AdminLogin.tsx`](src/admin/AdminLogin.tsx)

Request: `{ "password": "…" }`

- `200`: `{ "success": true }`, and sets the `medtriage_admin` cookie.
- `400`: `password` is missing.
- `401`: `{ "error": "Incorrect admin password" }`.

#### 16. `GET /api/admin/auth/session`

- `200`: `{ "authenticated": true }`
- `401`: `{ "authenticated": false, "error": "Session expired" }`. Also clear the cookie.

#### 17. `POST /api/admin/auth/logout`

Deletes the admin session and clears the cookie. Always `200 { "success": true }`.

#### 18. `GET /api/admin/practitioners`

**Auth:** admin · Every worker, newest first, including deactivated ones. camelCase, like the auth `worker` object:

```json
{
  "practitioners": [
    {
      "userId": 9,
      "employeeId": "HW-NUR-009",
      "firstName": "Ngozi",
      "middleName": null,
      "lastName": "Eze",
      "email": "ngozi.eze@hospital.lan",
      "phone": "+234 803 555 0142",
      "gender": "Female",
      "position": "nurse",
      "department": "Emergency",
      "licenseNumber": "NMCN/RN/260981",
      "licenseExpiry": "2028-03-31",
      "active": true,
      "verifiedAt": "2026-10-27T07:32:10.000Z",
      "createdAt": "2026-10-27T07:32:10.000Z"
    }
  ]
}
```

Never return `password_hash`.

#### 19. `POST /api/admin/practitioners`

**Auth:** admin · **Used by:** [`src/admin/PractitionerModal.tsx`](src/admin/PractitionerModal.tsx)

Request:

```json
{
  "employeeId": "HW-NUR-009",
  "firstName": "Ngozi",
  "middleName": "Adaeze",
  "lastName": "Eze",
  "email": "ngozi.eze@hospital.lan",
  "phone": "+234 803 555 0142",
  "gender": "Female",
  "position": "nurse",
  "department": "Emergency",
  "licenseNumber": "NMCN/RN/260981",
  "licenseExpiry": "2028-03-31",
  "password": "temporary-password"
}
```

`middleName`, `phone`, `department` are optional. `licenseNumber` and `licenseExpiry` are required unless `position` is `admin`. The UI only submits once the admin ticks "I have verified this practitioner", so set `verified_at` to now.

Validate (`400` with `field`):
- names, `email` and `employeeId` present; `email` well-formed; `position` and `gender` from the enums.
- `licenseExpiry` is `YYYY-MM-DD` and not in the past.
- `password` is at least 8 characters. Hash it with the same password hasher as the demo accounts.

Store `employeeId` upper-cased and `email` lower-cased. Answer `409` with `field` when `employeeId` or `email` is already used (case-insensitive).

Response `201`: `{ "practitioner": { …same shape as #18… } }`

#### 20. `PUT /api/admin/practitioners/:id`

**Auth:** admin · Same body and validation as #19, except `password` is optional: when present, it resets the password and deletes the worker's existing sessions. Leave `verified_at` unchanged.

Response `200`: `{ "practitioner": { … } }`. `404` if no such worker.

#### 21. `PUT /api/admin/practitioners/:id/status`

**Auth:** admin · Request: `{ "active": false }`

Sets `is_active`. When deactivating, also delete the worker's sessions. Past records keep pointing at the worker.

Response `200`: `{ "practitioner": { … } }`. `404` if no such worker.

---

## Local inference

The triage model below sets the triage level, and the diagnosis model suggests possible conditions. Both run in one local sidecar (`server/diagnosis_service.py`); when it is down, `POST /api/triage` answers `503` and nothing is saved. Model endpoints are restricted to loopback addresses; the app has no remote inference provider or API key configuration.

Start the whole local stack with `npm run program`.

### Triage model

`POST /api/triage` sends the same inputs as the diagnosis model (below) to `http://127.0.0.1:8002/triage`. The sidecar loads `server/Models/triage_model.joblib`, a Random Forest that returns a probability for each level; the most likely level (ties go to the more urgent one) becomes the assessment's level. There is no rule-based override or fallback.

Train or retrain it with `server/train_triage_model.py` (about 10 seconds). There is no real labelled data yet, so it trains on 30,000 synthetic adult patients labelled with the South African Triage Scale: a TEWS score (mobility, respiratory rate, heart rate, systolic BP, temperature, AVPU) plus emergency and very-urgent signs, with SpO2 < 92% very urgent and < 85% emergency. About 8% of labels are moved one level and some inputs are left out, to imitate clinician disagreement and unmeasured vitals. The script prints accuracy, under-triage and a confusion matrix on 6,000 held-out patients. Synthetic data is not clinical evidence; retrain on reviewed visits once there are enough.

Reply:

```json
{ "level": 3, "triage_level": "urgent",
  "probabilities": { "1": 0.05, "2": 0.19, "3": 0.68, "4": 0.08, "5": 0.01 },
  "findings": ["temperature 39.2 °C"], "inputs_used": 45, "inputs_total": 45, "note": null }
```

### Diagnosis model

Alongside triage, `POST /api/triage` sends the diagnosis inputs (the `screening` fields plus age, sex and vitals) to a local sidecar at `http://127.0.0.1:8002/diagnose`. It runs `server/diagnosis_service.py`, which loads `server/Models/newmodel.joblib` in its own Python 3.11+ environment (`server/.venv-diagnosis`, from `requirements-diagnosis.txt`). Loading takes about a minute. If it fails, the assessment is still saved, with no possible conditions.

Its conditions become `differential_diagnoses`; the triage level is unaffected. It returns nothing when fewer than `min_inputs` of its 45 inputs are present.

`server/diagnosis_model.json` holds what the model file does not: the name of each class (0–14) and how `sex`, `avpu` and `mobility` were coded in training. Until a label is filled in, the class shows as "Diagnosis class N (unlabelled)". Set `codes_confirmed` to `true` once the codes are checked against the training data.

Request body (snake_case; `null` = not measured or not asked):

```json
{
  "age_years": 0.25, "sex": "Female", "pregnant": false, "rainy_season": true, "days_febrile": 3,
  "temp_c": 39.2, "heart_rate": 110, "resp_rate": 22, "systolic_bp": 115, "spo2": 97,
  "avpu": "alert", "mobility": "walking",
  "symptom_flags": { "chills": true, "headache": true, "cough": false }
}
```

Response: `{ "diagnoses": [{ "condition": "…", "probability": 0.89, "rationale": "…" }], "inputs_used": 45, "inputs_total": 45 }`

### Configuration

These live in `server/appsettings.json`. Any of them can be overridden with an environment variable using `__` (e.g. `Inference__DiagnosisModelUrl`). The model URL must resolve to a loopback address.

| Setting | Default | Purpose |
|---|---|---|
| `ConnectionStrings:MedTriage` | `Data Source=medtriage.db` | SQLite database file |
| `Uploads:Directory` | `uploads` | Where patient photos are stored |
| `Inference:DiagnosisModelUrl` | `http://127.0.0.1:8002/diagnose` | Loopback-only diagnosis-model sidecar endpoint |
| `Inference:TriageModelUrl` | `http://127.0.0.1:8002/triage` | Loopback-only triage-model sidecar endpoint |
| `Inference:TimeoutMs` | `5000` | Timeout for each model request |
