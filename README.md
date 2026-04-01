# dotfiles

Jeff Levin's macOS dotfiles.

## Quick Start

```bash
# Fresh machine
./bootstrap.sh        # Xcode CLI tools + Homebrew + mise + full setup

# Already bootstrapped
mise run apply        # brew + stow symlinks + fonts + neovim + macOS settings
```

## Layout

```
dotfiles/
├── bootstrap.sh        # Fresh machine entry point
├── mise.toml           # All task definitions
├── home/               # Config files, symlinked to ~/ via GNU Stow
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

All configs live under `home/` and are symlinked via GNU Stow:

```bash
mise run stow   # idempotent, safe to re-run
```

To add a new config: place it at the correct path under `home/` mirroring `~/`, then re-run `mise run stow`.

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
