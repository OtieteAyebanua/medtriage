using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace MedTriage.Client;

/// <param name="Name">The server computer's name, shown when there's more than one to choose from.</param>
public record FoundServer(string Name, string Url);

/// <summary>Finds and checks MedTriage servers on the facility network.</summary>
public static class ServerFinder
{
    public const int DefaultHttpPort = 4000;
    public const int DiscoveryPort = 4001;
    private const string DiscoveryRequest = "MEDTRIAGE_DISCOVER";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(3) };

    /// <summary>True if <paramref name="serverUrl"/> is a running MedTriage server.</summary>
    public static async Task<bool> IsMedTriageAsync(string serverUrl)
    {
        try
        {
            var body = await Http.GetStringAsync($"{serverUrl.TrimEnd('/')}/api/health");
            return body.Contains("MedTriage", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException or UriFormatException)
        {
            return false;
        }
    }

    /// <summary>
    /// Turns what staff type ("192.168.1.20", "192.168.1.20:4000", "http://medtriage-pc:4000/") into a server URL.
    /// Null if it can't be an address.
    /// </summary>
    public static string? NormaliseAddress(string? input)
    {
        var text = input?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        if (!text.Contains("://")) text = "http://" + text;
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || string.IsNullOrEmpty(uri.Host))
        {
            return null;
        }

        var builder = new UriBuilder(uri.Scheme, uri.Host, uri.IsDefaultPort && !text.Contains($":{uri.Port}") ? DefaultHttpPort : uri.Port);
        return builder.Uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>
    /// Asks the network "is there a MedTriage server?" (UDP broadcast) and collects the answers for
    /// <paramref name="listenFor"/>. Also checks this computer, in case the server runs here.
    /// </summary>
    public static async Task<List<FoundServer>> DiscoverAsync(TimeSpan listenFor)
    {
        var found = new Dictionary<string, FoundServer>();

        using (var udp = new UdpClient(AddressFamily.InterNetwork) { EnableBroadcast = true })
        {
            udp.Client.Bind(new IPEndPoint(IPAddress.Any, 0));
            using var timeout = new CancellationTokenSource(listenFor);

            // Ask twice: the first packets can be lost (Wi-Fi power saving, or macOS asking for local network access)
            _ = Task.Run(async () =>
            {
                var request = Encoding.UTF8.GetBytes(DiscoveryRequest);
                for (var round = 0; round < 2 && !timeout.IsCancellationRequested; round++)
                {
                    foreach (var target in BroadcastAddresses())
                    {
                        try
                        {
                            await udp.SendAsync(request, new IPEndPoint(target, DiscoveryPort));
                        }
                        catch (Exception ex) when (ex is SocketException or ObjectDisposedException)
                        {
                            // That network doesn't allow broadcasts; the others may
                        }
                    }
                    await Task.Delay(listenFor / 2);
                }
            });

            while (!timeout.IsCancellationRequested)
            {
                try
                {
                    var reply = await udp.ReceiveAsync(timeout.Token);
                    if (TryReadReply(reply, out var server)) found.TryAdd(server.Url, server);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (SocketException)
                {
                    // Ignore a bad packet and keep listening
                }
            }
        }

        // The server on this same computer (discovery may not loop back on every system)
        var local = $"http://localhost:{DefaultHttpPort}";
        if (found.Count == 0 && await IsMedTriageAsync(local))
        {
            found[local] = new FoundServer($"{Environment.MachineName} (this computer)", local);
        }

        return found.Values.OrderBy(s => s.Name).ToList();
    }

    private static bool TryReadReply(UdpReceiveResult reply, out FoundServer server)
    {
        server = null!;
        try
        {
            using var json = JsonDocument.Parse(reply.Buffer);
            var root = json.RootElement;
            if (root.GetProperty("app").GetString() != "MedTriage") return false;

            var port = root.TryGetProperty("port", out var p) ? p.GetInt32() : DefaultHttpPort;
            var name = root.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            var url = new UriBuilder("http", reply.RemoteEndPoint.Address.ToString(), port).Uri.GetLeftPart(UriPartial.Authority);
            server = new FoundServer(string.IsNullOrEmpty(name) ? url : name, url);
            return true;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        {
            return false;
        }
    }

    /// <summary>The general broadcast address plus each network's own (needed on macOS with several interfaces).</summary>
    private static IEnumerable<IPAddress> BroadcastAddresses()
    {
        yield return IPAddress.Broadcast;

        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up || nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

            foreach (var unicast in nic.GetIPProperties().UnicastAddresses)
            {
                if (unicast.Address.AddressFamily != AddressFamily.InterNetwork || unicast.IPv4Mask is null) continue;

                var address = unicast.Address.GetAddressBytes();
                var mask = unicast.IPv4Mask.GetAddressBytes();
                var broadcast = new byte[4];
                for (var i = 0; i < 4; i++) broadcast[i] = (byte)(address[i] | ~mask[i]);
                yield return new IPAddress(broadcast);
            }
        }
    }
}
