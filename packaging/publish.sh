#!/usr/bin/env bash
# Builds the installable MedTriage packages into release/. There are two apps:
#
#   MedTriage Server  for the ONE facility computer (database, API, triage engine, the web screens)
#     release/medtriage-server-windows-x64.zip    release/medtriage-server-linux-x64.tar.gz
#     release/medtriage-server-macos-arm64.dmg    release/medtriage-server-macos-x64.dmg
#
#   MedTriage         for every staff computer (finds the server on the network, opens it in an app window)
#     release/medtriage-windows-x64.zip           release/medtriage-linux-x64.tar.gz
#     release/medtriage-macos-arm64.dmg           release/medtriage-macos-x64.dmg
#
# Usage:  packaging/publish.sh                          # everything
#         packaging/publish.sh server                   # just the server, every platform
#         packaging/publish.sh client osx-arm64         # just the Apple Silicon client
#
# Needs the .NET 10 SDK and Node.js on the build machine; Mac packages must be built on a Mac.
# The computers they're installed on need neither: the packages are self-contained.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/packaging"
RELEASE="$ROOT/release"
VERSION="$(node -p "require('$ROOT/package.json').version")"

APPS=()
RIDS=()
for arg in "$@"; do
  case "$arg" in
    server | client) APPS+=("$arg") ;;
    win-x64 | linux-x64 | osx-arm64 | osx-x64) RIDS+=("$arg") ;;
    *) echo "Unknown argument: $arg (use server, client, win-x64, linux-x64, osx-arm64, osx-x64)" >&2; exit 1 ;;
  esac
