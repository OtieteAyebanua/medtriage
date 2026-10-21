MedTriage Server - macOS
========================

Install this on ONE computer at the facility: the one that stays on while the clinic is open.
It holds the database and patient records. Staff computers install the "MedTriage" app instead.

Which file?
  Apple Silicon Macs (M1, M2, M3, M4 ...):  medtriage-server-macos-arm64.dmg
  Older Intel Macs:                          medtriage-server-macos-x64.dmg

Install
  1. Open the .dmg file and drag "MedTriage Server" onto the Applications folder.
  2. Open "MedTriage Server" from Applications or Launchpad.
     The first time, macOS may say it "could not be verified". Click "Done", then open
     System Settings > Privacy & Security, scroll down and click "Open Anyway".

Run
  - A Terminal window opens and shows the server's address, for example http://192.168.1.20:4000.
  - The first time, macOS asks whether it may accept incoming network connections. Choose
    "Allow", or staff computers won't be able to connect.
  - macOS may ask to let MedTriage Server "find devices on your local network".
    Choose "Allow", or it can't answer staff computers.
  - Keep the Terminal window open while the facility is using MedTriage. Closing it stops
    MedTriage for everyone.

Connecting
  - Staff computers: install the "MedTriage" app. It finds this server by itself. If it asks,
    type the address shown in the server window.
  - Tablets and phones: open the address in the browser, then "Add to Home Screen".
  - To use MedTriage on this same Mac, install the "MedTriage" app here too.

Demo accounts
  The server starts with demo data. Every demo account's password is demo123
  (doctor HW-DOC-001, nurse HW-NUR-002).

Your data
  The database and patient photos are stored in ~/Library/Application Support/MedTriage.
  Reinstalling or updating keeps them. Back this folder up regularly.

Update
  Open the new .dmg and drag "MedTriage Server" onto Applications again (choose "Replace").
