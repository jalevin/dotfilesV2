# Dotfiles Overview

Jeff Levin's macOS dotfiles for a Staff Software Engineer at Grafana Labs.

## Repository Layout

```
dotfiles/
├── bootstrap.sh          # Fresh machine: Xcode CLT + mise, then
│                         #   `mise bootstrap --yes`. Takes <grafana|personal>.
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
│   ├── .ai/
│   │   ├── AGENTS.md     # Standing instructions — loaded in EVERY session
│   │   ├── agents/       # Subagent definitions (github.md)
│   │   └── skills/       # Agent skills (shared across harnesses)
│   └── .claude/          # Claude Code config
│       ├── settings.json # Permissions, statusline, agent definitions
│       ├── statusline.sh # Custom status line script
│       ├── CLAUDE.md -> ../.ai/AGENTS.md
│       ├── agents -> ../.ai/agents
│       ├── skills -> ../.ai/skills
│       └── commands/     # Slash command prompts
├── machines/             # Per-machine config, selected by MISE_ENV
│   ├── grafana/          # work laptop
│   └── personal/         # personal laptop
├── mise.grafana.toml     # work overlay
├── mise.personal.toml    # personal overlay
├── install/
│   └── macos             # imperative macOS setup (sudo/dict-add/PlistBuddy only;
│                         #   plain defaults live in [bootstrap.macos.defaults])
└── fonts/                # TTF fonts
```

## Symlinks (`mise run dotfiles`)

All configs live in `home/` and are symlinked into place from the `[dotfiles]`
section of `mise.toml` — never edit files at their destination paths directly.
GNU Stow has been retired; `[dotfiles]` is **opt-in**, so a new config under
`home/` does nothing until it also has an entry.

```bash
mise bootstrap dotfiles diff     # preview — what would change
mise bootstrap dotfiles status   # per-entry: mode, source, applied/differs
mise run dotfiles                # apply
mise bootstrap dotfiles unapply  # reverse it
```

**Granularity matters.** Two modes are in use, and picking the wrong one either
shadows a tool's live state or scatters links:

- plain (`"~/.config/tmux" = "home/.config/tmux"`) — one symlink for the whole
  directory. Only safe when we own that path outright.
- `mode = "symlink-each"` — a link per file inside a real directory. Required
  wherever the tool writes its own state next to our config: `~/.claude`
  (sessions, cache, history), `~/.config/git` (local `gitk`), `~/.config/gh`
  (auth in `hosts.yml`), `~/.config/mise`, `~/.local/bin`.

New configs should target `~/.config/{tool}/` (XDG Base Directory spec) rather than legacy dotfile locations (e.g. `~/.toolrc`). The XDG vars are exported in `.zshrc`.

## Key Configs

### Shell (`home/.zshrc`)

- **Editor**: `nvim` (aliased as `vim`; `vim` also aliased to `vi`)
- **Pager aliases**: `cat` → `bat`, `grep` → `rg`, `top` → `htop`
- **GOPATH**: `~/projects/go`; go binaries at `~/projects/go/bin`
- **Python**: managed via `pyenv`
- **Ruby**: managed via `rbenv`
- **Node**: managed via `mise`; `pnpm` configured
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

### Where instructions live

Standing instructions go in `home/.ai/AGENTS.md`, which reaches every harness
from one file:

| Destination | Via | Scope |
|-------------|-----|-------|
| `~/.claude/CLAUDE.md` | `home/.claude/CLAUDE.md -> ../.ai/AGENTS.md` | **every Claude Code session** |
| `~/AGENTS.md` | `[dotfiles]` entry | Codex, Cursor, Amp — the AGENTS.md convention |

`home/.ai/agents/*.md` are **subagents** — helpers invoked for a delegated task,
not the session's own prompt. That distinction bit us: the Telegram
instructions lived in `agents/default.md`, which only applies when that agent is
explicitly selected, so no ordinary session ever learned `tg-notify` existed.
`settings.json` also carried an inline `agents` key whose `default` prompt was a
stale copy missing four sections. Both are gone; there is one source of truth.

