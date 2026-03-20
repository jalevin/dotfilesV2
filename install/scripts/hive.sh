#!/usr/bin/env bash
set -euo pipefail

if ! command -v go &>/dev/null; then
  echo "Go not installed, skipping hive."
  exit 0
fi

echo "Installing hive..."
go install github.com/colonyops/hive@latest
