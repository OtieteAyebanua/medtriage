using System.Reflection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace MedTriage.Client;

/// <summary>
/// The "Connect to MedTriage Server" screen, shown when no server was found automatically (or there are
/// several). It's a small page served on this computer only (127.0.0.1) and opened in the app window;
/// once staff pick a server, the same window moves on to that server and this program exits.
/// </summary>
public static class ConnectPage
{
    private static readonly TimeSpan GiveUpAfter = TimeSpan.FromMinutes(30);

    public static async Task RunAsync(ClientSettings settings, List<FoundServer> found, string? unreachableServer)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0"); // any free port, this computer only
        builder.Logging.ClearProviders();
        var app = builder.Build();

        var html = ReadPage();
        var servers = found;

        app.MapGet("/", () => Results.Content(html, "text/html; charset=utf-8"));

        app.MapGet("/state", () => Results.Json(new { unreachableServer, servers }));

        app.MapPost("/search", async () =>
        {
            servers = await ServerFinder.DiscoverAsync(TimeSpan.FromSeconds(2));
            return Results.Json(new { servers });
        });

        app.MapPost("/connect", async (ConnectRequest request) =>
        {
            var url = ServerFinder.NormaliseAddress(request.Address);
            if (url is null)
            {
                return Results.Json(new { error = "That doesn't look like an address. Try something like 192.168.1.20." }, statusCode: 400);
            }
            if (!await ServerFinder.IsMedTriageAsync(url))
            {
                return Results.Json(new { error = $"No MedTriage Server answered at {url}. Check the address on the server's window, and that this computer is on the same network." }, statusCode: 400);
            }

            settings.ServerUrl = url;
            settings.Save();

            // Give the page time to move the window to the server, then exit
            _ = Task.Delay(TimeSpan.FromSeconds(3)).ContinueWith(_ => app.Lifetime.StopApplication());
            return Results.Json(new { url });
        });

        await app.StartAsync();

        var pageUrl = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
        AppWindow.Open(pageUrl);

        // Nobody chose a server (e.g. the window was closed): don't linger forever in the background
        using var giveUp = new CancellationTokenSource(GiveUpAfter);
        giveUp.Token.Register(() => app.Lifetime.StopApplication());

        await app.WaitForShutdownAsync();
    }

    private static string ReadPage()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ConnectPage.html")
            ?? throw new InvalidOperationException("ConnectPage.html is missing from the build");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private record ConnectRequest(string? Address);
}
