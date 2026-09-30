#!/bin/bash
set -euo pipefail

# Fresh-machine bootstrap.
#
# Only the three prerequisites below are imperative. Everything else is declared
# in mise.toml and applied by `mise bootstrap`, in this order:
#
#   [bootstrap.packages]      formulae and casks — mise pours Homebrew bottles
#                             into /opt/homebrew itself; Homebrew is NOT needed
#   [bootstrap.directories]   directories we own
#   [dotfiles]                config symlinks
#   [bootstrap.macos.defaults] system defaults, with pre/post-defaults hooks
#   [tools]                   pinned CLIs (from ~/.config/mise, once linked)
#   [tasks.bootstrap]         the imperative remainder — fonts, neovim, tmux,
#                             go-link, install scripts, macOS sudo/PlistBuddy work
#
# Safe to re-run: every declarative step converges, and the bootstrap task is
# idempotent. Re-converge later with `mise run apply`, or `mise run sync` to
# pull the latest config first.

usage() {
  echo "usage: ./bootstrap.sh <grafana|personal>" >&2
  echo "" >&2
  echo "  The environment selects this machine's overlay: which hive config" >&2
  echo "  deploys and which work-only tools install." >&2
  exit 1
}

MACHINE_ENV="${1:-}"
case "$MACHINE_ENV" in
  grafana | personal) ;;
  *) usage ;;
esac

# ── 1. Xcode command line tools ─────────────────────────────────────────────
xcode-select --install 2>/dev/null || true

# ── 2. Homebrew prefix ──────────────────────────────────────────────────────
# mise pours Homebrew bottles into /opt/homebrew itself and needs no Homebrew,
# but it cannot create that directory without root — and its own sudo path
# requires a TTY, so it fails in a non-interactive run and just prints a command
# to run by hand. Doing it here keeps the privileged step in this script, where
# a password prompt is expected anyway.
#
# A bare, USER-OWNED directory is all mise needs: it creates Cellar/, Caskroom/,
# bin/, opt/ and the rest unaided (verified 2026-09-20). Ownership is the part
# that matters — root-owned directories make mise keep re-requesting sudo, and
# its printed fallback command only does the mkdir, not the chown.
#
# The -w test covers all three cases: missing, present-but-root-owned, and
# already correct.
if [ ! -w /opt/homebrew ]; then
  sudo mkdir -p /opt/homebrew
  sudo chown "$(id -un):admin" /opt/homebrew
fi

# ── 3. mise — via its own installer, upgraded with `mise self-update` ───────
# Deliberately not Homebrew: mise manages the tools, so it should not be
# downgraded or moved by a `brew upgrade`.
if ! command -v mise &>/dev/null; then
  curl -fsSL https://mise.run | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# A clean checkout is untrusted, and every mise command below reads this config.
mise trust

# Pin this machine's overlay BEFORE converging. Without
# ~/.config/mise/miserc.toml the mise.<env>.toml overlay never loads, so the
# per-machine hive config and the work-only tools are silently skipped.
MISE_ENV="$MACHINE_ENV" mise run stamp

# Ignore global git config for the converge: once ~/.config/git/config is linked,
# its https->ssh URL rewrites break setup-time clones (brew taps, TPM, lazy.nvim)
# because the 1Password SSH agent is not configured yet.
GIT_CONFIG_GLOBAL=/dev/null mise bootstrap --yes

cat <<'EOF'

Bootstrap complete. On a brand-new machine, also run:
  mise run first-run   # one-time steps (clear Dock, iCloud reminder)

Then follow SETUP.md for 1Password, secrets, and app setup.

Later:
  mise run apply       # re-converge this machine
  mise run sync        # pull the latest config, then converge
  mise run check       # read-only drift report
EOF
