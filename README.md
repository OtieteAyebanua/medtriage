# MedTriage AI

Offline, LAN-hosted clinical decision support for primary healthcare facilities: nurses record a structured triage assessment, an inference engine suggests an urgency level (1–5) with reasoning and differential diagnoses, and a doctor confirms or overrides it from a review queue.

Stack: Next.js 15 (App Router) · React 19 · Prisma 6 · SQLite (PostgreSQL-ready) · TypeScript.

## Quick start (demo)

```bash
npm install
cp .env.example .env          # defaults are fine for a demo
npm run db:setup              # creates the SQLite DB and loads the full demo dataset
npm run dev                   # http://localhost:3000
```

### Demo logins (password for all: `password123`)

| Employee ID | Name | Role |
|---|---|---|
| `HW-DOC-001` | Dr. Amina Bello | Doctor — sees the Review queue |
| `HW-DOC-006` | Dr. Chukwuemeka Obi | Doctor |
| `HW-NUR-002` | Grace Okafor | Nurse |
| `HW-NUR-003` | Ibrahim Danladi | Nurse |
| `HW-NUR-007` | Halima Sadiq | Nurse |
| `HW-LAB-004` | Samuel Adeyemi | Lab technician |
| `HW-PHA-008` | Tunde Bakare | Pharmacist |
| `HW-ADM-005` | Khadija Umar | Administrator |

You can sign in with the employee ID or the email (`amina.bello@hospital.lan`). Change the shared password with `SEED_PASSWORD` in `.env` before seeding.

The demo dataset contains 20 patients (14 with placeholder photos), a 33-symptom catalogue, and ~47 visits over the last 30 days including doctor reviews, overrides and a live review queue. `npm run seed:demo` wipes patients/visits/photos and rebuilds it; `npm run prisma:seed` only refreshes staff and symptoms and leaves existing clinical data alone.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run db:setup` | `prisma db push` + full demo seed |
| `npm run seed:demo` | Reset clinical data and rebuild the demo dataset |
| `npm run prisma:seed` | Upsert staff + symptom catalogue only |
| `npm run lint` | oxlint |

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma datasource (SQLite; switch the provider in `prisma/schema.prisma` for PostgreSQL) |
| `SEED_PASSWORD` | `password123` | Password given to seeded staff |
| `UPLOAD_DIR` | `./uploads` | Where patient photos are stored on the server |
| `INFERENCE_URL` | *(unset)* | External AI model endpoint. Unset → built-in rule engine |
| `INFERENCE_TIMEOUT_MS` | `5000` | Timeout before falling back to the rule engine |
| `INFERENCE_API_KEY` | *(unset)* | Sent as `Authorization: Bearer …` if set |

## Plugging in the AI model

`/api/triage` calls `runInference()` in [`src/lib/inference.ts`](src/lib/inference.ts). When `INFERENCE_URL` is set it POSTs this JSON and expects the response below; otherwise (or if the service fails) it uses the rule engine in `src/lib/triage-engine.ts`, so the facility keeps working.

```jsonc
// POST {INFERENCE_URL}
{
  "patient": { "age": 34, "sex": "Female", "blood_type": "O+", "chronic_conditions": "Asthma", "allergies": null },
  "visit_type": "walk_in",
  "chief_complaint": "High fever and headache for 3 days",
  "symptoms": [{ "symptom_id": 1, "name": "High Fever", "category": "systemic", "severity": "moderate", "duration": "3–7 days", "notes": null }],
  "vitals": { "temperature": 38.9, "blood_pressure": "118/76", "heart_rate": 98, "oxygen_level": 97, "respiratory_rate": 18 }
}

// 200 response
{
  "urgency_score": 3,                       // 1 (immediate) … 5 (non-urgent) — required
  "triage_level": "urgent",                 // optional; derived from the score if absent
  "confidence": 0.87,                       // optional, 0–1
  "reasoning": "…",                         // required
  "suggested_tests": ["Malaria RDT"],
  "differential_diagnosis": [{ "condition": "Malaria", "probability": 0.72, "rationale": "…" }]
}
```

## API overview

All routes except `/api/auth/login` require the session cookie (1-day expiry). Doctor-only routes return 403 for other roles.

| Route | Purpose |
|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/session` | Authentication |
| `GET/POST /api/patients` | Registry (with last 3 visits) · register |
| `GET /api/patients/:id` | Full visit history |
| `GET/POST/DELETE /api/patients/:id/photo` | Patient photo (JPEG/PNG/WebP ≤ 5 MB) |
| `GET /api/symptoms` | Symptom catalogue |
| `POST /api/triage` | Run inference and save the assessment |
| `GET /api/records/queue` | Assessments awaiting doctor review |
| `PUT /api/records/:id/review` | Doctor sign-off (accept/override, diagnosis, disposition) — doctors only |
| `GET /api/reports/ward?days=` | Acuity distribution, review/override statistics, recent activity |

## Project layout

```
prisma/            schema, demo seed (seed.ts), placeholder photo generator
src/app/api/       route handlers
src/lib/           auth, inference seam, validation, uploads, rule engine, session
src/auth/          login screen
src/Homescreen/    the app: triage wizard, patients, history, review queue, ward overview
uploads/           patient photos (git-ignored)
```
