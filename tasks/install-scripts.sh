#!/usr/bin/env bash
set -euo pipefail

for script in install/scripts/*.sh; do
  echo ""
  echo "━━━ Running $(basename "$script") ━━━"
  bash "$script"
done
