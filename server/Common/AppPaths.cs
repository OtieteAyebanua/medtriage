using Microsoft.Data.Sqlite;

namespace MedTriage.Server.Common;

/// <summary>
/// Where MedTriage keeps its data (database and photos).
/// Development: the server project folder. Installed app: a per-user folder that survives reinstalls,
/// %LOCALAPPDATA%\MedTriage on Windows, ~/Library/Application Support/MedTriage on macOS
/// and ~/.local/share/MedTriage on Linux.
/// Set "DataDirectory" in appsettings to override.
/// </summary>
public sealed record AppPaths(string DataDirectory)
{
    public static AppPaths Create(string? configured, IHostEnvironment env)
    {
        var directory = !string.IsNullOrWhiteSpace(configured)
            ? Path.GetFullPath(configured, env.ContentRootPath)
            : env.IsDevelopment()
                ? env.ContentRootPath
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MedTriage");

        Directory.CreateDirectory(directory);
        return new AppPaths(directory);
    }

    /// <summary>Absolute path for <paramref name="path"/>; relative paths are inside the data folder.</summary>
    public string Resolve(string path) => Path.GetFullPath(path, DataDirectory);

    /// <summary>The SQLite connection string with a relative "Data Source" moved into the data folder.</summary>
    public string SqliteConnectionString(string? configured)
    {
        var builder = new SqliteConnectionStringBuilder(configured ?? "Data Source=medtriage.db");
        if (builder.DataSource != ":memory:") builder.DataSource = Resolve(builder.DataSource);
        return builder.ToString();
    }
}
