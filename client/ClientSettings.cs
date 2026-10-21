using System.Text.Json;

namespace MedTriage.Client;

/// <summary>
/// The server this computer last connected to, so later launches go straight to it.
/// Stored in %LOCALAPPDATA%\MedTriage Client (Windows), ~/Library/Application Support/MedTriage Client (macOS)
/// or ~/.local/share/MedTriage Client (Linux).
/// </summary>
public sealed class ClientSettings
{
    // MEDTRIAGE_CLIENT_SETTINGS points elsewhere (used by tests)
    private static readonly string FilePath = Environment.GetEnvironmentVariable("MEDTRIAGE_CLIENT_SETTINGS") is { Length: > 0 } custom
        ? custom
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MedTriage Client", "settings.json");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public string? ServerUrl { get; set; }

    public static ClientSettings Load()
    {
        try
        {
            return File.Exists(FilePath) ? JsonSerializer.Deserialize<ClientSettings>(File.ReadAllText(FilePath), Json) ?? new() : new();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return new();
        }
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(this, Json));
    }
}
