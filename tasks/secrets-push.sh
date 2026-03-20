#!/bin/bash
set -e

if ! op account list &>/dev/null; then
  echo "Sign in to 1Password first: eval \$(op signin)"
  exit 1
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

push_file() {
  local name="$1"
  local local_path="$2"
  local tmp_path="$TMPDIR/$name"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 $local_path → 1Password '$name'"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ ! -f "$local_path" ]]; then
    echo "⚠️  Local file '$local_path' not found. Skipping."
    return
  fi

  if op document get "$name" > "$tmp_path" 2>/dev/null; then
    if diff -q "$local_path" "$tmp_path" &>/dev/null; then
      echo "✓ Already in sync. No changes needed."
      return
    fi
    echo "Changes to upload:"
    diff --color=always "$tmp_path" "$local_path" || true
  else
    echo "New document (doesn't exist in 1Password yet):"
    cat "$local_path"
  fi

  echo ""
  read -p "Upload this to 1Password? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    if op document get "$name" &>/dev/null; then
      op document edit "$name" "$local_path"
    else
      op document create "$local_path" --title "$name"
    fi
    echo "✓ Uploaded to 1Password"
  else
    echo "⏭️  Skipped"
  fi
}

push_file "ssh-config" ~/.ssh/config
push_file "hosts-file" /etc/hosts

echo ""
echo "Done!"
