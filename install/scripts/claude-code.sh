#!/usr/bin/env bash
set -euo pipefail

# Claude Code must not be managed by Homebrew (claude-desktop is fine via brew, not claude-code)
for pkg in claude claude-code; do
  if brew list --formula "$pkg" &>/dev/null; then
    echo "Removing $pkg from Homebrew (Claude Code should be installed via official installer)..."
    brew uninstall "$pkg"
  fi
done

echo "Installing/updating Claude Code..."
curl -fsSL https://claude.ai/install.sh | bash
