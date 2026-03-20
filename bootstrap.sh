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

# Install mise and stow (prerequisites for mise run setup)
if ! command -v mise &>/dev/null || ! command -v stow &>/dev/null; then
  brew install mise stow
fi

mise run setup

# Clear default Dock apps (only on fresh install)
echo "Clearing Dock - add your preferred apps manually"
defaults write com.apple.dock persistent-apps -array
killall Dock
