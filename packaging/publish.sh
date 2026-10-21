#!/usr/bin/env bash
# Builds the installable MedTriage packages into release/:
#   release/medtriage-windows-x64.zip     (unzip, double-click "Install MedTriage.cmd")
#   release/medtriage-linux-x64.tar.gz    (extract, run ./install.sh)
#   release/medtriage-macos-arm64.dmg     (Apple Silicon: open, drag MedTriage to Applications)
#   release/medtriage-macos-x64.dmg       (Intel Macs)
#
# Usage:  packaging/publish.sh                       # all of the above
#         packaging/publish.sh win-x64 osx-arm64     # just some
#
# Needs the .NET 10 SDK and Node.js on the build machine; the Mac packages must be built on a Mac.
# The facility computer needs neither: the packages are self-contained.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="$ROOT/release"
VERSION="$(node -p "require('$ROOT/package.json').version")"
TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(win-x64 linux-x64 osx-arm64 osx-x64)

echo "==> Building the frontend"
(cd "$ROOT" && { [ -d node_modules ] || npm ci; } && npm run build)

mkdir -p "$RELEASE"

# dotnet publish into $2 for runtime $1
publish() {
  rm -rf "${2:?}"
  dotnet publish "$ROOT/server/MedTriage.Server.csproj" \
    -c Release -r "$1" --self-contained true \
    -p:PublishSingleFile=true \
    -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:AssemblyName=MedTriage \
    -p:SkipFrontendBuild=true \
    -p:DebugType=none \
    -o "$2"
}

for rid in "${TARGETS[@]}"; do
  case "$rid" in
    win-x64)   name="medtriage-windows-x64" ;;
    linux-x64) name="medtriage-linux-x64" ;;
    osx-arm64) name="medtriage-macos-arm64" ;;
    osx-x64)   name="medtriage-macos-x64" ;;
    *) echo "Unknown target: $rid (use win-x64, linux-x64, osx-arm64 or osx-x64)" >&2; exit 1 ;;
  esac

  if [[ "$rid" == osx-* && "$(uname)" != "Darwin" ]]; then
    echo "==> Skipping $rid: Mac packages must be built on a Mac"
    continue
  fi

  out="$RELEASE/$name"
  rm -f "$RELEASE/$name.zip" "$RELEASE/$name.tar.gz" "$RELEASE/$name.dmg"
  echo "==> Publishing $rid"

  case "$rid" in
    win-x64)
      publish "$rid" "$out"
      cp -R "$ROOT/packaging/windows/." "$out/"
      (cd "$RELEASE" && zip -qr "$name.zip" "$name")
      ;;

    linux-x64)
      publish "$rid" "$out"
      cp -R "$ROOT/packaging/linux/." "$out/"
      chmod +x "$out/MedTriage" "$out/install.sh"
      (cd "$RELEASE" && tar -czf "$name.tar.gz" "$name")
      ;;

    osx-*)
      # MedTriage.app/Contents/{Info.plist, MacOS/MedTriage-launcher, Resources/{medtriage.icns, server/…}}
      rm -rf "${out:?}"
      app="$out/MedTriage.app/Contents"
      mkdir -p "$app/MacOS" "$app/Resources"
      publish "$rid" "$app/Resources/server"
      sed "s/__VERSION__/$VERSION/g" "$ROOT/packaging/macos/Info.plist" > "$app/Info.plist"
      cp "$ROOT/packaging/macos/MedTriage-launcher" "$app/MacOS/"
      chmod +x "$app/MacOS/MedTriage-launcher" "$app/Resources/server/MedTriage"
      cp "$ROOT/server/Assets/medtriage.icns" "$app/Resources/"
      plutil -lint "$app/Info.plist" >/dev/null

      # Ad-hoc signature: not a substitute for a Developer ID, but keeps the bundle consistent
      codesign --force --deep --sign - "$out/MedTriage.app"

      # Disk image with the app, a shortcut to Applications to drag onto, and the instructions
      cp "$ROOT/packaging/macos/README.txt" "$out/"
      ln -s /Applications "$out/Applications"
      # hdiutil sometimes fails with "Resource busy" while macOS indexes new files; retry a few times
      for attempt in 1 2 3 4; do
        hdiutil create -volname "MedTriage" -srcfolder "$out" -ov -format UDZO "$RELEASE/$name.dmg" && break
        [ "$attempt" -eq 4 ] && { echo "hdiutil could not create $name.dmg" >&2; exit 1; }
        echo "    hdiutil failed, retrying in 5s…"
        sleep 5
      done
      ;;
  esac
done

echo "==> Done:"
ls -lh "$RELEASE"/*.zip "$RELEASE"/*.tar.gz "$RELEASE"/*.dmg 2>/dev/null || true
