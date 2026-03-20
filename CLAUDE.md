# Dotfiles Overview

Jeff Levin's macOS dotfiles for a Staff Software Engineer at Grafana Labs.

## Repository Layout

```
dotfiles/
├── bootstrap.sh          # Fresh machine bootstrap (Xcode + Homebrew + mise + setup)
├── mise.toml             # All setup tasks
├── home/                 # All managed config files (mirrors ~/)
│   ├── .zshrc            # Shell config
│   ├── .gemrc
│   ├── .sqliterc
│   ├── .config/
│   │   ├── git/
│   │   │   ├── config    # Git config with aliases and SSH signing
│   │   │   └── ignore    # Global gitignore
│   │   ├── tmux/
│   │   │   └── tmux.conf # Tmux config
│   │   ├── nvim/         # Neovim config (init.lua, lua/, etc.)
│   │   ├── agent-deck/   # Agent Deck config
│   │   ├── hive/
│   │   │   └── config.yaml  # Hive workspace config (workspace: ~/projects)
│   │   ├── k9s/          # k9s config, aliases, plugins
│   │   ├── ripgrep/      # ripgrep config
│   │   └── ghostty/      # Ghostty terminal config
│   └── .claude/          # Claude Code config
│       ├── settings.json # Permissions, statusline, agent definitions
│       ├── statusline.sh # Custom status line script
│       ├── agents/       # Agent prompt files (default.md, github.md)
│       └── commands/     # Slash command prompts
├── install/
│   ├── Brewfile          # Homebrew packages
│   └── macos             # macOS system defaults script
├── fonts/                # TTF fonts
└── Support/              # macOS Application Support files
```

## Symlinks (`mise run stow`)

All configs live in `home/` and are symlinked into place via GNU Stow — never edit files at their destination paths directly.

`mise run stow` runs `stow -v -t ~/ home/` and is idempotent. To add a new config, just place it at the correct path under `home/` (mirroring where it lives under `~/`) and re-run `mise run stow`.

New configs should target `~/.config/{tool}/` (XDG Base Directory spec) rather than legacy dotfile locations (e.g. `~/.toolrc`). The XDG vars are exported in `.zshrc`.

## Key Configs

### Shell (`home/.zshrc`)

- **Editor**: `nvim` (aliased as `vim`; `vim` also aliased to `vi`)
- **Pager aliases**: `cat` → `bat`, `grep` → `rg`, `top` → `htop`
- **GOPATH**: `~/projects/go`; go binaries at `~/projects/go/bin`
- **Python**: managed via `pyenv`
- **Ruby**: managed via `rbenv`
- **Node**: pinned versions via `node18` / `node22` aliases; `pnpm` configured
- **Hive alias**: `hv` → opens/attaches tmux session named `hive` running `hive`

Notable aliases:
- `g` = `git`, `gm` = `git commit`, `gdiff` = `git --no-pager diff`
- `k` = `kubectl`, `gk` = Grafana kubectl wrapper
- `be` = `bundle exec`
- `rl` / `reload` = `source ~/.zshrc`
- `projects` = `cd ~/projects`

### Git (`home/.config/git/`)

- **User**: Jeff Levin `<jeff@levinology.com>`
- **Commit signing**: SSH via 1Password (`op-ssh-sign`)
- **Default branch**: `main`
- **Push**: `autoSetupRemote = true`
- **URL rewrites**: `https://github.com/` and `https://gitlab.com/` → SSH
- **Key aliases**: `ac` (add-all + commit), `lo` (log oneline), `fap` (fetch --all --prune), `rr` (reset to remote)

### Tmux (`home/.config/tmux/tmux.conf`)

- **Prefix**: `C-Space` / `C-q`
- **Mouse**: enabled
- **Vi copy mode**: `v` to select, `y` to copy, `r` for rectangle
- **Session shortcut**: `bind l` → switch to `hive` session

### Claude Code (`home/.claude/`)

**settings.json** defines:
- Pre-allowed Bash commands: `go get/run/test`, `git checkout/tag`, `ls`, `find`, `grep`, `jq`, `gh api/run/repo`
- Status line: runs `~/.claude/statusline.sh` (3-line display: model/cost/duration, context bar + git info, token breakdown)
- Enabled plugins: `typescript-lsp`, `gopls-lsp`, `agent-deck`
- Two agents: `default` (Grafana staff eng context) and `github` (minimal GitHub CLI auth rules)

**agents/default.md** system prompt context:
- Role: Staff Software Engineer at Grafana Labs
- Primary repos: `~/projects/deployment_tools` (Jsonnet/K8s infra), `~/projects/bench` (E2E testing)
- Tech stack: Golang, TypeScript, Kubernetes, Jsonnet
- GitHub access: always use `gh` CLI, never `curl`/WebFetch for GitHub URLs
- Commit style: no `Co-Authored-By` lines

### Hive (`home/.config/hive/config.yaml`)

Single workspace configured: `/Users/jeff/projects`

### Agent Deck (`home/.config/agent-deck/config.toml`)

- Default agent: `claude-code`
- Socket mode enabled (`use_sockets = true`)

## Setup / Maintenance

```bash
# Fresh machine setup
./bootstrap.sh        # Installs Xcode CLI tools, Homebrew, mise, then runs mise run setup

# Individual tasks (after bootstrap)
mise run stow         # Create all symlinks via GNU Stow
mise run brew         # Install Homebrew packages from Brewfile
mise run fonts        # Install fonts to ~/Library/Fonts
mise run setup        # Run all setup tasks (brew + stow + fonts + neovim + osx-settings)
```

## Secrets Management

Sensitive files (`~/.ssh/config`, `/etc/hosts`) are stored in 1Password and synced via mise tasks.
They are NOT stored in this git repo.

```bash
# Check sync status (runs automatically when entering this directory)
mise run secrets-check

# Push local files to 1Password
mise run secrets-push

# Pull from 1Password to local
mise run secrets-pull
```

**1Password documents used:**
| Document Name | Local Path | Contents |
|---------------|------------|----------|
| `ssh-config` | `~/.ssh/config` | SSH host aliases, 1Password agent config |
| `hosts-file` | `/etc/hosts` | Custom host entries |

**First-time setup:** Run `mise run secrets-push` to upload local files to 1Password.

**New machine:** Run `eval $(op signin)` then `mise run secrets-pull` to fetch secrets.

**Auto-check:** When you `cd` into this directory, mise automatically runs `secrets-check` to warn if local files differ from 1Password.

## Machine Backup / Restore

- **[BACKUP.md](BACKUP.md)** - Pre-wipe checklist (Time Machine, projects tar, secrets push)
- **[SETUP.md](SETUP.md)** - New machine setup guide

### First-time stow run (migrating from old make link symlinks)

The old symlinks point to `configs/` which no longer exists. Remove them first:

```bash
rm -f ~/.zshrc ~/.gemrc ~/.sqliterc \
  ~/.config/git/config ~/.config/git/ignore \
  ~/.config/tmux ~/.config/nvim ~/.config/agent-deck \
  ~/.config/k9s ~/.config/hive ~/.config/ripgrep ~/.config/ghostty \
  ~/.claude/settings.json ~/.claude/statusline.sh \
  ~/.claude/agents ~/.claude/commands

mise run stow
```
