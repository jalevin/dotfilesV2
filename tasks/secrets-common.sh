#!/bin/bash

# Jeff’s Family; the sign-in address is shared with another personal account.
SECRETS_ACCOUNT="JOYZ5VXNMRHF5J4K6LXZYA7AHM"

secrets_op() {
  if [[ -n "${SECRETS_SESSION:-}" ]]; then
    command op --account "$SECRETS_ACCOUNT" --session "$SECRETS_SESSION" "$@"
  else
    command op --account "$SECRETS_ACCOUNT" "$@"
  fi
}

secrets_signin() {
  if secrets_op whoami &>/dev/null; then
    return 0
  fi

  echo "Signing in to Jeff’s Family…" >&2
  if ! SECRETS_SESSION=$(secrets_op signin --raw); then
    echo "Could not sign in to Jeff’s Family." >&2
    return 1
  fi
  if ! secrets_op whoami &>/dev/null; then
    echo "1Password sign-in did not authenticate Jeff’s Family." >&2
    return 1
  fi
}

secrets_each_file() {
  "$@" "ssh-config" "$HOME/.ssh/config"
  "$@" "ssh-homesrv-hive-config" "$HOME/.ssh/homesrv-hive.conf"
  "$@" "ssh-homesrv-hive-known-hosts" "$HOME/.ssh/homesrv-hive.known_hosts"
  "$@" "ssh-homesrv-hive-key" "$HOME/.ssh/homesrv-hive-key-0.pub"
  "$@" "hosts-file" "/etc/hosts"
  case ",${MISE_ENV:-}," in
    *,personal,*) "$@" "sops-age-key" "$HOME/.config/mise/age.txt" ;;
  esac
  return 0
}
