#!/usr/bin/env bash
set -euo pipefail

# Ice menu bar manager — install pre-release from GitHub for macOS Tahoe support
# Homebrew cask only tracks stable releases, so we pull from GitHub directly.

REPO="jordanbaird/Ice"
TAG="0.11.13-dev.2"
APP_NAME="Ice.app"
INSTALL_DIR="/Applications"

current_version=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$INSTALL_DIR/$APP_NAME/Contents/Info.plist" 2>/dev/null || echo "none")

# Check for newer releases
latest_tag=$(gh release list --repo "$REPO" --limit 1 --json tagName --jq '.[0].tagName')
if [[ "$latest_tag" != "$TAG" ]]; then
  read -r -p "Newer Ice release available: $TAG → $latest_tag. Update pinned version and install? [y/N] " choice
  if [[ "$choice" =~ ^[Yy]$ ]]; then
    sed -i '' "s/^TAG=\".*\"/TAG=\"$latest_tag\"/" "$0"
    TAG="$latest_tag"
  fi
fi

if [[ "$current_version" == *"${TAG#v}"* ]]; then
  echo "Ice $current_version already installed, skipping."
  exit 0
fi

echo "Installing Ice $TAG (current: $current_version)..."

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

gh release download "$TAG" --repo "$REPO" --pattern "Ice.zip" --dir "$TMPDIR"
unzip -q "$TMPDIR/Ice.zip" -d "$TMPDIR"

if [[ ! -d "$TMPDIR/$APP_NAME" ]]; then
  echo "Error: $APP_NAME not found in downloaded archive"
  exit 1
fi

# Quit Ice if running
osascript -e 'tell application "Ice" to quit' 2>/dev/null || true
sleep 1

# Remove Homebrew-managed version if present
if [[ -d "/opt/homebrew/Caskroom/jordanbaird-ice" ]]; then
  echo "Removing Homebrew-managed Ice..."
  brew uninstall --cask jordanbaird-ice 2>/dev/null || true
fi

cp -R "$TMPDIR/$APP_NAME" "$INSTALL_DIR/"
echo "Ice $TAG installed to $INSTALL_DIR/$APP_NAME"

# Disable Sparkle auto-update (we manage updates via this script)
defaults write com.jordanbaird.Ice SUEnableAutomaticChecks -bool false
defaults write com.jordanbaird.Ice SUAutomaticallyUpdate -bool false
