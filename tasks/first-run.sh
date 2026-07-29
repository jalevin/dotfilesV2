#!/bin/bash
set -e

# One-time fresh-machine steps. Not part of bootstrap.sh so that
# bootstrap stays idempotent and safe to re-run on a configured machine.

# Clear default Dock apps
echo "Clearing Dock - add your preferred apps manually"
defaults write com.apple.dock persistent-apps -array
killall Dock

# Manual follow-ups (see SETUP.md for the full checklist)
echo ""
echo "========================================="
echo " Manual Step: Enable iCloud Desktop & Documents"
echo "========================================="
echo "System Settings > Apple ID > iCloud > iCloud Drive > Options"
echo "  → Enable 'Desktop & Documents Folders'"
echo ""
