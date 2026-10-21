using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace MedTriage.Server.Common;

/// <summary>
/// Lets MedTriage apps on the facility network find this server without anyone typing an address.
/// The app broadcasts "MEDTRIAGE_DISCOVER" on UDP port "Discovery:Port" (default 4001) and this replies with
/// { "app": "MedTriage", "port": 4000, "name": "&lt;computer name&gt;" }. The app takes the server's IP from
/// the reply's sender address.
/// </summary>
public sealed class DiscoveryResponder(IConfiguration config, ILogger<DiscoveryResponder> logger) : BackgroundService
{
    public const string Request = "MEDTRIAGE_DISCOVER";
    public const int DefaultPort = 4001;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var discoveryPort = config.GetValue("Discovery:Port", DefaultPort);
        var httpPort = new Uri(ServerConsole.LocalUrl(config)).Port;

        using var udp = new UdpClient(AddressFamily.InterNetwork);
        try
        {
            udp.Client.Bind(new IPEndPoint(IPAddress.Any, discoveryPort));
        }
        catch (SocketException ex)
        {
            logger.LogWarning(ex, "Network discovery is off: UDP port {Port} is in use. Apps must be given the server address", discoveryPort);
            return;
        }

        var reply = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { app = "MedTriage", port = httpPort, name = Environment.MachineName }));

        while (!stoppingToken.IsCancellationRequested)
        {
            UdpReceiveResult message;
            try
            {
                message = await udp.ReceiveAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (SocketException)
            {
                continue;
            }

            if (Encoding.UTF8.GetString(message.Buffer) == Request)
            {
                await udp.SendAsync(reply, message.RemoteEndPoint, stoppingToken);
            }
        }
    }
}
