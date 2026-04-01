#!/bin/bash

# Override SSH URL rewrites for this process only (1Password SSH agent may not be set up yet)
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf
export GIT_CONFIG_VALUE_0=https://github.com/
export GIT_CONFIG_KEY_1=url.https://gitlab.com/.insteadOf
export GIT_CONFIG_VALUE_1=https://gitlab.com/

brew bundle --no-upgrade --file=install/Brewfile || true

# Check for drift: packages installed but not in Brewfile
# Loop because removals can reveal new drift (e.g., removing a formula may expose its tap)
while true; do
  CLEANUP=$(brew bundle cleanup --file=install/Brewfile 2>/dev/null)
  if [ -z "$CLEANUP" ] || ! echo "$CLEANUP" | grep -q "Would uninstall"; then
    break
  fi

  echo ""
  echo -e "\033[33mPackages installed but not in Brewfile:\033[0m"
  echo ""

  had_changes=false
  current_type=""
  while IFS= read -r line; do
    if [[ "$line" == "Would uninstall casks:" ]]; then
      current_type="cask"
      continue
    elif [[ "$line" == "Would uninstall formulae:" ]]; then
      current_type="formula"
      continue
    elif [[ "$line" == Would* ]] || [[ "$line" == Run* ]] || [[ -z "$line" ]]; then
      current_type=""
      continue
    fi

    [[ -z "$current_type" ]] && continue
    pkg="$line"

    echo "  [$current_type] $pkg"
    read -r -p "  [r]emove, [a]dd to Brewfile, [s]kip? " choice
    echo ""

    case "$choice" in
      r|R)
        brew uninstall $([[ "$current_type" == "cask" ]] && echo "--cask") "$pkg"
        had_changes=true
        ;;
      a|A)
        if [[ "$current_type" == "cask" ]]; then
          echo "cask \"$pkg\"" >> install/Brewfile
        else
          echo "brew \"$pkg\"" >> install/Brewfile
        fi
        echo "  Added to Brewfile."
        had_changes=true
        ;;
      *)
        echo "  Skipped."
        ;;
    esac
  done <<< "$CLEANUP"

  # Only re-check if something was removed or added
  $had_changes || break
done
