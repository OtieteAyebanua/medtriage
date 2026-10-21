# MedTriage (client app)

The app staff install on their own computers. It has no server or database: it connects to the facility's **MedTriage Server** (see [`../server`](../server/README.md)) over the Wi-Fi or LAN and opens it in an app window.

## What happens when it starts

1. **Reconnect:** if it connected to a server before and that server still answers, open it straight away.
2. **Search the network:** broadcast on UDP port 4001; the MedTriage Server replies with its port and computer name. If exactly one server answers, save it and open it.
3. **Ask:** otherwise (no server, or several), show the "Connect to MedTriage Server" screen. It lists the servers found and has a box for typing the address shown in the server's window. The choice is saved.

The screens themselves come from the server, so the client never needs updating when the server changes. The window is Chrome or Edge in app mode (no address bar), falling back to the default browser. The program exits once the window points at the server.

The chosen server is saved in `settings.json` under `%LOCALAPPDATA%\MedTriage Client` (Windows), `~/Library/Application Support/MedTriage Client` (macOS) or `~/.local/share/MedTriage Client` (Linux).

## Run it

```bash
cd client
dotnet run                          # find the server and open it
dotnet run -- --choose-server       # always show the connect screen (to switch servers)
dotnet run -- --no-window           # print the address instead of opening a window (testing)
```

`MEDTRIAGE_CLIENT_SETTINGS=/some/file.json` stores the saved server somewhere else (used by tests).

## Files

| File | Purpose |
|---|---|
| `Program.cs` | The three startup steps above |
| `ServerFinder.cs` | Network search, checking an address is a MedTriage server (`/api/health`), tidying typed addresses |
| `ConnectPage.cs`, `ConnectPage.html` | The connect screen, served on `127.0.0.1` only |
| `AppWindow.cs` | Opens the app window per platform |
| `ClientSettings.cs` | The saved server address |

Installers are built with `packaging/publish.sh client` from the repo root; see the server README's "Installing at a facility".
