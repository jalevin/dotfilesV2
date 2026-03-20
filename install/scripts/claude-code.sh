#!/usr/bin/env bash
set -euo pipefail

if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash
else
  echo "Claude Code already installed, skipping."
fi
