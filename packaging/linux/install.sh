#!/bin/sh
# Installs __APP_NAME__ for the current Linux user and adds an app-menu entry and a desktop icon. No root needed.
# (Template: packaging/publish.sh fills in the placeholders.)
set -eu

APP_NAME="__APP_NAME__"
EXE="__EXE__"
SLUG="__SLUG__"

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.local/opt/$SLUG"
APPS="$HOME/.local/share/applications"

echo "Installing $APP_NAME to $TARGET"

# An update can't replace the program while it's running
pkill -x "$EXE" 2>/dev/null && sleep 1 || true

mkdir -p "$TARGET" "$APPS"
cp -R "$SRC"/. "$TARGET"/
rm -f "$TARGET/install.sh"
chmod +x "$TARGET/$EXE"

ENTRY="$APPS/$SLUG.desktop"
cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=__COMMENT__
Exec="$TARGET/$EXE"
Path=$TARGET
Icon=$TARGET/Assets/medtriage.png
Terminal=__TERMINAL__
Categories=Medical;Office;
EOF
chmod +x "$ENTRY"
update-desktop-database "$APPS" >/dev/null 2>&1 || true

# Desktop icon (GNOME also needs it marked as trusted before it can be launched)
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESKTOP_DIR" ]; then
  cp "$ENTRY" "$DESKTOP_DIR/$SLUG.desktop"
  chmod +x "$DESKTOP_DIR/$SLUG.desktop"
  gio set "$DESKTOP_DIR/$SLUG.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi

echo
echo "Done. Start $APP_NAME from your app menu or the desktop icon."
