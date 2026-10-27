#!/bin/bash
set -e
source "$(dirname "${BASH_SOURCE[0]}")/secrets-common.sh"

secrets_signin

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

pull_file() {
  local name="$1"
  local local_path="$2"
  local tmp_path="$TMPDIR/$name"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 $name → $local_path"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if ! secrets_op document get "$name" > "$tmp_path" 2>/dev/null; then
    echo "⚠️  Document '$name' not found in 1Password. Skipping."
    return
  fi

  if [[ -f "$local_path" ]]; then
    if diff -q "$local_path" "$tmp_path" &>/dev/null; then
      echo "✓ Already in sync. No changes needed."
      return
    fi
    echo "Changes from 1Password:"
    diff --color=always "$local_path" "$tmp_path" || true
  else
    echo "New file (local doesn't exist):"
    head -20 "$tmp_path"
    [[ $(wc -l < "$tmp_path") -gt 20 ]] && echo "... (truncated)"
  fi

  echo ""
  read -r -p "Apply this change? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    if [[ "$local_path" == /etc/* ]]; then
      sudo cp "$tmp_path" "$local_path"
    else
      mkdir -p "$(dirname "$local_path")"
      cp "$tmp_path" "$local_path"
      chmod 600 "$local_path"
    fi
    echo "✓ Updated $local_path"
  else
    echo "⏭️  Skipped"
  fi
}

secrets_each_file pull_file

echo ""
echo "Done!"
