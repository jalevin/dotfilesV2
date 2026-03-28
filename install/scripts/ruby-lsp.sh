#!/usr/bin/env bash
set -euo pipefail

if ! command -v gem &>/dev/null; then
  echo "Ruby not installed, skipping ruby-lsp."
  exit 0
fi

echo "Installing ruby-lsp..."
gem install ruby-lsp
