#!/bin/bash

if ! op account list &>/dev/null 2>&1; then
  echo "⚠️  1Password not signed in - run: eval \$(op signin)"
  exit 0
fi

check_file() {
  local name="$1"
  local local_path="$2"

  if [[ ! -f "$local_path" ]]; then
    echo "⚠️  $name: local file missing ($local_path)"
    return
  fi

  local_hash=$(shasum -a 256 "$local_path" 2>/dev/null | cut -d' ' -f1)
  remote_hash=$(op document get "$name" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)

  if [[ -z "$remote_hash" ]]; then
    echo "⚠️  $name: not in 1Password (run: mise run secrets-push)"
  elif [[ "$local_hash" != "$remote_hash" ]]; then
    echo "⚠️  $name: out of sync"
    echo "   Local:  $local_path"
    echo "   Remote: 1Password document '$name'"
    echo "   Run: mise run secrets-push (upload local) or secrets-pull (download remote)"
  else
    echo "✓  $name: in sync"
  fi
}

check_file "ssh-config" ~/.ssh/config
check_file "hosts-file" /etc/hosts