Rule of thumb: **every session → `AGENTS.md`; on demand → a skill; delegated
task → `agents/`.** Anything long or situational belongs in a skill so it isn't
in every context (the Telegram details are a skill for exactly this reason).

**settings.json** defines:
- Pre-allowed Bash commands: `go get/run/test`, `git checkout/tag`, `ls`, `find`, `grep`, `jq`, `gh api/run/repo`
- Status line: runs `~/.claude/statusline.sh` (3-line display: model/cost/duration, context bar + git info, token breakdown)
- Enabled plugins: `typescript-lsp`, `gopls-lsp`, `agent-deck`

**.ai/AGENTS.md** standing instructions:
- Role: Staff Software Engineer at Grafana Labs
- Primary repos: `~/projects/deployment_tools` (Jsonnet/K8s infra), `~/projects/bench` (E2E testing)
- Tech stack: Golang, TypeScript, Kubernetes, Jsonnet
- GitHub access: always use `gh` CLI, never `curl`/WebFetch for GitHub URLs
- Commit style: no `Co-Authored-By` lines

### Agent skills (`home/.ai/skills/`)

Canonical location for agent skills; `home/.claude/skills` is a relative symlink
to it so every harness reads one directory. All symlinks must stay **inside the
repo** — a link out to `~/.agents` or `~/.local` dangles on a fresh clone.

**Skills here are hand-written.** Vendor-installed skills are deliberately not
used: the plannotator installer previously wrote eight of them (plus Codex hooks
and a transitive `npx skills add` of a third-party skill), which is why the CLI
is now a pinned entry in `[tools]` and the review surfaces are three local
wrappers — `diff-review`, `doc-review`, `msg-review`.

