# MedTriage server

ASP.NET Core (.NET 10) API with a SQLite database. It implements every endpoint in [`../API_README.md`](../API_README.md).

## Run it

```bash
cd server
dotnet run --launch-profile http     # http://localhost:4000
```

## Model service

The triage model (`Models/triage_model.joblib`) and the diagnosis model (`Models/newmodel.joblib`) run in their own Python 3.11+ environment, separate from the .NET API:

```bash
python3.11 -m venv .venv-diagnosis
.venv-diagnosis/bin/pip install -r requirements-diagnosis.txt
.venv-diagnosis/bin/python train_triage_model.py     # builds Models/triage_model.joblib (about 10 s)
.venv-diagnosis/bin/python diagnosis_service.py      # http://127.0.0.1:8002/triage and /diagnose
```

`.venv-diagnosis/` is local and git-ignored. Loading the models takes about a minute. The triage model sets the triage level; see "Triage model" in [`../API_README.md`](../API_README.md) for how it is trained. `diagnosis_model.json` holds the class names and input coding the diagnosis model file doesn't store. If the service is stopped, `POST /api/triage` answers 503 and nothing is saved.

The database file is `medtriage.db` in this folder (git-ignored). To create it or apply new migrations:

```bash
dotnet ef database update
```

The server does not seed any data. Staff, the symptom catalogue and patients all live in `medtriage.db`, so keep that file: a new, empty database has no staff accounts and no symptoms.

## Running at a facility

The server runs on **one** facility computer that stays on. Staff computers, tablets and phones open its address in a browser (on phones, "Add to Home Screen").

Publish a self-contained build from this folder; the React app is built and shipped as `wwwroot/` next to the executable:

```bash
dotnet publish -c Release -r osx-arm64 --self-contained    # or win-x64, linux-x64, osx-x64
```

| | Development (`dotnet run`) | Published server |
|---|---|---|
| Frontend | Vite dev server (`npm run dev`) | Built React app in `wwwroot/`, served by this server |
| Listens on | `localhost:4000` | `0.0.0.0:4000` (reachable on the LAN) |
| Data folder | `server/` | `%LOCALAPPDATA%\MedTriage` (Windows), `~/Library/Application Support/MedTriage` (macOS), `~/.local/share/MedTriage` (Linux) |
| Console banner | No | Yes (`Server:ShowBanner`) |

Published-server settings are in `appsettings.Production.json`. The database is created or upgraded automatically on startup. Firewalls must allow TCP 4000 on the server.

## How the code is organised

Requests flow down through three layers. Each layer only calls the one below it.

```
Controllers   →   Services   →   DocumentRepository   →   SQLite
(endpoints)       (rules)        (database access)
```

| Folder | What goes there |
|---|---|
| `Controllers/` | One controller per area. A controller reads the request, calls its service, and returns the result. No business logic here. |
| `Services/<Area>/` | One service per controller, behind an interface (`IPatientService` / `PatientService`). Validation, business rules, and mapping entities to DTOs. |
| `Repositories/` | `IDocumentRepository<T>`: the generic repository that talks to the database for every table. |
| `Models/` | Database entities, one class per table. |
| `Dtos/` | Request and response shapes the API sends and receives. These match `src/Homescreen/types.ts`. |
| `Data/` | `MedTriageDbContext` (tables, keys, constraints) and `Migrations/`. |
| `Common/` | Shared pieces: error handling, validation, allowed values, JSON naming, session authentication. |

| Area | Controller | Service | Endpoints |
|---|---|---|---|
| Auth | `AuthController` | `AuthService` | login, session, logout |
| Patients | `PatientsController` | `PatientService` + `PhotoStorage` | registry, register, history, photo |
| Symptoms | `SymptomsController` | `SymptomService` | catalogue |
| Triage | `TriageController` | `TriageService` + `TriageModel` + `DiagnosisModel` | run triage |
| Records | `RecordsController` | `RecordService` | review queue, doctor review |
| Reports | `ReportsController` | `ReportService` | ward overview |

### Using the repository

Inject `IDocumentRepository<T>` for the table you need:

```csharp
public class SymptomService(IDocumentRepository<Symptom> symptoms) : ISymptomService
{
    public async Task Example(CancellationToken ct)
    {
        // Basic helpers
        var one     = await symptoms.GetByIdAsync(3, ct);          // tracked, so it can be edited
        var matches = await symptoms.ListAsync(s => s.Category == "systemic", ct);
        var exists  = await symptoms.ExistsAsync(s => s.SymptomName == "High Fever", ct);
        await symptoms.AddAsync(new Symptom { /* … */ }, ct);
        await symptoms.SaveChangesAsync(ct);

        // Anything more complex (includes, ordering, grouping): build a query
        var sorted = await symptoms.Query().OrderBy(s => s.Category).ToListAsync(ct);
    }
}
```

All repositories in a request share one database context, so a single `SaveChangesAsync()` saves everything changed in that request in one transaction.

### Errors

Services throw `ApiException` (`ApiException.BadRequest("…", "field")`, `ApiException.NotFound("…")`). `ApiExceptionHandler` turns it into the `{ "error", "field"?, "code"? }` body. Any other exception becomes a 500 and is logged.

### Auth

Every endpoint requires a signed-in user unless it's marked `[AllowAnonymous]`. Add `[Authorize(Roles = "doctor")]` to restrict an endpoint by position. In a controller, `User.GetUserId()` gives the signed-in worker's ID.

## Configuration (`appsettings.json`)

Any setting can also be set with an environment variable, using `__` between the parts (e.g. `Inference__DiagnosisModelUrl`). The model URL must use a loopback address.

| Setting | Default | Purpose |
|---|---|---|
| `DataDirectory` | *(see Installing at a facility)* | Folder for the database and photos |
| `ConnectionStrings:MedTriage` | `Data Source=medtriage.db` | SQLite database file, relative to the data folder |
| `Uploads:Directory` | `uploads` | Where patient photos are stored, relative to the data folder |
| `Urls` | `http://0.0.0.0:4000` (installed) | Address and port the server listens on |
| `Server:ShowBanner` | `true` (installed) | Show the address banner in the console window |
| `Inference:DiagnosisModelUrl` | `http://127.0.0.1:8002/diagnose` | Loopback-only diagnosis model sidecar endpoint |
| `Inference:TriageModelUrl` | `http://127.0.0.1:8002/triage` | Loopback-only triage model sidecar endpoint |
| `Inference:TimeoutMs` | `5000` | Diagnosis model request timeout |

## Adding a table or column

1. Change or add the entity in `Models/` and configure it in `Data/MedTriageDbContext.cs`.
2. Run `dotnet ef migrations add <Name>`, then `dotnet ef database update`.
