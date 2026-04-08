#!/usr/bin/env bash
set -euo pipefail

# Google Workspace CLI — https://github.com/googleworkspace/cli
# Installs the gws binary to ~/.local/bin

REPO="googleworkspace/cli"
TAG="v0.22.5"
BINARY="gws"
INSTALL_DIR="$HOME/.local/bin"
ASSET="google-workspace-cli-aarch64-apple-darwin.tar.gz"

current_version=$("$INSTALL_DIR/$BINARY" --version 2>/dev/null || echo "none")

# Check for newer releases
latest_tag=$(gh release list --repo "$REPO" --limit 1 --json tagName --jq '.[0].tagName')
if [[ "$latest_tag" != "$TAG" ]]; then
  read -r -p "Newer gw release available: $TAG → $latest_tag. Update pinned version and install? [y/N] " choice
  if [[ "$choice" =~ ^[Yy]$ ]]; then
    sed -i '' "s/^TAG=\".*\"/TAG=\"$latest_tag\"/" "$0"
    TAG="$latest_tag"
  fi
fi

if [[ "$current_version" == *"${TAG#v}"* ]]; then
  echo "gw $current_version already installed, skipping."
  exit 0
fi

echo "Installing gw $TAG (current: $current_version)..."

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

gh release download "$TAG" --repo "$REPO" --pattern "$ASSET" --dir "$TMPDIR"
tar -xzf "$TMPDIR/$ASSET" -C "$TMPDIR"

if [[ ! -f "$TMPDIR/$BINARY" ]]; then
  echo "Error: $BINARY not found in downloaded archive"
  exit 1
fi

chmod +x "$TMPDIR/$BINARY"
cp "$TMPDIR/$BINARY" "$INSTALL_DIR/$BINARY"
echo "gw $TAG installed to $INSTALL_DIR/$BINARY"
