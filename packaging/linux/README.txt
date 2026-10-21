MedTriage AI - Linux
====================

Install
  1. Extract this folder anywhere.
  2. In a terminal, inside the folder, run:   ./install.sh
  3. MedTriage appears in your app menu and as a desktop icon.
     On some desktops you must right-click the desktop icon once and choose "Allow Launching".

Use
  - Click the MedTriage icon. A terminal window opens (that's the server) and then the
    MedTriage app window.
  - Keep the terminal window open while the facility is using MedTriage. Closing it stops
    MedTriage for everyone, including tablets.
  - The terminal shows the address for tablets and phones, for example http://192.168.1.20:4000.
    Open that address in the tablet's browser, then use "Add to Home Screen" to get an icon there too.
  - For the app-style window, install Google Chrome or Chromium. Without them MedTriage opens in
    your default browser instead.
  - If a firewall is enabled (e.g. ufw), allow port 4000:   sudo ufw allow 4000/tcp

Your data
  The database and patient photos are stored in ~/.local/share/MedTriage.
  Reinstalling or updating MedTriage keeps them. Back this folder up regularly.

Update
  Extract the new version and run ./install.sh again.
