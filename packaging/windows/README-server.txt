MedTriage Server - Windows
==========================

Install this on ONE computer at the facility: the one that stays on while the clinic is open.
It holds the database and patient records. Staff computers install the "MedTriage" app instead.

Install
  1. Unzip this folder anywhere (for example, your Downloads folder).
  2. Double-click "Install MedTriage Server.cmd".
     If Windows says "Windows protected your PC", click "More info", then "Run anyway".
  3. A "MedTriage Server" icon appears on the Desktop and in the Start menu.

Run
  - Double-click "MedTriage Server". A black window opens and shows the server's address,
    for example http://192.168.1.20:4000.
  - The first time, Windows Firewall asks about network access. Choose "Allow" on private
    networks, or staff computers won't be able to connect.
  - Keep the window open while the facility is using MedTriage. Closing it stops MedTriage
    for everyone.

Connecting
  - Staff computers: install the "MedTriage" app. It finds this server by itself. If it asks,
    type the address shown in the server window.
  - Tablets and phones: open the address in the browser, then "Add to Home Screen".
  - To use MedTriage on this same computer, install the "MedTriage" app here too.

Demo accounts
  The server starts with demo data. Every demo account's password is demo123
  (doctor HW-DOC-001, nurse HW-NUR-002).

Your data
  The database and patient photos are stored in %LOCALAPPDATA%\MedTriage.
  Reinstalling or updating keeps them. Back this folder up regularly.

Update
  Unzip the new version and run "Install MedTriage Server.cmd" again.
