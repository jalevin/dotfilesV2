#!/usr/bin/env bash
set -euo pipefail

# Plannotator — https://plannotator.ai
# --non-interactive is required here: the installer's optional "extras" step
# launches the skills CLI TUI reading from /dev/tty, which hangs forever (and
# fights the calling shell for the terminal) inside this unattended task loop.
# The core install and the /plannotator-* skills still happen. To add the
# extras later, run interactively:
#   npx skills add backnotprop/plannotator/apps/skills/extra --global

echo "Installing/updating plannotator..."
curl -fsSL https://plannotator.ai/install.sh | bash -s -- --non-interactive </dev/null
