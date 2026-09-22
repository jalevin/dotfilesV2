# dotfiles

Jeff Levin's macOS dotfiles.

## Quick Start

```bash
# Fresh machine
./bootstrap.sh grafana   # or 'personal' — Xcode CLI tools + Homebrew + mise, then converge

# Already bootstrapped
mise run apply        # re-converge this machine (= mise bootstrap --yes)
mise run sync         # pull latest config, then converge
mise run check        # read-only drift report
```

## Layout

```
dotfiles/
├── bootstrap.sh        # Fresh machine entry point (takes the machine env)
├── mise.toml           # All task definitions
├── home/               # Config files, symlinked to ~/ via [dotfiles]
│   ├── .zshrc
│   ├── .config/
│   │   ├── git/        # Git config + global ignore
│   │   ├── tmux/
│   │   ├── nvim/
│   │   ├── ghostty/
│   │   ├── k9s/
│   │   ├── hive/
│   │   ├── lazygit/
│   │   ├── ripgrep/
│   │   ├── mise/
│   │   ├── gh/
│   │   └── agent-deck/
│   ├── .ai/            # Editor-agnostic skills, commands, agents (Claude, Cursor, Codex)
│   └── .claude/        # Claude Code: settings, statusline, symlinks to .ai/
├── install/
│   ├── Brewfile
│   ├── macos           # macOS system defaults
│   └── scripts/
├── tasks/              # mise task scripts
├── fonts/
└── Support/            # macOS Application Support files
```

## Symlinks

All configs live under `home/` and are symlinked from the `[dotfiles]` section
of `mise.toml` (GNU Stow has been retired):

```bash
mise bootstrap dotfiles diff   # preview what would change
mise run dotfiles              # apply; idempotent, safe to re-run
```

`[dotfiles]` is opt-in: to add a new config, place it under `home/` mirroring
`~/`, **add an entry for it**, then run `mise run dotfiles`. Use
`mode = "symlink-each"` when the tool writes its own state into that directory.

## Secrets

Sensitive files (`~/.ssh/config`, `/etc/hosts`) are stored in 1Password, not this repo.

```bash
mise run secrets-check   # diff local vs 1Password (runs on cd)
mise run secrets-pull    # fetch from 1Password
mise run secrets-push    # upload local to 1Password
```

## Other Docs

- [SETUP.md](SETUP.md) — new machine setup guide
- [BACKUP.md](BACKUP.md) — pre-wipe checklist
- [hotkeys.md](hotkeys.md) — keyboard shortcuts reference
