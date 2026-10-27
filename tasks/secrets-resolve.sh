#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/secrets-common.sh"

secrets_signin
umask 077
resolve_dir=$(mktemp -d)
trap 'rm -rf "$resolve_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

remote_snapshot() {
  local name="$1" destination="$2" documents matches
  documents=$(secrets_op document list --format json) || return 1
  matches=$(jq -ce --arg name "$name" '[.[] | select(.title == $name) | .id]' <<< "$documents") || return 1
  if [[ $(jq 'length' <<< "$matches") -gt 1 ]]; then
    echo "Multiple documents named '$name' in Jeff’s Family; resolve the duplicate first." >&2
    return 1
  fi
  document_id=$(jq -r '.[0] // empty' <<< "$matches")
  if [[ -n "$document_id" ]]; then
    secrets_op document get "$document_id" > "$destination" || return 1
  else
    : > "$destination"
  fi
}

show_diff() {
  local status=0
  git --no-pager diff --no-index --no-ext-diff --no-textconv -- "$1" "$2" || status=$?
  [[ "$status" -le 1 ]]
}

resolve_file() {
  local name="$1" local_path="$2" document_id="" original_id local_exists=false
  local snapshot="$resolve_dir/$name" choice edited=false
  mkdir "$snapshot"
  if [[ -f "$local_path" ]]; then
    local_exists=true
    cp "$local_path" "$snapshot/local"
  else
    : > "$snapshot/local"
  fi
  remote_snapshot "$name" "$snapshot/1password" || return 1
  original_id="$document_id"
  if [[ "$local_exists" == true && -n "$original_id" ]] && cmp -s "$snapshot/local" "$snapshot/1password"; then
    echo "✓ $name: in sync"
    return
  fi
  if [[ "$local_exists" == false && -z "$original_id" ]]; then
    echo "⚠️ $name: missing locally and in Jeff’s Family; skipping."
    return
  fi

  printf '\n%s\nLocal: %s\n1Password: %s / %s\n' "$name" "$local_path" "Jeff’s Family" "$name"
  [[ "$local_exists" == true ]] || echo "Local file is missing."
  [[ -n "$original_id" ]] || echo "1Password document is missing."
  echo "Diff: - 1Password, + local"
  show_diff "$snapshot/1password" "$snapshot/local"
  while true; do
    if ! read -r -p "[p]ush local / [l]pull remote / [e]dit merged copy / [s]kip / [q]uit [s]: " choice; then
      exit 0
    fi
    case "$choice" in
      p|push) [[ "$local_exists" == true ]] && break; echo "No local file to push." ;;
      l|pull) [[ -n "$original_id" ]] && break; echo "No remote document to pull." ;;
      e|edit)
        if [[ "$local_exists" == true ]]; then
          cp "$snapshot/local" "$snapshot/merged"
        else
          cp "$snapshot/1password" "$snapshot/merged"
        fi
        echo "Edit $snapshot/merged; the original remote copy is $snapshot/1password."
        local editor_command
        local -a editor_args
        editor_command="${VISUAL:-${EDITOR:-vi}}"
        read -r -a editor_args <<< "$editor_command"
        if ! "${editor_args[@]}" "$snapshot/merged"; then
          echo "Editor failed; nothing applied."
          continue
        fi
        echo "Merged changes to 1Password:"
        show_diff "$snapshot/1password" "$snapshot/merged"
        echo "Merged changes to local file:"
        show_diff "$snapshot/local" "$snapshot/merged"
        if ! read -r -p "Apply merged copy to BOTH local file and 1Password? [y/N] " choice; then exit 0; fi
        if [[ "$choice" =~ ^[Yy]$ ]]; then edited=true; break; fi
        ;;
      s|skip|"") echo "Skipped $name."; return ;;
      q|quit) exit 0 ;;
      *) echo "Choose push, pull, edit, skip, or quit." ;;
    esac
  done

  # A decision applies only to the snapshots that were reviewed.
  remote_snapshot "$name" "$snapshot/current-remote" || return 1
  if [[ "$document_id" != "$original_id" ]] || ! cmp -s "$snapshot/1password" "$snapshot/current-remote"; then
    echo "$name changed in 1Password during review. Rerun secrets-resolve." >&2
    return 1
  fi
  if { [[ "$local_exists" == true ]] && ! cmp -s "$local_path" "$snapshot/local"; } ||
     { [[ "$local_exists" == false ]] && [[ -e "$local_path" ]]; }; then
    echo "$name changed locally during review. Rerun secrets-resolve." >&2
    return 1
  fi

  local source="$snapshot/local"
  if [[ "$edited" == true ]]; then source="$snapshot/merged"; fi
  if [[ "$edited" == true || "$choice" == p || "$choice" == push ]]; then
    if [[ -n "$original_id" ]]; then
      secrets_op document edit "$original_id" "$source" >/dev/null
    else
      secrets_op document create "$source" --title "$name" >/dev/null
    fi
    echo "✓ $name: uploaded to Jeff’s Family"
  fi
  if [[ "$edited" == true || "$choice" == l || "$choice" == pull ]]; then
    if [[ "$edited" == false ]]; then source="$snapshot/1password"; fi
    if [[ "$local_path" == /etc/* ]]; then
      sudo cp "$source" "$local_path"
    else
      mkdir -p "$(dirname "$local_path")"
      cp "$source" "$local_path"
      chmod 600 "$local_path"
    fi
    echo "✓ $name: updated $local_path"
  fi
}

echo "Compare and resolve each secret. Enter skips; no changes are automatic."
secrets_each_file resolve_file
