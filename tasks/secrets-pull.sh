#!/bin/bash
set -e

if ! op account list &>/dev/null; then
  echo "Sign in to 1Password first: eval \$(op signin)"
  exit 1
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

pull_file() {
  local name="$1"
  local local_path="$2"
  local tmp_path="$TMPDIR/$name"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 $name → $local_path"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if ! op document get "$name" > "$tmp_path" 2>/dev/null; then
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
  read -p "Apply this change? [y/N] " confirm
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

pull_file "ssh-config" ~/.ssh/config
pull_file "hosts-file" /etc/hosts
pull_file "sops-age-key" ~/.config/sops/age/keys.txt

echo ""
echo "Done!"
