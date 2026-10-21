using System.ComponentModel;
using System.Diagnostics;

namespace MedTriage.Client;

/// <summary>
/// Opens MedTriage in an app-style window (no address bar or tabs) using Chrome or Edge's app mode,
/// falling back to the default browser.
/// </summary>
public static class AppWindow
{
    private const int Width = 1280;
    private const int Height = 860;

    /// <summary>Set by --no-window (testing): print the address instead of opening a window.</summary>
    public static bool Disabled { get; set; }

    public static void Open(string url)
    {
        if (Disabled)
        {
            Console.WriteLine($"OPEN {url}");
            return;
        }

        string[] appArgs = [$"--app={url}", $"--window-size={Width},{Height}"];

        if (OperatingSystem.IsMacOS())
        {
            // Browsers are .app bundles on macOS; "open -na" starts one with arguments
            string[] browsers = ["Google Chrome", "Microsoft Edge", "Chromium", "Brave Browser"];
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var installed = browsers.FirstOrDefault(name =>
                Directory.Exists($"/Applications/{name}.app") || Directory.Exists(Path.Combine(home, "Applications", $"{name}.app")));
            if (installed is not null && TryStart(new ProcessStartInfo("open", ["-na", installed, "--args", .. appArgs]))) return;
        }
        else
        {
            // Edge ships with Windows 10/11; Chrome/Chromium are the usual choices on Linux
            string[] browsers = OperatingSystem.IsWindows()
                ? ["msedge", "chrome"]
                : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];

            foreach (var browser in browsers)
            {
                var start = OperatingSystem.IsWindows()
                    ? new ProcessStartInfo(browser, string.Join(' ', appArgs)) { UseShellExecute = true }
                    : new ProcessStartInfo(browser, appArgs);
                if (TryStart(start)) return;
            }
        }

        // No Chromium-based browser: the default browser still works, just with an address bar
        var fallback = OperatingSystem.IsWindows() ? new ProcessStartInfo(url) { UseShellExecute = true }
            : OperatingSystem.IsMacOS() ? new ProcessStartInfo("open", [url])
            : new ProcessStartInfo("xdg-open", [url]);
        TryStart(fallback);
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
