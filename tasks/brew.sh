#!/bin/bash

# Override SSH URL rewrites for this process only (1Password SSH agent may not be set up yet)
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf
export GIT_CONFIG_VALUE_0=https://github.com/
export GIT_CONFIG_KEY_1=url.https://gitlab.com/.insteadOf
export GIT_CONFIG_VALUE_1=https://gitlab.com/

brew bundle --no-upgrade --file=install/Brewfile || true

# Check for drift: packages installed but not in Brewfile
CLEANUP=$(brew bundle cleanup --file=install/Brewfile 2>/dev/null)
if [ -z "$CLEANUP" ]; then
  exit 0
fi

echo ""
echo "Packages installed but not in Brewfile:"
echo ""

while IFS= read -r line; do
  if [[ "$line" =~ Would\ uninstall\ (formula|cask):\ (.+) ]]; then
    type="${BASH_REMATCH[1]}"
    pkg="${BASH_REMATCH[2]}"

    echo "  [$type] $pkg"
    read -r -p "  [r]emove, [a]dd to Brewfile, [s]kip? " choice
    echo ""

    case "$choice" in
      r|R)
        brew uninstall $([[ "$type" == "cask" ]] && echo "--cask") "$pkg"
        ;;
      a|A)
        if [[ "$type" == "cask" ]]; then
          echo "cask \"$pkg\"" >> install/Brewfile
        else
          echo "brew \"$pkg\"" >> install/Brewfile
        fi
        echo "  Added to Brewfile."
        ;;
      *)
        echo "  Skipped."
        ;;
    esac
  fi
done <<< "$CLEANUP"
