#!/usr/bin/env bash
set -euo pipefail

if command -v pi >/dev/null 2>&1 && pi --version >/dev/null 2>&1; then
  echo "Pi $(pi --version) installed; run 'pi update' to upgrade, skipping."
  exit 0
fi

echo "Installing Pi..."
installer=$(mktemp)
trap 'rm -f "$installer"' EXIT
curl -fsSL https://pi.dev/install.sh -o "$installer"

# The upstream installer prompts through /dev/tty; detach for unattended bootstrap.
# Node is already provided by the global mise config.
node - "$installer" <<'JS'
const { spawnSync } = require('node:child_process');
const result = spawnSync('sh', [process.argv[2]], { detached: true, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
JS
