#!/bin/sh
# Installs MedTriage for the current Linux user and adds an app-menu entry and a desktop icon.
# No root needed. Patient data lives separately in ~/.local/share/MedTriage and is kept on reinstall.
set -eu

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.local/opt/medtriage"
APPS="$HOME/.local/share/applications"

echo "Installing MedTriage to $TARGET"

# An update can't replace the program while it's running
pkill -x MedTriage 2>/dev/null && sleep 1 || true

mkdir -p "$TARGET" "$APPS"
cp -R "$SRC"/. "$TARGET"/
rm -f "$TARGET/install.sh"
chmod +x "$TARGET/MedTriage"

ENTRY="$APPS/medtriage.desktop"
cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=MedTriage
Comment=AI-assisted clinical triage
Exec="$TARGET/MedTriage"
Path=$TARGET
Icon=$TARGET/Assets/medtriage.png
Terminal=true
Categories=Medical;Office;
EOF
chmod +x "$ENTRY"
update-desktop-database "$APPS" >/dev/null 2>&1 || true

# Desktop icon (GNOME also needs it marked as trusted before it can be launched)
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESKTOP_DIR" ]; then
  cp "$ENTRY" "$DESKTOP_DIR/medtriage.desktop"
  chmod +x "$DESKTOP_DIR/medtriage.desktop"
  gio set "$DESKTOP_DIR/medtriage.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi

echo
echo "Done. Start MedTriage from your app menu or the desktop icon."
echo "For the app window, install Google Chrome or Chromium; otherwise it opens in your default browser."
