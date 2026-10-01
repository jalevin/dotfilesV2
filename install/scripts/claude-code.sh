#!/usr/bin/env bash
set -euo pipefail

# Claude Code must not be managed by Homebrew (claude-desktop is fine via brew, not claude-code)
for pkg in claude claude-code; do
  if brew list --formula "$pkg" &>/dev/null; then
    echo "Removing $pkg from Homebrew (Claude Code should be installed via official installer)..."
    brew uninstall "$pkg"
  fi
done

# Install only. Claude Code updates itself in place, so re-running the installer
# on every converge just repeated the auto-updater's work.
if "$HOME/.local/bin/claude" --version &>/dev/null; then
  echo "Claude Code $("$HOME/.local/bin/claude" --version | cut -d' ' -f1) installed; it updates itself, skipping."
  exit 0
fi

echo "Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | bash
