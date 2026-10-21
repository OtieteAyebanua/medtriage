// MedTriage app for staff computers. It has no server or database of its own:
//   1. reconnect to the server it used last time, if that's still reachable;
//   2. otherwise look for a MedTriage Server on the network, and use it if there's exactly one;
//   3. otherwise show the "Connect to server" screen (found servers + type an address).
// The server's screens open in an app window; this program exits once the window is pointed at the server.
//
// Options: --choose-server  always show the connect screen (to switch servers)
//          --no-window      print the address instead of opening a window (testing)
using MedTriage.Client;

var chooseServer = args.Contains("--choose-server");
AppWindow.Disabled = args.Contains("--no-window");

var settings = ClientSettings.Load();

if (!chooseServer && settings.ServerUrl is { } saved && await ServerFinder.IsMedTriageAsync(saved))
{
    AppWindow.Open(saved);
    return;
}

var found = await ServerFinder.DiscoverAsync(TimeSpan.FromSeconds(2));
if (!chooseServer && found.Count == 1)
{
    settings.ServerUrl = found[0].Url;
    settings.Save();
    AppWindow.Open(found[0].Url);
    return;
}

await ConnectPage.RunAsync(settings, found, unreachableServer: chooseServer ? null : settings.ServerUrl);
