#!/usr/bin/env bash
set -euo pipefail

# Jump Desktop — copied from bundles kept in iCloud Drive, not installed. Those
# copies are App Store builds at versions chosen on purpose; the App Store would
# hand out the current release instead, and the jump-desktop cask is the
# separately licensed direct-download edition.
#
# iCloud may hold several (named e.g. "Jump Desktop 9.1.21.app"). The newest by
# its own CFBundleShortVersionString wins — bundle names are hand-typed and have
# disagreed with the version inside. It always lands as "Jump Desktop.app".

SRC_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/jump"
DEST="/Applications/Jump Desktop.app"

version() {
  /usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$1/Contents/Info.plist" 2>/dev/null || echo "none"
}

newest="" newest_version=""
for app in "$SRC_DIR"/*.app; do
  [[ -d "$app" ]] || continue
  v=$(version "$app")
  [[ "$v" == "none" ]] && continue
  if [[ -z "$newest" || "$(printf '%s\n%s\n' "$newest_version" "$v" | sort -V | tail -1)" == "$v" && "$v" != "$newest_version" ]]; then
    newest="$app" newest_version="$v"
  fi
done

if [[ -z "$newest" ]]; then
  echo "Jump Desktop: no app bundle in $SRC_DIR; wait for iCloud to sync, then: mise run install-scripts" >&2
  exit 1
fi

installed=$(version "$DEST")
if [[ "$installed" != "none" ]] && [[ "$(printf '%s\n%s\n' "$newest_version" "$installed" | sort -V | tail -1)" == "$installed" ]]; then
  echo "Jump Desktop $installed already installed, skipping (newest in iCloud: $newest_version)."
  exit 0
fi

if pgrep -qf "$DEST/Contents/MacOS/"; then
  echo "Jump Desktop $installed is running; quit it to update to $newest_version, then: mise run install-scripts" >&2
  exit 0
fi

# Stage next to the destination and swap, so a failed copy never leaves a
# half-written app. ditto, not cp: it keeps the code signature, extended
# attributes and the App Store receipt. Reading from iCloud also downloads any
# evicted files.
stage="/Applications/.Jump Desktop.app.staging"
rm -rf "$stage"
ditto "$newest" "$stage"
if ! codesign --verify --deep "$stage" 2>/dev/null; then
  rm -rf "$stage"
  echo "Jump Desktop: $(basename "$newest") failed signature verification (incomplete iCloud download?); not installing." >&2
  exit 1
fi
rm -rf "$DEST"
mv "$stage" "$DEST"
echo "Installed Jump Desktop $newest_version from $(basename "$newest") (was: $installed)."
