#!/bin/bash
set -e

# Temporarily disable SSH URL rewriting (1Password SSH agent not set up yet)
git config --global --unset-all url."git@github.com:".insteadOf 2>/dev/null || true
git config --global --unset-all url."git@gitlab.com:".insteadOf 2>/dev/null || true

# Install Xcode command line tools
xcode-select --install || true

# Install Homebrew
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Install mise and stow (prerequisites for mise run apply)
if ! command -v mise &>/dev/null || ! command -v stow &>/dev/null; then
  brew install mise stow
fi

mise run apply

# Clear default Dock apps (only on fresh install)
echo "Clearing Dock - add your preferred apps manually"
defaults write com.apple.dock persistent-apps -array
killall Dock

# Prompt for manual iCloud setup
echo ""
echo "========================================="
echo " Manual Step: Enable iCloud Desktop & Documents"
echo "========================================="
echo "System Settings > Apple ID > iCloud > iCloud Drive > Options"
echo "  → Enable 'Desktop & Documents Folders'"
echo ""
read -p "Press Enter once complete (or 's' to skip): " -n 1 response
echo ""
if [[ "$response" == "s" ]]; then
  echo "Skipped — remember to enable this later."
fi
