#!/usr/bin/env bash
set -euo pipefail

if ! command -v go &>/dev/null; then
  echo "Go not installed, skipping hive CLI."
elif ! command -v hive &>/dev/null; then
  echo "Installing hive CLI..."
  go install github.com/colonyops/hive@latest
else
  # Compare installed version against latest release. A local dev build may report a
  # pseudo-version newer than the latest tag — sort -V handles that and we skip.
  current=$(hive --version 2>/dev/null | awk '{print $3}')
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

echo "Installing/updating Hive Desktop..."
curl -fsSL https://hivedesktop.com/install.sh | bash
