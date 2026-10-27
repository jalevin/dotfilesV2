#!/usr/bin/env bash
set -euo pipefail

CHECK="${CHECK:-}"
SRC="$(git rev-parse --show-toplevel)/home/.ai/skills"
case "${1:-}" in
  codex) DEST="$HOME/.codex/skills" ;;
  pi) DEST="$HOME/.pi/agent/skills" ;;
  *) echo "usage: link-agent-skills.sh <codex|pi>" >&2; exit 2 ;;
esac
LABEL="$1-skills"
[ -n "$CHECK" ] || mkdir -p "$DEST"
[ -d "$DEST" ] || { echo "$LABEL: $DEST does not exist yet"; exit 0; }

want="$(git ls-files 'home/.ai/skills/*/SKILL.md' | cut -d/ -f4 | sort -u)"
[ -n "$want" ] || { echo "$LABEL: no tracked skills found; refusing to prune" >&2; exit 0; }

linked=0
for name in $want; do
  target="$SRC/$name"
  link="$DEST/$name"
  [ -d "$target" ] || { echo "$LABEL: tracked but missing on disk: $name" >&2; continue; }
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then continue; fi
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo "$LABEL: $link exists and is not a symlink; leaving it" >&2; continue
  fi
  if [ -n "$CHECK" ]; then echo "  would link  $name"; else ln -sfn "$target" "$link"; echo "  linked $name"; fi
  linked=$((linked + 1))
done

# Prune only links we own: ones pointing into SRC whose skill is no longer
# tracked. Anything pointing elsewhere (paperclip) or not a symlink is left.
pruned=0
for link in "$DEST"/*; do
  [ -L "$link" ] || continue
  tgt="$(readlink "$link")"
  case "$tgt" in "$SRC"/*) ;; *) continue ;; esac
  name="$(basename "$link")"
  printf '%s\n' "$want" | grep -qx "$name" && continue
  if [ -n "$CHECK" ]; then echo "  would prune $name (no longer tracked)"; else rm "$link"; echo "  pruned $name"; fi
  pruned=$((pruned + 1))
done

n=$(printf '%s\n' "$want" | wc -l | tr -d ' ')
if [ -z "$CHECK" ]; then
  echo "$LABEL: $n tracked, $linked linked, $pruned pruned"
elif [ $((linked + pruned)) -eq 0 ]; then
  echo "$LABEL: $n tracked, in sync"
else
  echo "$LABEL: $n tracked, DRIFT — $linked to link, $pruned to prune" >&2
fi
