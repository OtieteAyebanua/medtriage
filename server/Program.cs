using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using MedTriage.Server.Common;
using MedTriage.Server.Common.Auth;
using MedTriage.Server.Data;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using MedTriage.Server.Services.Auth;
using MedTriage.Server.Services.Patients;
using MedTriage.Server.Services.Records;
using MedTriage.Server.Services.Reports;
using MedTriage.Server.Services.Symptoms;
using MedTriage.Server.Services.Triage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var isDevelopment = string.Equals(
    Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT"),
    "Development", StringComparison.OrdinalIgnoreCase);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    // The installed app is started from a shortcut, so the working folder can be anything:
    // look for appsettings and the frontend (wwwroot) next to the executable instead.
    ContentRootPath = isDevelopment ? null : AppContext.BaseDirectory,
});

var paths = AppPaths.Create(builder.Configuration["DataDirectory"], builder.Environment);
builder.Services.AddSingleton(paths);

// ---- Controllers and JSON ----
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        // Vitals may arrive as "39.4" from the form
        o.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
        // DTOs marked [SnakeCaseJson] serialize as snake_case, everything else as camelCase
        o.JsonSerializerOptions.TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { SnakeCaseJson.Apply } };
    })
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ApiExceptionHandler.FromModelState);
builder.Services.AddOpenApi();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();

// ---- Database (repository layer) ----
builder.Services.AddDbContext<MedTriageDbContext>(options =>
    options.UseSqlite(paths.SqliteConnectionString(builder.Configuration.GetConnectionString("MedTriage"))));
builder.Services.AddScoped(typeof(IDocumentRepository<>), typeof(DocumentRepository<>));

// ---- Auth: session cookie, every endpoint requires sign-in unless marked [AllowAnonymous] ----
builder.Services
    .AddAuthentication(SessionAuthentication.Scheme)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthentication.Scheme, null);
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddSingleton<IPasswordHasher<HealthcareWorker>, PasswordHasher<HealthcareWorker>>();

// ---- Services (business logic, one per controller area) ----
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<ISymptomService, SymptomService>();
builder.Services.AddScoped<ITriageService, TriageService>();
builder.Services.AddScoped<IRecordService, RecordService>();
builder.Services.AddScoped<IReportService, ReportService>();

builder.Services.Configure<PhotoStorageOptions>(builder.Configuration.GetSection("Uploads"));
builder.Services.AddSingleton<IPhotoStorage, PhotoStorage>();

builder.Services.Configure<InferenceOptions>(builder.Configuration.GetSection("Inference"));
builder.Services.AddSingleton<RuleTriageEngine>();
builder.Services.AddHttpClient<IInferenceService, InferenceService>();

var app = builder.Build();

// ---- Desktop app: clicking the icon again while it's running just opens another window ----
var openWindow = app.Configuration.GetValue<bool>("Desktop:OpenWindow");
var localUrl = DesktopLauncher.LocalUrl(app.Configuration);
if (openWindow && await DesktopLauncher.IsAlreadyRunningAsync(localUrl))
{
    DesktopLauncher.OpenWindow(localUrl, app.Logger);
    return;
}

// Create or upgrade the database on startup, so a fresh install works on first launch
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<MedTriageDbContext>().Database.Migrate();

    // Demo staff, symptoms, patients and visits for an empty database (turn off with DemoData:Enabled=false)
    if (app.Configuration.GetValue("DemoData:Enabled", true))
    {
        await DemoSeeder.SeedIfEmptyAsync(scope.ServiceProvider, app.Configuration["DemoData:Password"] ?? "demo123");
    }
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// ---- Frontend: the built React app in wwwroot (present in the installed app; in development Vite serves it) ----
var hasFrontend = File.Exists(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html"));
if (hasFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/api/health", () => new { app = "MedTriage", status = "ok" }).AllowAnonymous();

// Unknown /api routes get a JSON 404; anything else is a page of the React app
app.MapFallback("/api/{**path}", () => Results.Json(new ErrorResponse("Not found"), statusCode: StatusCodes.Status404NotFound))
    .AllowAnonymous();
if (hasFrontend)
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

if (openWindow)
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        DesktopLauncher.PrintBanner(localUrl, paths.DataDirectory);
        DesktopLauncher.OpenWindow(localUrl, app.Logger);
    });
}

try
{
    await app.RunAsync();
}
catch (IOException ex) when (openWindow)
{
    // Usually the port is taken by another program. Keep the window open long enough to read why.
    Console.Error.WriteLine($"\n  MedTriage could not start: {ex.Message}");
    Console.Error.WriteLine($"  Another program may be using {localUrl}. Press Enter to close.");
    Console.ReadLine();
}
