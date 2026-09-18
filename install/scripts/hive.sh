#!/usr/bin/env bash
set -euo pipefail

if ! command -v go &>/dev/null; then
  echo "Go not installed, skipping hive CLI."
else
  # Always call the Go CLI by absolute path, never bare `hive`. The Hive Desktop
  # installer owns ~/.local/bin/hive as a symlink to the app binary, and
  # ~/.local/bin precedes $GOPATH/bin on PATH — so `hive --version` boots the
  # whole desktop app in the foreground and takes the terminal with it.
  HIVE_CLI="$(go env GOPATH)/bin/hive"

  if [[ ! -x "$HIVE_CLI" ]]; then
    echo "Installing hive CLI..."
    go install github.com/colonyops/hive@latest
  else
    # Compare installed version against latest release. A local dev build may report a
    # pseudo-version newer than the latest tag — sort -V handles that and we skip.
    current=$("$HIVE_CLI" --version 2>/dev/null | awk '{print $3}')
    latest=$(gh api repos/colonyops/hive/releases/latest --jq .tag_name 2>/dev/null || true)

    if [[ -z "${latest:-}" ]]; then
      echo "Could not fetch latest hive CLI release, skipping update check."
    else
      older=$(printf '%s\n%s\n' "$current" "$latest" | sort -V | head -1)
      if [[ "$current" == "$latest" || "$older" != "$current" ]]; then
        echo "hive CLI $current is up to date (latest release: $latest)."
      else
        echo "Updating hive CLI $current → $latest..."
        go install github.com/colonyops/hive@latest
      fi
    fi
  fi
fi

echo "Installing/updating Hive Desktop..."
curl -fsSL https://hivedesktop.com/install.sh | bash
