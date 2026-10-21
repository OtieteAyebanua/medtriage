# MedTriage server

ASP.NET Core (.NET 10) API with a SQLite database. It implements every endpoint in [`../API_README.md`](../API_README.md).

## Run it

```bash
cd server
dotnet run --launch-profile http     # http://localhost:4000
```

The database file is `medtriage.db` in this folder (git-ignored). To create it or apply new migrations:

```bash
dotnet ef database update
```

On first start, an empty database is filled with demo data (`Data/DemoSeeder.cs`): 8 staff, 33 symptoms, 20 patients and ~45 visits over the last 30 days, with doctor reviews and 6 visits waiting in the review queue. Every demo account's password is `demo123`; the login screen's quick-demo buttons use `HW-DOC-001` (doctor) and `HW-NUR-002` (nurse). Turn this off with `DemoData:Enabled=false`. To start over, delete the database file and restart.

## Installing at a facility

MedTriage is two separate apps:

| App | Install on | What it does |
|---|---|---|
| **MedTriage Server** (this project) | The **one** facility computer that stays on | Database, API, triage engine, and the web screens. Its console window shows its network address. |
| **MedTriage** ([`../client`](../client/README.md)) | Every **staff computer** | Finds the server on the Wi-Fi/LAN and opens it in an app window. No data of its own. |

Tablets and phones need no app: they open the server's address in the browser and use "Add to Home Screen".

Build the installers from the repo root:

```bash
packaging/publish.sh                      # everything into release/
packaging/publish.sh server               # just the server, every platform
packaging/publish.sh client osx-arm64     # just one app/platform (win-x64, linux-x64, osx-arm64, osx-x64)
```

| | MedTriage Server | MedTriage (client) |
|---|---|---|
| Windows | `medtriage-server-windows-x64.zip` | `medtriage-windows-x64.zip` |
| Linux | `medtriage-server-linux-x64.tar.gz` | `medtriage-linux-x64.tar.gz` |
| macOS | `medtriage-server-macos-{arm64,x64}.dmg` | `medtriage-macos-{arm64,x64}.dmg` |

Windows: unzip and double-click `Install <app>.cmd`. Linux: extract and run `./install.sh`. macOS: open the `.dmg` and drag the app to Applications. Each package has a `README.txt` for facility staff. The packages are self-contained (no .NET or Node needed), and Mac packages must be built on a Mac.

**How clients find the server:** the server answers UDP broadcasts on port 4001 (`Discovery:Port`) with its HTTP port and computer name, and the client takes the server's IP from the reply. If nothing answers (e.g. a network that blocks broadcasts), the client shows a "Connect to server" screen where staff type the address from the server's window. Firewalls must allow TCP 4000 and UDP 4001 on the server.

| | Development (`dotnet run`) | Installed server |
|---|---|---|
| Frontend | Vite dev server (`npm run dev`) | Built React app in `wwwroot/`, served by this server |
| Listens on | `localhost:4000` | `0.0.0.0:4000` (reachable on the LAN) |
| Data folder | `server/` | `%LOCALAPPDATA%\MedTriage` (Windows), `~/Library/Application Support/MedTriage` (macOS), `~/.local/share/MedTriage` (Linux) |
| Console banner | No | Yes (`Server:ShowBanner`) |

Installed-server settings are in `appsettings.Production.json`. The database is created or upgraded automatically on startup, and reinstalling keeps the data folder. Installer templates live in `packaging/` (`windows/`, `linux/`, `macos/`; `publish.sh` fills them in for each app).

The Mac apps are signed ad hoc only, so on first launch macOS says they "could not be verified" and staff must click **Open Anyway** in System Settings → Privacy & Security. Removing that step requires an Apple Developer ID and notarization.

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
| Triage | `TriageController` | `TriageService` + `InferenceService` + `RuleTriageEngine` | run triage |
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

Any setting can also be set with an environment variable, using `__` between the parts (e.g. `Inference__Url`).

| Setting | Default | Purpose |
|---|---|---|
| `DataDirectory` | *(see Installing at a facility)* | Folder for the database and photos |
| `ConnectionStrings:MedTriage` | `Data Source=medtriage.db` | SQLite database file, relative to the data folder |
| `Uploads:Directory` | `uploads` | Where patient photos are stored, relative to the data folder |
| `Urls` | `http://0.0.0.0:4000` (installed) | Address and port the server listens on |
| `Server:ShowBanner` | `true` (installed) | Show the address banner in the console window |
| `Discovery:Enabled` / `Discovery:Port` | `true` / `4001` | Answer MedTriage apps searching the network |
| `DemoData:Enabled` | `true` | Fill an empty database with demo data on startup |
| `DemoData:Password` | `demo123` | Password for the demo staff accounts |
| `Inference:Provider` | `ollama` | AI model alongside the rule engine: `ollama`, `http`, `rules` or `auto` (see "Inference service" in API_README.md) |
| `Inference:Ollama:Model` | `qwen2.5:1.5b` | Local model in Ollama (`ollama pull qwen2.5:1.5b` first) |
| `Inference:Ollama:Url` / `TimeoutMs` | `http://localhost:11434` / `60000` | Where Ollama runs; when to give up and use the rules |
| `Inference:Url` / `TimeoutMs` / `ApiKey` | *(empty)* / `5000` / *(empty)* | External model server for the `http` provider |

## Adding a table or column

1. Change or add the entity in `Models/` and configure it in `Data/MedTriageDbContext.cs`.
2. Run `dotnet ef migrations add <Name>`, then `dotnet ef database update`.
