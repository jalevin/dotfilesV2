#!/bin/bash
set -e

# Install Xcode command line tools
xcode-select --install || true

# Install Homebrew
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Install stow (prerequisite for mise run stow)
if ! command -v stow &>/dev/null; then
  brew install stow
fi

# Install mise via the official installer (upgraded via `mise self-update`, not brew)
if ! command -v mise &>/dev/null; then
  curl -fsSL https://mise.run | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# Ignore global git config during apply: once stow links ~/.config/git/config,
# its https->ssh URL rewrites would break setup-time clones (TPM, lazy.nvim)
# because the 1Password SSH agent isn't configured yet.
GIT_CONFIG_GLOBAL=/dev/null mise run apply

echo ""
echo "Bootstrap complete. On a brand-new machine, also run:"
echo "  mise run first-run   # one-time steps (clear Dock, iCloud reminder)"
echo "Then follow SETUP.md for 1Password, secrets, and app setup."
