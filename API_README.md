# MedTriage AI: Backend API

The frontend (Vite + React) currently runs entirely on mock data: [`src/Homescreen/mockData.ts`](src/Homescreen/mockData.ts), a hard-coded staff list in [`src/auth/authService.ts`](src/auth/authService.ts), and `localStorage`. This document lists every endpoint the frontend needs, the exact request and response shapes it expects, and where in the frontend each one gets wired in.

The response shapes match [`src/Homescreen/types.ts`](src/Homescreen/types.ts). If you change a shape here, change that file too.

The original Next.js implementation of all these routes is still in git history (see [Reference](#reference-the-original-implementation)).

---

## Progress

### Backend

- [x] 1. `POST /api/auth/login`
- [x] 2. `GET /api/auth/session`
- [x] 3. `POST /api/auth/logout`
- [x] 4. `GET /api/patients`
- [x] 5. `POST /api/patients`
- [x] 6. `GET /api/patients/:id`
- [x] 7. `POST /api/patients/:id/photo`
- [x] 8. `GET /api/patients/:id/photo`
- [x] 9. `DELETE /api/patients/:id/photo`
- [x] 10. `GET /api/symptoms`
- [x] 11. `POST /api/triage`
- [x] 12. `GET /api/records/queue`
- [x] 13. `PUT /api/records/:id/review`
- [x] 14. `GET /api/reports/ward`
- [x] 15. `POST /api/admin/auth/login`
- [x] 16. `GET /api/admin/auth/session`
- [x] 17. `POST /api/admin/auth/logout`
- [x] 18. `GET /api/admin/practitioners`
- [x] 19. `POST /api/admin/practitioners`
- [x] 20. `PUT /api/admin/practitioners/:id`
- [x] 21. `PUT /api/admin/practitioners/:id/status`

### Frontend wiring

See [Frontend wiring](#frontend-wiring) for details on each step.

- [x] Add the `/api` proxy to `vite.config.ts`
- [x] Add the `apiFetch` helper and handle 401s
- [x] Login, session restore and logout (#1–3)
- [x] Load patients, symptoms, queue and ward report from the API (#4, #10, #12, #14)
- [x] Register patient, including the photo (#5, #7)
- [x] Photo upload from the Patients tab (#7)
- [x] Patient history modal (#6)
- [x] Run triage (#11)
- [x] Doctor review (#13)
- [x] Delete `mockData.ts`, the `localStorage` data caches and the fake login fallback
- [x] Admin console at `/admin` (#15–21). In development the admin password is `admin123` (`server/appsettings.Development.json`)

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

---

## Data model

These are the tables from the original Prisma schema. Any database works; the response shapes are what matter.

| Table | Key columns |
|---|---|
| `healthcare_workers` | `user_id`, `first_name`, `middle_name?`, `last_name`, `employee_id` (unique), `email` (unique), `gender`, `password_hash`, `position`, `created_at` |
| `sessions` | `id`, `token` (unique), `user_id` → worker, `expires_at`, `created_at` |
| `patients` | `patient_id`, `first_name`, `middle_name?`, `last_name`, `date_of_birth`, `gender`, `email?`, `blood_type`, `allergies?`, `chronic_conditions?`, `photo_path?`, `created_at` |
| `patient_records` (one per visit) | `record_id`, `patient_id`, `recorded_by` → worker, `visit_type`, `chief_complaint`, `vitals_temperature?`, `vitals_blood_pressure?`, `vitals_heart_rate?`, `vitals_oxygen_level?`, `vitals_respiratory_rate?`, `ai_urgency_score` (1–5), `ai_triage_level`, `ai_confidence?`, `ai_reasoning`, `ai_suggested_tests?` (JSON array), `ai_differential_diagnosis?` (JSON array), `assigned_to?` → worker, `override_status`, `override_reason?`, `final_triage_level?`, `diagnosis?`, `treated_by?` → worker, `status`, `is_current`, `visit_date` |
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
  ]
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

All vitals are optional. Treat a blank value or `null` as "not measured". Accept numbers or numeric strings.

Processing:
1. Validate the input, load the patient, and check the symptom IDs.
2. Call the inference service (see [Inference service](#inference-service)). If it fails or isn't configured, fall back to the rule engine.
3. In **one transaction**: set `is_current = false` on the patient's previous current record, create the new record (`recorded_by` = session user, `override_status: "pending"`, `status: "triaged"`, `final_triage_level` = AI level, `is_current: true`), and insert the `record_symptoms` rows.

Response `200`:

```json
{
  "success": true,
  "record_id": 48,
  "engine": "random_forest",
  "model": "MedTriage Random Forest",
  "safety_raised_from": null,
  "triage": {
    "urgency_level": 3,
    "urgency_category": "URGENT",
    "triage_level": "urgent",
    "confidence": 0.81,
    "reasoning": "Febrile patient with prominent systemic symptoms; stable vitals but high pyrexia warrants prompt diagnostic workup.",
    "recommended_tests": ["Malaria Rapid Diagnostic Test (mRDT)", "Full Blood Count (FBC)"],
    "differential_diagnoses": [
      { "condition": "Acute Uncomplicated Malaria", "probability": 0.72, "rationale": "Classic triad of fever, rigors and headache." },
      { "condition": "Typhoid Fever", "probability": 0.2, "rationale": "Consider if fever persists." }
    ]
  }
}
```

- `urgency_level` is 1–5. The UI's result screen is driven by this number.
- `probability` is 0–1, sorted from highest to lowest.
- `engine` is `"random_forest"` (the configured HTTP model service) or `"rules"` (built-in rule engine). `model` is the configured model name, or `null` for the rules. The result screen shows both. Neither is stored.
- `safety_raised_from` is the AI model's own level when the rule engine found warning signs and raised it to a more urgent one (see [Inference service](#inference-service)); otherwise `null`.
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

`POST /api/triage` calls the Random Forest sidecar at `http://127.0.0.1:8001/triage`. The endpoint is restricted to loopback addresses; the app has no remote inference provider or API key configuration. The built-in rule engine also runs on each assessment as a safety floor and fallback.

If the local model service is unavailable, too slow, or returns an invalid response, the rule engine supplies the result. If it detects greater urgency than the model, the rule result wins and `safety_raised_from` records the model's original level.

Start the whole local stack with `npm run program`, or start the sidecar from `server/` with `.venv/bin/python model_service.py`. The sidecar loads `artifacts/triage_random_forest.joblib` and listens only on `127.0.0.1:8001`.

### Local model request and response

The .NET API sends this snake_case JSON to the loopback sidecar:

Request body (snake_case):

```json
{
  "patient": { "age": 34, "sex": "Female", "blood_type": "O+", "chronic_conditions": "Asthma", "allergies": null },
  "visit_type": "walk_in",
  "chief_complaint": "High fever and headache for 3 days",
  "symptoms": [
    { "symptom_id": 1, "name": "High Fever", "category": "systemic", "severity": "moderate", "duration": "3–7 days", "notes": null }
  ],
  "vitals": { "temperature": 38.9, "blood_pressure": "118/76", "heart_rate": 98, "oxygen_level": 97, "respiratory_rate": 18 }
}
```

The sidecar returns `200` with:

```json
{
  "urgency_score": 3,
  "triage_level": "urgent",
  "confidence": 0.87,
  "reasoning": "…",
  "suggested_tests": ["Malaria RDT"],
  "differential_diagnosis": [{ "condition": "Malaria", "probability": 0.72, "rationale": "…" }]
}
```

The API validates the response strictly; a bad model reply falls back to the rule engine:
- `urgency_score` (1–5) and a non-empty `reasoning` are required. Otherwise, treat the call as failed and use the rule engine.
- `triage_level` is optional. Derive it from the score if it's missing or invalid.
- `confidence` must be 0–1; otherwise store `null`.
- Normalize `probability` values above 1 (e.g. `72`) to 0–1.

### Configuration

These live in `server/appsettings.json`. Any of them can be overridden with an environment variable using `__` (e.g. `Inference__LocalModelUrl`). The model URL must resolve to a loopback address.

| Setting | Default | Purpose |
|---|---|---|
| `ConnectionStrings:MedTriage` | `Data Source=medtriage.db` | SQLite database file |
| `Uploads:Directory` | `uploads` | Where patient photos are stored |
| `Inference:LocalModelUrl` | `http://127.0.0.1:8001/triage` | Loopback-only Random Forest sidecar endpoint |
| `Inference:ModelName` | `MedTriage Random Forest` | Model name shown in the triage result |
| `Inference:TimeoutMs` | `5000` | Timeout for the local model service |

---

## Frontend wiring

### 1. Proxy `/api` to the backend

[`vite.config.ts`](vite.config.ts) has no proxy, so relative `/api/...` calls and photo URLs fail. Add one, replacing `4000` with your backend's port:

```ts
server: {
  port: 3000,
  proxy: {
    '/api': 'http://localhost:4000',
  },
},
```

Serving the frontend and the API from the same origin also keeps the session cookie working for `<img>` photo requests.

### 2. Add a fetch helper that handles expired sessions

Bring back the original `apiFetch` in [`src/Homescreen/api.ts`](src/Homescreen/api.ts). It fires one event when any request gets a 401:

```ts
export const UNAUTHENTICATED_EVENT = 'medtriage:unauthenticated';
let unauthTimer: ReturnType<typeof setTimeout> | null = null;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && !unauthTimer) {
    unauthTimer = setTimeout(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
      unauthTimer = null;
    }, 50);
  }
  return res;
}
```

In `App.tsx`, listen for `UNAUTHENTICATED_EVENT` and sign the user out.

### 3. Where each mock gets replaced

| File | Change |
|---|---|
| [`src/auth/authService.ts`](src/auth/authService.ts#L68) | Call #1. **Remove the fallback** that signs in any unknown ID as "Clinical Staff" |
| [`src/App.tsx`](src/App.tsx) | Call #2 on mount (show a loading state while it runs). Call #3 in `handleLogout` |
| [`src/Homescreen/index.tsx`](src/Homescreen/index.tsx) | Load patients (#4), symptoms (#10), queue (#12, doctors only) and the ward report (#14). Fill in `loadPatients`, `loadQueue` and `loadWardReport`. Remove the `medtriage_patients` / `medtriage_queue` `localStorage` caches. After a review, reload the queue and report instead of adjusting counts locally |
| [`src/Homescreen/RegisterPatientModal.tsx`](src/Homescreen/RegisterPatientModal.tsx) | Call #5 with **every** field (the mock drops middle name, email, allergies and chronic conditions), then #7 if a photo was picked |
| [`src/api.ts`](src/api.ts) | `uploadPatientPhoto` (#7, shrinks the photo first) and `removePatientPhoto` (#9), used by the patient photo window |
| [`src/Homescreen/PatientHistoryModal.tsx`](src/Homescreen/PatientHistoryModal.tsx) | Call #6 |
| [`src/Homescreen/TriageWizard.tsx`](src/Homescreen/TriageWizard.tsx) | Call #11 and use `data.triage` as the result and `data.record_id` as the record ID |
| [`src/Homescreen/ReviewModal.tsx`](src/Homescreen/ReviewModal.tsx) | Call #13 |
| [`src/Homescreen/mockData.ts`](src/Homescreen/mockData.ts) | Delete it once nothing imports it |

### 4. Mapping the triage wizard state to the request

The wizard's `Vitals` state uses different names and holds strings:

| Wizard state | Request field | Conversion |
|---|---|---|
| `currentPatient.patient_id` | `patientId` | |
| `visitType` | `visitType` | |
| `chiefComplaint` | `chiefComplaint` | trim |
| `vitals.temp` | `vitals.temperature` | `parseFloat`, blank → `null` |
| `vitals.bp` | `vitals.bloodPressure` | blank → `null` |
| `vitals.heartRate` | `vitals.heartRate` | `parseInt`, blank → `null` |
| `vitals.spo2` | `vitals.oxygenLevel` | `parseFloat`, blank → `null` |
| `vitals.respRate` | `vitals.respiratoryRate` | `parseInt`, blank → `null` |
| `selectedSymptoms[]` | `symptoms[]` | `{ symptomId, severity, duration, notes }` |

The review modal maps to #13 like this: `decision` → `overrideAction`, `finalLevelKey` → `finalTriageLevel`, `reason` → `overrideReason`, `diagnosis` → `diagnosis`, `disposition` → `dischargeAction`.

Don't send `workerUserId` from either screen. The backend reads the user from the session.

### 5. Known mismatches to fix while wiring

- **Agreement rate:** the mock report has `agreement_rate: 0.88`, but the Ward overview displays `${agreement_rate}%`. The backend sends `88`.
- **Demo password:** the "Quick Demo Sign-In" buttons on the login screen send the password `demo123`, while the old seed used `password123` (`SEED_PASSWORD`). Seed the demo staff with `demo123`, or change the buttons.
- **Demo staff:** the quick sign-in buttons use `HW-DOC-001` (Dr. Amina Bello) and `HW-NUR-002` (Grace Okafor) from `STAFF_DIRECTORY`. These accounts must exist in the seeded database.
- **Severity casing:** the UI sends `Moderate`; the backend should store `moderate`, as described in [Enums](#enums).

### Not needed

The old backend also had `GET /api/workers` and `POST /api/workers` (list and create staff). No screen uses them, so they're out of scope until there's a staff admin UI.

---

## Reference: the original implementation

Commit `1e8c5f6` deleted the Next.js backend. The last commit that still has it is `bb50fe2`:

```bash
# A route handler, e.g. triage
git show bb50fe2:src/app/api/triage/route.ts

# Other routes: auth/login, auth/logout, auth/session, patients, patients/[id],
# patients/[id]/photo, symptoms, records/queue, records/[id]/review, reports/ward

# Database schema, validation, sessions, inference, rule engine, uploads
git show bb50fe2:prisma/schema.prisma
git show bb50fe2:src/lib/validation.ts
git show bb50fe2:src/lib/session.ts
git show bb50fe2:src/lib/inference.ts
git show bb50fe2:src/lib/triage-engine.ts
git show bb50fe2:src/lib/uploads.ts

# Demo seed data (20 patients, 33 symptoms, ~47 visits)
git show bb50fe2:prisma/seed.ts
git show bb50fe2:data/symptoms.json
```

`package.json` still has the `prisma:*`, `seed:demo` and `db:setup` scripts, but the files they point at (`prisma/schema.prisma`, `prisma/seed.ts`) were deleted. Restore those files or remove the scripts.
