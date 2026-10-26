MedTriage Server - Linux
========================

Install this on ONE computer at the facility: the one that stays on while the clinic is open.
It holds the database and patient records. Staff computers install the "MedTriage" app instead.

Install
  1. Extract this folder anywhere.
  2. In a terminal, inside the folder, run:   ./install.sh
  3. "MedTriage Server" appears in your app menu and as a desktop icon.
     On some desktops you must right-click the desktop icon once and choose "Allow Launching".

Run
  - Click "MedTriage Server". A terminal window opens and shows the server's address,
    for example http://192.168.1.20:4000.
  - If a firewall is enabled (e.g. ufw), allow the app and discovery ports:
        sudo ufw allow 4000/tcp
        sudo ufw allow 4001/udp
  - Keep the window open while the facility is using MedTriage. Closing it stops MedTriage
    for everyone.

Connecting
  - Staff computers: install the "MedTriage" app. It finds this server by itself. If it asks,
    type the address shown in the server window.
  - Tablets and phones: open the address in the browser, then "Add to Home Screen".

Random Forest model (optional)
  MedTriage Server uses its built-in safety rules if the local Random Forest service is not
  running. The Python service and trained model artifact are not bundled in this installer.
  To run the model, install Python 3.9+, copy the server Python files and a trained
  artifacts/triage_random_forest.joblib to the server computer, install requirements-ml.txt,
  then run `python model_service.py`. The service listens on localhost port 8001.

Demo accounts
  The server starts with demo data. Every demo account's password is demo123
  (doctor HW-DOC-001, nurse HW-NUR-002).

Your data
  The database and patient photos are stored in ~/.local/share/MedTriage.
  Reinstalling or updating keeps them. Back this folder up regularly.

Update
  Extract the new version and run ./install.sh again.