Conventions for a review wrapper:
- Put the command in a fenced ```bash block, never a `` !`cmd` `` pre-exec line —
  pre-exec runs at skill load and splices `$ARGUMENTS` into a shell string.
- Scope `allowed-tools` to the binary actually needed.
- Set `disable-model-invocation: true` so a blocking browser session can't fire
  mid-task without being asked for.

## Tools (`[tools]`) vs packages (`[bootstrap.packages]`)

Two rules decide where a tool goes.

**1. Scope.** A `[tools]` entry only resolves inside the project that declares
it — elsewhere the shim errors with `No version is set for shim: <name>`. So
config lives in two places, matching hay-kot/dotfiles:

| File | Holds |
|------|-------|
| `home/.config/mise/config.toml` | `[tools]` — global, every directory |
| `home/.config/mise/mise.<env>.toml` | `[tools]` — global, per-machine |
| `mise.toml` (repo root) | `[dotfiles]`, `[bootstrap.*]`, `[tasks.*]` |
| `mise.<env>.toml` (repo root) | per-machine `[dotfiles]` |

**2. Do you want a PR when it changes?** Renovate's mise manager opens a PR when
a **pinned** tool has a newer release, so the pin *is* the subscription. A
`"latest"` entry gives Renovate nothing, and `[bootstrap.packages]` is not a
Renovate manager at all.

- **mise, pinned exactly** — version matters, and you want to see each bump
- **brew, `"latest"`** — want it present and current, version irrelevant

On mise: the Kubernetes/Jsonnet toolchain (work-only), plus `sops`, `age`,
`shellcheck`, and the CLIs that replaced installer scripts.
On brew: anything that isn't one self-contained binary (shared libraries,
plugins, system integration), utilities where a PR per release is noise, and all
casks. `git-lfs` stays on brew deliberately — a mise-managed git-lfs shim
shadows the brew binary and exits 1 in a directory with an untrusted mise.toml,
which breaks git's LFS filters and the post-checkout hook.

Lockfiles (`mise.lock`, `mise.<env>.lock`) are generated by `mise lock --global`
— one per config — and committed, so a fresh machine resolves identical
artifacts. `[settings.github] gh_cli_tokens = true` borrows the `gh` token;
without it, resolving a dozen github/aqua tools hits the 60/hour
unauthenticated GitHub API limit.

## Per-machine config (`MISE_ENV`)

Two machines: a Grafana work laptop and a personal one. Differences are handled
with mise's native config overlays — **no templating engine, no mmdot**.

```bash
MISE_ENV=grafana  mise run stamp   # once, on the work laptop
MISE_ENV=personal mise run stamp   # once, on the personal laptop
```

`stamp` writes `~/.config/mise/miserc.toml` (`env = ["grafana"]`), which mise
reads on every invocation, so `mise.<env>.toml` loads without setting `MISE_ENV`
by hand. That file is **machine-local and never committed** — it works because
`~/.config/mise` is deployed with `symlink-each`, so only `config.toml` is
linked and a real `miserc.toml` sits beside it.

Overlay `[dotfiles]` entries **merge** with the base and **override** a matching
target key. Per-machine files live in `machines/<env>/`.

Why whole-file selection instead of templating: mise has a `mode = "template"`,
but hive's configs are full of hive's *own* `{{ }}` syntax (`{{ .Slug }}`,
`{{ agentWindow }}`, `{{ .URI | shq }}`) that must survive verbatim. Templating
them would mean escaping every one.

### Hive (`machines/<env>/hive-config.yaml`)

Single workspace configured: `/Users/jeff/projects`

`~/.config/hive` is a **real directory**, not one whole-directory link, because
the two halves come from different places:

| Path | Source | Scope |
|------|--------|-------|
| `~/.config/hive/config.yaml` | `machines/<env>/hive-config.yaml` | per-machine (overlay) |
| `~/.config/hive/desktop/flows/` | `machines/<env>/hive-desktop/flows/` | per-machine (overlay) |
| `~/.config/hive/desktop/workspaces/ai-gateway` | `machines/grafana/hive-desktop/workspaces/` | work only (overlay) |
| `~/.config/hive/desktop/actions.yml` | `home/.config/hive/desktop/actions.yml` | shared |
| `~/.config/hive/desktop/workspaces/{hive,mcps.yaml,skills.yml}` | `home/.config/hive/desktop/workspaces/` | shared |

`~/.config/hive` and `~/.config/hive/desktop` are both real directories, so an
overlay can add files *inside* an otherwise-shared tree. Verified: an overlay
entry inside a `symlink-each` directory applies and is not pruned on re-apply.
`symlink-each` is **recursive** — it mirrors subdirectories as real dirs and
links each leaf file, which is what lets the app write alongside our config.

hive has no include/layering mechanism (one `--config` path), so each machine
carries a whole `config.yaml` and the shared bulk is duplicated. Keep divergence
in the `rules:` section so the two stay easy to diff:

```bash
diff machines/grafana/hive-config.yaml machines/personal/hive-config.yaml
```

`desktop/settings.yaml` is gitignored — Hive Desktop rewrites it whenever
preferences change.

### Agent Deck (`home/.config/agent-deck/config.toml`)

- Default agent: `claude-code`
- Socket mode enabled (`use_sockets = true`)

## Setup / Maintenance

```bash
# Fresh machine setup
./bootstrap.sh grafana   # or 'personal'. Installs Xcode CLT + mise, pins
                         # MISE_ENV, then runs `mise bootstrap --yes`

