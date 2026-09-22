#!/usr/bin/env bash
set -euo pipefail

# Hive Desktop — https://hivedesktop.com
#
# The hive *CLI* is no longer installed here: it's `"github:colonyops/hive"` in
# mise.toml's [tools], which pulls the published release asset. It used to be
# `go install github.com/colonyops/hive@latest` plus ~25 lines of version
# comparison, which had quietly resolved to a local pseudo-version
# (v0.37.3-0.2026...) and sat 22 minor releases behind for six months.
#
# Only the desktop app is installed here — it ships its own installer and is not
# a single binary, so mise can't manage it.

echo "Installing/updating Hive Desktop..."
curl -fsSL https://hivedesktop.com/install.sh | bash
