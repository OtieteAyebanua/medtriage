using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace MedTriage.Server.Common;

/// <summary>
/// What the installed server shows in its console window. Staff don't use the server directly:
/// they open the MedTriage app on their own computer, which finds this server on the network.
/// Enabled by "Server:ShowBanner" (on in appsettings.Production.json).
/// </summary>
public static class ServerConsole
{
    /// <summary>The address this computer uses to reach the server, e.g. http://localhost:4000.</summary>
    public static string LocalUrl(IConfiguration config)
    {
        // "Urls" comes from appsettings or the ASPNETCORE_URLS environment variable
        var first = (config["Urls"] ?? "http://localhost:5000").Split(';')[0].Trim();
        var normalised = first.Replace("://*", "://localhost").Replace("://+", "://localhost");
        var builder = new UriBuilder(normalised) { Host = "localhost" };
        return builder.Uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>The server's addresses on the facility network, e.g. http://192.168.1.20:4000.</summary>
    public static List<string> NetworkUrls(int port) =>
        NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
            .Select(a => $"http://{a.Address}:{port}")
            .Distinct()
            .ToList();

    /// <summary>True if a MedTriage server is already answering on <paramref name="localUrl"/>.</summary>
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

    public static void PrintBanner(string localUrl, string dataDirectory)
    {
        var addresses = NetworkUrls(new Uri(localUrl).Port);

        Console.WriteLine();
        Console.WriteLine("  MedTriage Server is running.");
        Console.WriteLine();
        Console.WriteLine("  Staff computers: open the MedTriage app. It finds this server automatically.");
        if (addresses.Count > 0)
        {
            Console.WriteLine("  If it asks for an address, or on tablets and phones (in the browser), use:");
            foreach (var address in addresses) Console.WriteLine($"      {address}");
        }
        else
        {
            Console.WriteLine("  This computer isn't connected to a network, so other devices can't reach it yet.");
        }
        Console.WriteLine();
        Console.WriteLine($"  Patient data is stored in: {dataDirectory}");
        Console.WriteLine("  Keep this window open. Closing it stops MedTriage for everyone.");
        Console.WriteLine();
    }

    /// <summary>Keeps the console window open long enough to read a message (the window closes when the program ends).</summary>
    public static void WaitForEnter(string message)
    {
        Console.Error.WriteLine();
        Console.Error.WriteLine($"  {message}");
        Console.Error.WriteLine("  Press Enter to close this window.");
        Console.ReadLine();
    }
}
