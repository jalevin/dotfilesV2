#!/bin/bash
set -e

PLUGIN_PATH="$HOME/.config/tmux/plugins"
TPM_DIR="$PLUGIN_PATH/tpm"

if [[ ! -d "$TPM_DIR" ]]; then
  echo "Installing TPM..."
  git clone https://github.com/tmux-plugins/tpm "$TPM_DIR"
else
  echo "TPM already installed."
fi

# Set the plugin path in tmux's global environment so TPM can find it
tmux start-server \; set-environment -g TMUX_PLUGIN_MANAGER_PATH "$PLUGIN_PATH/"

echo "Installing tmux plugins..."
"$TPM_DIR/bin/install_plugins"
