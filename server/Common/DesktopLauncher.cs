using System.ComponentModel;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace MedTriage.Server.Common;

/// <summary>
/// Makes the installed server behave like a desktop app: clicking the icon starts the server and opens
/// MedTriage in an app-style browser window (no address bar or tabs). Clicking it again while it's running
/// just opens another window. Enabled by "Desktop:OpenWindow" (on in appsettings.Production.json).
/// </summary>
public static class DesktopLauncher
{
    private const int WindowWidth = 1280;
    private const int WindowHeight = 860;

    /// <summary>The address this machine uses to reach the server, e.g. http://localhost:4000.</summary>
    public static string LocalUrl(IConfiguration config)
    {
        // "Urls" comes from appsettings or the ASPNETCORE_URLS environment variable
        var first = (config["Urls"] ?? "http://localhost:5000").Split(';')[0].Trim();
        var normalised = first.Replace("://*", "://localhost").Replace("://+", "://localhost");
        var builder = new UriBuilder(normalised) { Host = "localhost" };
        return builder.Uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>True if MedTriage is already answering on <paramref name="localUrl"/>.</summary>
    public static async Task<bool> IsAlreadyRunningAsync(string localUrl)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var body = await http.GetStringAsync($"{localUrl}/api/health");
            return body.Contains("MedTriage", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return false;
        }
    }

    /// <summary>Opens MedTriage in an app window, falling back to the default browser.</summary>
    public static void OpenWindow(string url, ILogger logger)
    {
        var appArgs = $"--app={url} --window-size={WindowWidth},{WindowHeight}";

        if (OperatingSystem.IsMacOS())
        {
            // Browsers are .app bundles on macOS; "open -na" starts one with arguments
            string[] macBrowsers = ["Google Chrome", "Microsoft Edge", "Chromium", "Brave Browser"];
            var installed = macBrowsers.FirstOrDefault(name =>
                Directory.Exists($"/Applications/{name}.app") ||
                Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Applications", $"{name}.app")));
            if (installed is not null && TryStart(new ProcessStartInfo("open", ["-na", installed, "--args", $"--app={url}", $"--window-size={WindowWidth},{WindowHeight}"])))
            {
                return;
            }
        }
        else
        {
            // Edge ships with Windows 10/11; Chrome/Chromium are the usual choices on Linux.
            string[] candidates = OperatingSystem.IsWindows()
                ? ["msedge", "chrome"]
                : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];

            foreach (var browser in candidates)
            {
                if (TryStart(new ProcessStartInfo(browser, appArgs) { UseShellExecute = OperatingSystem.IsWindows() })) return;
            }
        }

        logger.LogInformation("No Chromium-based browser found; opening {Url} in the default browser", url);
        var fallback = OperatingSystem.IsWindows() ? new ProcessStartInfo(url) { UseShellExecute = true }
            : OperatingSystem.IsMacOS() ? new ProcessStartInfo("open", url)
            : new ProcessStartInfo("xdg-open", url);
        if (!TryStart(fallback)) logger.LogWarning("Could not open a browser. Open {Url} manually", url);
    }

    /// <summary>Console banner telling staff how to reach the app from other devices.</summary>
    public static void PrintBanner(string localUrl, string dataDirectory)
    {
        var port = new Uri(localUrl).Port;
        var lanAddresses = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
            .Select(a => $"http://{a.Address}:{port}")
            .Distinct()
            .ToList();

        Console.WriteLine();
        Console.WriteLine("  MedTriage is running.");
        Console.WriteLine($"  On this computer: {localUrl}");
        foreach (var address in lanAddresses) Console.WriteLine($"  On tablets and phones on the same network: {address}");
        Console.WriteLine($"  Patient data is stored in: {dataDirectory}");
        Console.WriteLine("  Keep this window open. Closing it stops MedTriage for everyone.");
        Console.WriteLine();
    }

    private static bool TryStart(ProcessStartInfo info)
    {
        try
        {
            using var process = Process.Start(info);
            return process is not null || info.UseShellExecute;
        }
        catch (Exception ex) when (ex is Win32Exception or FileNotFoundException or InvalidOperationException)
        {
            return false;
        }
    }
}
