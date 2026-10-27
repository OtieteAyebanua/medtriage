using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using System.Text.Json.Serialization.Metadata;
using MedTriage.Server.Common;
using MedTriage.Server.Common.Auth;
using MedTriage.Server.Data;
using MedTriage.Server.Models;
using MedTriage.Server.Repositories;
using MedTriage.Server.Services.Admin;
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
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthentication.Scheme, null)
    // The /admin console has its own cookie; its controllers opt in to this scheme explicitly
    .AddScheme<AuthenticationSchemeOptions, AdminSessionAuthenticationHandler>(AdminAuthentication.Scheme, null);
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
builder.Services.AddScoped<IAdminAuthService, AdminAuthService>();
builder.Services.AddScoped<IPractitionerService, PractitionerService>();
builder.Services.Configure<AdminOptions>(builder.Configuration.GetSection("Admin"));

// The admin password guards account creation, so slow down guessing: 5 attempts per minute per address
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (context, ct) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
        new ErrorResponse("Too many attempts. Wait a minute and try again.", Code: "RATE_LIMITED"), ct));
    o.AddPolicy(AdminAuthentication.LoginRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.Configure<PhotoStorageOptions>(builder.Configuration.GetSection("Uploads"));
builder.Services.AddSingleton<IPhotoStorage, PhotoStorage>();

builder.Services.Configure<InferenceOptions>(builder.Configuration.GetSection("Inference"));
builder.Services.AddHttpClient<DiagnosisModel>();
builder.Services.AddHttpClient<TriageModel>();

var app = builder.Build();

// ---- Installed server: console banner, and a clear message instead of a crash if it's started twice ----
var showBanner = app.Configuration.GetValue<bool>("Server:ShowBanner");
var localUrl = ServerConsole.LocalUrl(app.Configuration);
if (showBanner && await ServerConsole.IsAlreadyRunningAsync(localUrl))
{
    ServerConsole.WaitForEnter("MedTriage Server is already running on this computer.");
    return;
}

// Create or upgrade the database on startup, so a fresh install works on first launch
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<MedTriageDbContext>().Database.Migrate();
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
app.UseRateLimiter();

app.MapControllers();
app.MapGet("/api/health", () => new { app = "MedTriage", status = "ok" }).AllowAnonymous();

// Unknown /api routes get a JSON 404; anything else is a page of the React app
app.MapFallback("/api/{**path}", () => Results.Json(new ErrorResponse("Not found"), statusCode: StatusCodes.Status404NotFound))
    .AllowAnonymous();
if (hasFrontend)
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

if (showBanner)
{
    app.Lifetime.ApplicationStarted.Register(() => ServerConsole.PrintBanner(localUrl, paths.DataDirectory));
}

try
{
    await app.RunAsync();
}
catch (IOException ex) when (showBanner)
{
    // Usually the port is taken by another program. Keep the window open long enough to read why.
    ServerConsole.WaitForEnter($"MedTriage Server could not start: {ex.Message} Another program may be using {localUrl}.");
}
