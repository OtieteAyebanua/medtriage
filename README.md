# MedTriage AI

Offline, LAN-hosted clinical decision support for primary healthcare facilities: nurses record a structured triage assessment, an inference engine suggests an urgency level (1–5) with reasoning and differential diagnoses, and a doctor confirms or overrides it from a review queue.

Stack: Vite · React 19 · TypeScript frontend, ASP.NET Core API with SQLite (Entity Framework Core), and a Python diagnosis-model sidecar.

## Quick start

```bash
npm install
npm run program               # Vite frontend, .NET API and diagnosis model together
```

Open http://localhost:3000 (admin console at http://localhost:3000/admin). Press Ctrl+C to stop all three processes.

`npm run program` needs the .NET SDK and the diagnosis model's Python environment; it tells you how to create that environment if it is missing. Data lives in `server/medtriage.db`; see [`server/README.md`](server/README.md) for where it goes on an installed server.

## Scripts

| Script | What it does |
|---|---|
| `npm run program` | Start the full development stack (ports 3000, 4000, 8002) |
| `npm run dev` | Vite dev server only; `/api` is proxied to the .NET API |
| `npm run build` / `preview` | Type-check and build the frontend / serve the build |
| `npm run lint` | oxlint |

## Local model service

The built-in rule engine sets the triage level. Possible conditions come from the diagnosis model, a Python sidecar at `http://127.0.0.1:8002` that loads `server/Models/newmodel.joblib`. It binds to loopback, and the API rejects non-loopback model URLs. There is no remote inference endpoint or API key configuration. If the sidecar is unavailable, the rule engine supplies the possible conditions. See [`server/README.md`](server/README.md) for local setup.

## API overview

All routes except `/api/auth/login` require the session cookie (1-day expiry). Doctor-only routes return 403 for other roles. Full details are in [`API_README.md`](API_README.md).

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
| `POST /api/admin/auth/login` · `logout` · `GET session` | Admin console sign-in (separate session) |
| `GET/POST /api/admin/practitioners` · `PUT :id` · `PUT :id/status` | Manage staff accounts |

## Project layout

```
src/auth/          login screen
src/Homescreen/    the app: triage wizard, patients, history, review queue, ward overview
src/admin/         admin console: practitioner management
src/api.ts         API client
server/            ASP.NET Core API, SQLite database, diagnosis model sidecar
scripts/           development helpers (program.sh)
```