# Individual tasks (after bootstrap)
mise run dotfiles     # Deploy config symlinks from [dotfiles]
mise run packages     # Install taps/formulae/casks from [bootstrap.packages]
mise run fonts        # Install fonts to ~/Library/Fonts
mise run apply        # Run all setup tasks (packages + dotfiles + fonts + neovim + osx-settings)
mise run upgrade      # Upgrade declared packages and pinned [tools]
mise run packages-prune  # Dry-run: installed but no longer declared
mise run macos-defaults  # Converge just the declarative macOS defaults (drift-checked)
mise run check        # Read-only: report drift between config and machine
mise install          # Install/update pinned [tools] (plannotator, hive, gws, ruby-lsp)
```

## Packages (`[bootstrap.packages]`)

`install/Brewfile` and `tasks/brew.sh` are retired. Formulae and casks are
declared in `mise.toml`.

**Homebrew itself is not required.** `bootstrap.sh` creates a bare, user-owned
`/opt/homebrew` (the one privileged step) and mise takes it from there —
it builds `Cellar/`, `Caskroom/`, `bin/` and the rest unaided. Ownership is what
matters: root-owned directories make mise keep re-requesting sudo, and its own
fallback hint does the `mkdir` without the `chown`.

mise fetches metadata from
formulae.brew.sh, resolves the dependency closure, pours the same ghcr.io
bottles into `/opt/homebrew`, and does brew's own relocation/code-signing/
linking — verified: installing `tldr` pulled in `libzip` unprompted with zero
`brew` invocations, and `brew list` then reported both as its own. Casks go to
`/Applications` with versions recorded under `Caskroom`. `bootstrap.sh` no
longer installs Homebrew.

**`[bootstrap.brew] adopt = true`** lets mise take over an app already at the
cask's destination instead of reinstalling it. It downloads the artifact to
verify, then adopts the existing bundle in place — so no bundle replacement and
no macOS permission (TCC) reset. A cask declaring `auto_updates: true` adopts
as-is, since the app may have updated itself past the cask version.

Adoption does NOT apply to anything Homebrew installed: brew's Caskroom receipt
makes mise defer ("installed and managed by Homebrew; leaving unchanged").
Migrating a brew-owned cask means dropping its receipt
(`/opt/homebrew/Caskroom/<cask>` — an app cask's entry is only a symlink marker,
so the app is untouched) and re-applying. A cask that is outdated *and* not
self-updating cannot adopt — content differs — and needs a real install.

`obsidian` is pinned to `adopt = false`: the installed 1.11.x bundle had no
`obsidian-cli`, which the current cask declares as a binary artifact, so
adoption fails. Self-updating apps whose bundle lacks a newly-declared artifact
are the case to watch for. Both machines get the same packages — the overlays are
dotfiles-only. (Overlay `[bootstrap.packages]` would merge if that ever changed.)

Naming gotchas found during the migration — mise resolves via the Homebrew API,
so a name Homebrew accepts locally can still 404:

| Declared as | Why |
|-------------|-----|
| `brew:whisper.cpp` | `whisper-cpp` is now an alias; the old name reports "needs repair" |
| `brew:grafana/grafana/gcx` | tap-qualified |
| `brew:heroku/brew/heroku` | tap-qualified |

`mise bootstrap packages import` only handles **formulae**, and it snapshots the
*machine* rather than a curated list — on this repo it proposed 99 entries against
the Brewfile's 58, mostly transitive libs Homebrew had flagged
"installed on request". The declared list is hand-curated from the Brewfile.

**Never bulk-apply `prune`.** It is not dependency-aware for install-on-request
formulae — on this machine it proposed 103 removals including `cairo`, which
declared `ffmpeg` needs. Use `mise run packages-prune` (dry-run) as a review
list. It also only ever sees the active config, so it loads both overlays as a
guard.

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
| `sops-age-key` | `~/.config/sops/age/keys.txt` | Age private key for sops decryption (loaded via `SOPS_AGE_KEY_FILE` in `.zshrc`) |

**First-time setup:** Run `mise run secrets-push` to upload local files to 1Password.

**New machine:** Run `eval $(op signin)` then `mise run secrets-pull` to fetch secrets.

**Auto-check:** When you `cd` into this directory, mise automatically runs `secrets-check` to warn if local files differ from 1Password.

## Machine Backup / Restore

- **[BACKUP.md](BACKUP.md)** - Pre-wipe checklist (Time Machine, projects tar, secrets push)
- **[SETUP.md](SETUP.md)** - New machine setup guide


