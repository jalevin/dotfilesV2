#!/bin/bash
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/secrets-common.sh"

secrets_signin || exit 0

check_file() {
  local name="$1"
  local local_path="$2"

  if [[ ! -f "$local_path" ]]; then
    echo "⚠️  $name: local file missing ($local_path)"
    return
  fi

  local_hash=$(shasum -a 256 "$local_path" 2>/dev/null | cut -d' ' -f1)
  if ! remote_hash=$(secrets_op document get "$name" 2>/dev/null | shasum -a 256 | cut -d' ' -f1); then
    echo "⚠️  $name: could not read from Jeff’s Family (check access or run: mise run secrets-push)"
  elif [[ "$local_hash" != "$remote_hash" ]]; then
    echo "⚠️  $name: out of sync"
    echo "   Local:  $local_path"
    echo "   Remote: 1Password document '$name'"
    echo "   Run: mise secrets-resolve (compare and choose push/pull per file)"
  else
    echo "✓  $name: in sync"
  fi
}

secrets_each_file check_file
