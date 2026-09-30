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

`model` is deliberately **not** in the tracked `settings.json`. Claude Code
renames models often enough that it was usually the only line changing, so it
lives in `~/.claude/settings.local.json` — a real file beside the linked
`settings.json` (which `mode = "symlink-each"` allows), already gitignored by
`**/.claude/settings.local.json`. Cost: a new machine starts on the default
model until you set it there once.

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

Canonical location for agent skills. `home/.claude/skills` is a relative symlink
to it, so Claude Code reads the whole directory from one in-repo link. All
symlinks in the repo must stay **inside** it — a link out to `~/.agents` or
`~/.local` dangles on a fresh clone.

**Codex needs separate wiring.** It reads `~/.codex/skills`, which that symlink
does not reach, so `mise run codex-skills` links each skill there. It derives
the list from `git ls-files`, not from a list in `mise.toml`: `.gitignore`'s
allowlist is already the opt-in gate for a skill, and a second registration
would only be another place to forget — the kind of silent miss that hid the
Telegram instructions. Adding a skill is therefore still one edit, a `!` line
in `.gitignore`.

`[dotfiles]` cannot express this: its keys are literal target paths with no
glob, and `symlink-each` on the whole directory would mirror
`home/.ai/skills/synced/` — the untracked org/account sync, keyed by an
`<org>_<user>` UUID, which is Claude's to manage and not ours to deploy. Being
untracked is also what keeps it out of `git ls-files`, so the task excludes it
for free.

The task links whole skill directories and only ever prunes links pointing
*into* `home/.ai/skills`, so `~/.codex/skills` keeps its live state (`.system`)
and hand-made links into other repos (`paperclip`). It refuses to replace a real
directory, and bails rather than pruning if the tracked list comes back empty.

This is the trade from dropping plannotator's installer: it used to wire skills
across 13 harnesses including Codex hooks, so installing the pinned CLI alone
registers skills nowhere.

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

**Version pinning is a `[tools]`-only feature.** `[bootstrap.packages]` cannot
pin a brew version: the Homebrew API publishes only the current one, so mise
warns `cannot install pinned version 'jq@1.7.1', skipping` and leaves the
package uninstalled. A version value there is worse than `"latest"` — `status`
reports `version mismatch` forever while nothing installs. Declare brew packages
as `"latest"` and pin in `[tools]` when the version matters.

**gcloud is the worked example of choosing between the two.** It keeps add-on
components *inside* the SDK directory — `gke-gcloud-auth-plugin`, which
`kubectl` resolves by name off PATH — so a `[tools]` entry would discard them on
every bump into a fresh versioned directory, even though it is the only option
that could lock the version. `brew-cask:gcloud-cli` keeps them: the prefix is
unversioned (`$HOMEBREW_PREFIX/share/google-cloud-sdk`) and the installer runs
with `--update-installed-components`. mise handles the cask fully, including its
`run installer` step, so it needs no Homebrew CLI and stays in the declared set.
Declared in `mise.grafana.toml` only — the personal machine has no GKE clusters.
Components are not reinstalled automatically, though: after a fresh install run
`gcloud components install gke-gcloud-auth-plugin`.

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

Overlay entries **merge** with the base and **override** a matching key — both
`[dotfiles]` and `[bootstrap.packages]`. Today the only overlay content is
`brew-cask:gcloud-cli` in `mise.grafana.toml`; the `machines/` directory is gone,
because hive was its only occupant.

### Hive — configs live in iCloud, not this repo

hive is the one tool whose config is **not** in this repo. Its configs can carry
private roadmap detail and this repo is public, so they live in iCloud:

```
~/Library/Mobile Documents/com~apple~CloudDocs/hive/
├── grafana/     # config.yaml + desktop/{actions.yml,flows,settings.yaml,workspaces}
└── personal/    # same shape, its own config.yaml, no flows or ai-platform workspace
```

`mise run hive-link` points `~/.config/hive` at the folder matching `$MISE_ENV`
as **one whole-directory symlink**, and runs as part of `[tasks.bootstrap]`.

Three things make that the right shape:

- **Whole-directory, never per-file.** Hive Desktop saves by
  temp-file-plus-`rename()`, which replaces a per-file symlink with a real file
  and silently detaches it — the same hazard documented for `~/.config/mise`. A
  link at the directory level gets written *through*. This repo watched it
  happen: app-rewritten `SKILL.md` files kept showing up as repo modifications.
