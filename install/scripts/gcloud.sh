#!/usr/bin/env bash
set -euo pipefail

# Google Cloud SDK — https://cloud.google.com/sdk
# Installs to ~/.local/share/google-cloud-sdk (PATH/completions sourced in .zshrc)

SDK_DIR="$HOME/.local/share/google-cloud-sdk"
ARCHIVE="google-cloud-cli-darwin-arm.tar.gz"
URL="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/$ARCHIVE"

if [[ -d "$SDK_DIR" ]]; then
  echo "Google Cloud SDK already installed at $SDK_DIR"
  echo "Run 'gcloud components update' to update."
  exit 0
fi

echo "Installing Google Cloud SDK to $SDK_DIR..."

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

curl -fsSL "$URL" -o "$TMPDIR/$ARCHIVE"
tar -xzf "$TMPDIR/$ARCHIVE" -C "$TMPDIR"

if [[ ! -d "$TMPDIR/google-cloud-sdk" ]]; then
  echo "Error: google-cloud-sdk not found in archive"
  exit 1
fi

mkdir -p "$HOME/.local/share"
mv "$TMPDIR/google-cloud-sdk" "$SDK_DIR"

# Run the install script (sets up PATH helpers, no prompts)
"$SDK_DIR/install.sh" --quiet --path-update=false --command-completion=false

# Clean up old installs
for old in "$HOME/google-cloud-sdk" "$HOME/Downloads/google-cloud-sdk"; do
  if [[ -d "$old" ]]; then
    echo "Removing old SDK at $old"
    rm -rf "$old"
  fi
done

# Disable usage reporting
"$SDK_DIR/bin/gcloud" config set disable_usage_reporting true

echo "Google Cloud SDK installed to $SDK_DIR"
echo "Run 'gcloud init' to configure."
