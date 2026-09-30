#!/usr/bin/env bash
set -euo pipefail

# Hive Desktop — https://hivedesktop.com
#
# The hive *CLI* is not installed here: it is `"github:colonyops/hive"` in
# home/.config/mise/config.toml's [tools], pinned to a published release asset.
# Do not move it back to `go install ...@latest` — that resolves to a local
# pseudo-version and silently stops tracking upstream releases.
#
# Only the desktop app is installed here — it ships its own installer and is not
# a single binary, so mise can't manage it.

echo "Installing/updating Hive Desktop..."
curl -fsSL https://hivedesktop.com/install.sh | bash
