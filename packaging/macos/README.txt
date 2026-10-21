MedTriage AI - macOS
====================

Which file?
  Apple Silicon Macs (M1, M2, M3, M4 ...):  medtriage-macos-arm64.dmg
  Older Intel Macs:                          medtriage-macos-x64.dmg
  (Apple menu > About This Mac shows "Chip: Apple ..." for Apple Silicon.)

Install
  1. Open the .dmg file.
  2. Drag MedTriage onto the Applications folder.
  3. Open MedTriage from Applications or Launchpad. To keep it handy, right-click its Dock icon
     while it's open and choose Options > Keep in Dock.

  The first time, macOS may say MedTriage "could not be verified" (it isn't from the App Store).
  Click "Done", then open System Settings > Privacy & Security, scroll down and click
  "Open Anyway" next to MedTriage. You only need to do this once.

Use
  - Click MedTriage. A Terminal window opens (that's the server) and then the MedTriage app window.
  - Keep the Terminal window open while the facility is using MedTriage. Closing it stops
    MedTriage for everyone, including tablets.
  - The Terminal window shows the address for tablets and phones, for example
    http://192.168.1.20:4000. Open that address in the tablet's browser, then use
    "Add to Home Screen" to get an icon there too.
  - For the app-style window, install Google Chrome or Microsoft Edge. Without them MedTriage
    opens in Safari instead.
  - The first time, macOS may ask whether MedTriage may accept incoming network connections.
    Choose "Allow", or tablets won't be able to connect.

Your data
  The database and patient photos are stored in ~/Library/Application Support/MedTriage.
  Reinstalling or updating MedTriage keeps them. Back this folder up regularly.

Update
  Open the new .dmg and drag MedTriage onto Applications again (choose "Replace").
