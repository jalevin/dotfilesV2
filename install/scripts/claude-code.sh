#!/usr/bin/env bash
set -euo pipefail

# Claude Code must not be managed by Homebrew (claude-desktop is fine via brew, not claude-code)
for pkg in claude claude-code; do
  if brew list --formula "$pkg" &>/dev/null; then
    echo "Removing $pkg from Homebrew (Claude Code should be installed via official installer)..."
    brew uninstall "$pkg"
  fi
done

if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash
else
  echo "Claude Code already installed, skipping."
fi
