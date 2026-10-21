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

## Desktop app (Windows, macOS and Linux)

For facilities, MedTriage ships as a click-to-start app. The server serves the React frontend itself, so it's one program:

```bash
packaging/publish.sh                      # from the repo root; builds every package into release/
packaging/publish.sh win-x64 osx-arm64    # or just some (win-x64, linux-x64, osx-arm64, osx-x64)
```

| Package | Install | What the user gets |
|---|---|---|
| `release/medtriage-windows-x64.zip` | Unzip, double-click `Install MedTriage.cmd` | Desktop + Start menu icon |
| `release/medtriage-linux-x64.tar.gz` | Extract, run `./install.sh` | App-menu entry + desktop icon |
| `release/medtriage-macos-arm64.dmg` (Apple Silicon), `release/medtriage-macos-x64.dmg` (Intel) | Open, drag MedTriage to Applications | App in Applications / Launchpad / Dock |

The packages are self-contained, so the facility computer doesn't need .NET or Node. Mac packages must be built on a Mac (the script skips them elsewhere). Clicking the icon:

1. Starts the server in a console window (Terminal on macOS), which shows the address for tablets (e.g. `http://192.168.1.20:4000`).
2. Opens MedTriage in an app-style window: Edge on Windows, Chrome or Edge on macOS, Chrome or Chromium on Linux, or the default browser if none is found.
3. If MedTriage is already running, only opens another window.

Tablets and phones on the same network open the address shown in the console, then use "Add to Home Screen" to get an icon.

| | Development (`dotnet run`) | Installed app |
|---|---|---|
| Frontend | Vite dev server (`npm run dev`) | Built React app in `wwwroot/`, served by this server |
| Listens on | `localhost:4000` | `0.0.0.0:4000` (reachable on the LAN) |
| Data folder | `server/` | `%LOCALAPPDATA%\MedTriage` (Windows), `~/Library/Application Support/MedTriage` (macOS), `~/.local/share/MedTriage` (Linux) |
| Opens a window | No | Yes (`Desktop:OpenWindow`) |

Installed-app settings are in `appsettings.Production.json`. The database is created or upgraded automatically on startup, and reinstalling keeps the data folder. Installer files live in `packaging/windows`, `packaging/linux` and `packaging/macos` (the `.app` launcher and `Info.plist`).

The Mac app is signed ad hoc only, so on first launch macOS says it "could not be verified" and staff must click **Open Anyway** in System Settings → Privacy & Security (the packaged README explains). Removing that step requires an Apple Developer ID and notarization.

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
| `DataDirectory` | *(see Desktop app)* | Folder for the database and photos |
| `ConnectionStrings:MedTriage` | `Data Source=medtriage.db` | SQLite database file, relative to the data folder |
| `Uploads:Directory` | `uploads` | Where patient photos are stored, relative to the data folder |
| `Urls` | `http://0.0.0.0:4000` (installed) | Address and port the server listens on |
| `Desktop:OpenWindow` | `true` (installed) | Open the app window on start |
| `DemoData:Enabled` | `true` | Fill an empty database with demo data on startup |
| `DemoData:Password` | `demo123` | Password for the demo staff accounts |
| `Inference:Url` | *(empty)* | External AI model endpoint. Empty → built-in rule engine |
| `Inference:TimeoutMs` | `5000` | Timeout before falling back to the rule engine |
| `Inference:ApiKey` | *(empty)* | Sent as a bearer token if set |

## Adding a table or column

1. Change or add the entity in `Models/` and configure it in `Data/MedTriageDbContext.cs`.
2. Run `dotnet ef migrations add <Name>`, then `dotnet ef database update`.