done
[ ${#APPS[@]} -eq 0 ] && APPS=(server client)
[ ${#RIDS[@]} -eq 0 ] && RIDS=(win-x64 linux-x64 osx-arm64 osx-x64)

if [[ " ${APPS[*]} " == *" server "* ]]; then
  echo "==> Building the frontend (served by MedTriage Server)"
  (cd "$ROOT" && { [ -d node_modules ] || npm ci; } && npm run build)
fi

mkdir -p "$RELEASE"

# Per-app settings used to fill in the installer templates
configure_app() {
  case "$1" in
    server)
      APP_NAME="MedTriage Server"; EXE="MedTriageServer"; SLUG="medtriage-server"
      PROJECT="$ROOT/server/MedTriage.Server.csproj"; EXTRA_ARGS=(-p:AssemblyName=MedTriageServer -p:SkipFrontendBuild=true)
      TERMINAL="true"; UI_ELEMENT="<false/>"; BUNDLE_ID="org.medtriage.server"
      COMMENT="MedTriage facility server"
      AFTER_INSTALL="Write-Host 'The first time it starts, Windows Firewall asks about network access: choose \"Allow\" on private networks so staff computers can connect.'"
      ;;
    client)
      APP_NAME="MedTriage"; EXE="MedTriage"; SLUG="medtriage"
      PROJECT="$ROOT/client/MedTriage.Client.csproj"; EXTRA_ARGS=()
      TERMINAL="false"; UI_ELEMENT="<true/>"; BUNDLE_ID="org.medtriage.app"
      COMMENT="AI-assisted clinical triage"
      AFTER_INSTALL=""
      ;;
  esac
}

# Copy a template, filling in the __PLACEHOLDERS__
render() {
  local src="$1" dst="$2"
  sed -e "s|__APP_NAME__|$APP_NAME|g" -e "s|__EXE__|$EXE|g" -e "s|__SLUG__|$SLUG|g" \
      -e "s|__TERMINAL__|$TERMINAL|g" -e "s|__UI_ELEMENT__|$UI_ELEMENT|g" -e "s|__BUNDLE_ID__|$BUNDLE_ID|g" \
      -e "s|__VERSION__|$VERSION|g" -e "s|__COMMENT__|$COMMENT|g" -e "s|__AFTER_INSTALL__|$AFTER_INSTALL|g" \
      "$src" > "$dst"
}

publish() { # <rid> <output folder>
  rm -rf "${2:?}"
  dotnet publish "$PROJECT" \
    -c Release -r "$1" --self-contained true \
    -p:PublishSingleFile=true \
    -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:DebugType=none \
    "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}" \
    -o "$2"
}

for rid in "${RIDS[@]}"; do
  if [[ "$rid" == osx-* && "$(uname)" != "Darwin" ]]; then
    echo "==> Skipping $rid: Mac packages must be built on a Mac"
    continue
  fi

  for app in "${APPS[@]}"; do
    configure_app "$app"
    case "$rid" in
      win-x64) platform="windows-x64" ;;
      linux-x64) platform="linux-x64" ;;
      osx-arm64) platform="macos-arm64" ;;
      osx-x64) platform="macos-x64" ;;
    esac
    name="$SLUG-$platform"
    out="$RELEASE/$name"
    rm -rf "${out:?}" "$RELEASE/$name.zip" "$RELEASE/$name.tar.gz" "$RELEASE/$name.dmg"
    echo "==> $APP_NAME for $platform"

    case "$rid" in
      win-x64)
        publish "$rid" "$out"
        mkdir -p "$out/Assets" && cp "$PKG/assets/medtriage.ico" "$out/Assets/"
        render "$PKG/windows/install.ps1" "$out/install.ps1"
        cp "$PKG/windows/install.cmd" "$out/Install $APP_NAME.cmd"
        cp "$PKG/windows/README-$app.txt" "$out/README.txt"
        # Windows tools expect CRLF line endings
        perl -pi -e 's/\r?\n/\r\n/' "$out/install.ps1" "$out/Install $APP_NAME.cmd" "$out/README.txt"
        (cd "$RELEASE" && zip -qr "$name.zip" "$name")
        ;;

      linux-x64)
        publish "$rid" "$out"
        mkdir -p "$out/Assets" && cp "$PKG/assets/medtriage.png" "$out/Assets/"
        render "$PKG/linux/install.sh" "$out/install.sh"
        cp "$PKG/linux/README-$app.txt" "$out/README.txt"
        chmod +x "$out/$EXE" "$out/install.sh"
        (cd "$RELEASE" && tar -czf "$name.tar.gz" "$name")
        ;;

      osx-*)
        # <App>.app/Contents/{Info.plist, MacOS/launcher, Resources/{medtriage.icns, app/<published files>}}
        contents="$out/$APP_NAME.app/Contents"
        mkdir -p "$contents/MacOS" "$contents/Resources"
        publish "$rid" "$contents/Resources/app"
        render "$PKG/macos/Info.plist" "$contents/Info.plist"
        plutil -lint "$contents/Info.plist" >/dev/null
        cp "$PKG/macos/launcher-$app" "$contents/MacOS/launcher"
        cp "$PKG/assets/medtriage.icns" "$contents/Resources/"
        chmod +x "$contents/MacOS/launcher" "$contents/Resources/app/$EXE"

        # Ad-hoc signature: not a substitute for a Developer ID, but keeps the bundle consistent
        codesign --force --deep --sign - "$out/$APP_NAME.app"

        # Disk image: the app, a shortcut to Applications to drag it onto, and the instructions
        cp "$PKG/macos/README-$app.txt" "$out/README.txt"
        ln -s /Applications "$out/Applications"
        # hdiutil's own size estimate is sometimes too small ("No space left on device"), so give it room;
        # it also sometimes fails with "Resource busy" while macOS indexes new files, so retry a few times
        size_mb=$(( $(du -sm "$out" | cut -f1) * 3 / 2 + 20 ))
        for attempt in 1 2 3 4; do
          hdiutil create -volname "$APP_NAME" -srcfolder "$out" -size "${size_mb}m" -ov -format UDZO "$RELEASE/$name.dmg" && break
          [ "$attempt" -eq 4 ] && { echo "hdiutil could not create $name.dmg" >&2; exit 1; }
          echo "    hdiutil failed, retrying in 5s…"
          sleep 5
        done
        ;;
    esac
  done
done

echo "==> Done:"
ls -lh "$RELEASE"/*.zip "$RELEASE"/*.tar.gz "$RELEASE"/*.dmg 2>/dev/null || true
