MedTriage - Linux
=================

The MedTriage app for staff computers. It connects to your facility's MedTriage Server over
the Wi-Fi or network; it doesn't store any patient data itself.

Install
  1. Extract this folder anywhere.
  2. In a terminal, inside the folder, run:   ./install.sh
  3. "MedTriage" appears in your app menu and as a desktop icon.
     On some desktops you must right-click the desktop icon once and choose "Allow Launching".

Use
  - Click "MedTriage". It finds the facility's server and opens MedTriage in its own window.
  - If it can't find the server, it shows a "Connect" screen. Check that this computer is on the
    facility network, or type the address shown on the server computer (e.g. 192.168.1.20).
  - It remembers the server, so next time it opens straight away.
  - For the app-style window, install Google Chrome or Chromium; otherwise it opens in your
    default browser.