- **No env-var plumbing.** Both halves *can* be redirected — `HIVE_CONFIG` for
  the CLI, `HIVE_DESKTOP_CONFIG_DIR` / `_FLOWS_DIR` / `_ACTIONS_PATH` /
  `_AGENT_WORKSPACES_DIR` for the app — but Hive.app launches from the Dock and
  inherits launchd's environment, not `.zshrc`'s. Routing by env would need a
  login agent calling `launchctl setenv`. Both read `~/.config/hive` by default,
  so the symlink covers them with nothing extra.
- **One folder per machine, so iCloud never merges.** No file is written by two
  machines, so there are no conflict copies, and `settings.yaml` stays
  machine-local by construction.

The cost to know about: iCloud Drive evicts file *contents* under disk pressure,
leaving dataless placeholders that download on access. There is no reliable
"keep downloaded" pin for an arbitrary folder, so a launch while offline
mid-eviction can read as a missing config. A private git repo would trade that
risk for manual sync and give version history, which iCloud does not.

hive has no include/layering mechanism (one `--config` path), so each machine
carries a whole `config.yaml` and the shared bulk is duplicated. Keep divergence
in the `rules:` section so the two stay easy to diff:

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/hive && diff grafana/config.yaml personal/config.yaml
```

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
mise update           # Upgrade everything (packages + tools)
mise update codex     # ...or just one package/tool, by name
mise run claude-prune # Reclaim disk from old Claude Code versions
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

**Not required is not absent.** This machine has a real Homebrew install at
`/opt/homebrew` (Homebrew 7.0.6, a git checkout predating the migration), and
the `brew` CLI still works. It sees the whole prefix including what mise poured
— 230 formulae and 20 casks here — because `brew list` just enumerates
`Cellar/` and `Caskroom/` without caring who wrote the receipt.

Use `brew` to **look**, not to change: `brew list`, `brew info`, `brew --prefix`
are all fine. A `brew install` or `brew upgrade` writes brew's own receipt, and
mise then defers to it permanently (`installed and managed by Homebrew; leaving
unchanged`) until the receipt is dropped by hand. Today nothing is brew-owned —
all 20 casks report to mise. Change packages through `mise update` /
`mise bootstrap packages`, and the ownership split stays clean.

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
are the case to watch for. `mise.toml` holds the shared set; overlay
`[bootstrap.packages]` merges with it, so machine-specific packages live in
`mise.<env>.toml` — `gcloud-cli` is grafana-only, `discord`/`signal` are
personal-only.

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

### Upgrading

mise splits upgrades across two commands — `mise bootstrap packages upgrade` for
brew formulae and casks, `mise upgrade` for `[tools]`. **`mise update`** wraps
both and dispatches on where a name is declared, so one command covers either:

```bash
mise update              # everything
mise update codex        # a cask
mise update jq           # a formula
mise update hive         # a tool (resolves github:colonyops/hive)
```

It is named `update` because `up` and `upgrade` are both mise builtins (`up`
aliases `mise upgrade`) and a task cannot shadow a builtin.

Casks are included now that they are mise-owned, and a self-updating app that is
*running* is skipped ("installed app is running and updates itself") rather than
replaced under a live process. Exactly-pinned `[tools]` never move here — those
only change via a Renovate PR.

**`codex update` does not work here, by choice.** Codex has no real
self-updater — the subcommand shells out to whichever package manager installed
it, and since mise holds the cask receipt (`.mise-cask.toml`) rather than
Homebrew, it fails with a misleading `Cask 'codex' is not installed`. mise owns
codex deliberately: handing it back to brew would fix that subcommand but drop
codex out of the declarative set, and a fresh machine has no Homebrew to install
it with. Use `mise update codex`.

Contrast **Claude Code**, which self-updates *natively* into its own versions
directory with a moving symlink — that is why it is not declared here at all.
Codex only looks like that case. (`brew-cask:claude` in `[bootstrap.packages]`
is the unrelated Claude *desktop* app, which shares the name.)

Claude Code self-updates and keeps every version it installs (~205MB each,
1.2GB after six releases) with no automatic pruning. `mise run claude-prune`
keeps the running version plus one rollback; it reads the active version from
the `~/.local/bin/claude` symlink rather than assuming the highest number is
live, so a rollback stays safe.

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


