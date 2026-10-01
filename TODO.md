# TODO

## mise bootstrap migration

Migrating machine setup to declarative [`mise bootstrap`](https://mise.jdx.dev/bootstrap.html)
(stable since v2026.7.4). Done so far: mise self-managed via mise.run
(`mise self-update` to upgrade), `bootstrap.sh` idempotent, and the iCloud reminder is a converge-time
check (`icloud-check`); the old `first-run` task is gone.

- [x] Convert `install/macos` → `[bootstrap.macos.*]` sections in `mise.toml`.
      25 keys across 6 domains are now declarative and drift-checked via
      `mise bootstrap macos defaults status`; `~/Downloads/Screenshots` moved to
      `[bootstrap.directories]`. Dock/SystemUIServer restarts are the
      `post-defaults` hook, quitting System Settings is `pre-defaults`.
      Still imperative in `install/macos` (`mise run macos-imperative`):
      PlistBuddy hotkey 64, the `-dict-add` hotkeys (30/31/175) and Messages
      smart-quote setting, `sudo chflags nohidden /Volumes`, Touch ID PAM.
      Note: default *values* are not templated — `{{env.HOME}}` is stored
      literally, so the screencapture path is absolute.
- [x] Migrate GNU Stow → `[dotfiles]`. 18 entries; `mise bootstrap dotfiles diff`
      reports "all files are applied", so the cutover was a verified no-op.
      Granularity mirrors what stow produced: 11 whole-path links, and
      `mode = "symlink-each"` for the 7 directories where a tool writes its own
      state next to our config (`~/.claude`, `~/.config/{gh,git,glow,lazygit,mise}`,
      `~/.local/bin`). Stow is gone from `bootstrap.sh`, the Brewfile, the
      `stow` task (now `dotfiles`), and all docs.
      Gotchas found: sources resolve against config_root, so every entry needs
      the `home/` prefix (`[settings] dotfiles.root` did not work); and
      `home/.ai/skills/*` is gitignored by allowlist, so hand-written skills
      need a `!` exception or they never get committed.
- [x] Telegram commands deploy from `[dotfiles]` instead of committed
      repo-internal symlinks. `home/.local/bin/tg-*` (git mode 120000, pointing
      at `../../../telegram/`) are gone; each command now has its own entry
      pointing straight at `telegram/`, so a deployed link is a single hop.
      `~/.local/bin` is listed per-binary rather than `symlink-each`, since we
      don't own that directory.
- [x] Converted 3 of 7 `install/scripts/` to pinned `[tools]`:
      `gw.sh` → `github:googleworkspace/cli`, `ruby-lsp.sh` → `gem:ruby-lsp`,
      and the CLI half of `hive.sh` → `github:colonyops/hive`. Each had
      hand-rolled "check for a newer tag and sed the pin" logic; hive's had
      silently resolved to a local pseudo-version (v0.37.3-0.2026...) via
      `go install @latest` and sat 22 minors behind for six months.
      Stale duplicates removed from `~/.local/bin` (gws) and `$GOPATH/bin` (hive).
      Note `gem:ruby-lsp = "latest"` resolves to prereleases — pin the line.
      Staying imperative: `claude-code.sh` (self-updating installer),
      `gcloud.sh` (plugin-only backend; has `gcloud components update`),
      `ice.sh` (.app bundle → /Applications), `whisper-model.sh` (1.1GB model
      file, not a tool).
- [x] Per-machine config via `MISE_ENV` overlays (`mise.grafana.toml` /
      `mise.personal.toml`), pinned by `mise run stamp` into a machine-local
      `~/.config/mise/miserc.toml`. No templating engine needed: overlay
      `[dotfiles]` entries both merge and override, verified empirically.
      hive's `config.yaml` is now per-machine from `machines/<env>/`; the
      `desktop/` tree stays shared, so `~/.config/hive` became a real directory
      with two links instead of one whole-dir link. `desktop/settings.yaml`
      untracked (app rewrites it).
      Rejected `mode = "template"`: hive configs contain hive's own `{{ }}`
      syntax that must survive verbatim.
      Work-only desktop config also moved to the overlay:
      `desktop/flows/` (entirely Grafana-specific, overlay owns the dir) and
      `desktop/workspaces/ai-gateway`. `~/.config/hive/desktop` is now a real
      dir so `settings.yaml` lives outside the repo entirely.
- [x] Migrate Brewfile → `[bootstrap.packages]`. 5 taps + 58 formulae + 24 casks
      declared in `mise.toml`, all verified installed. `install/Brewfile` and
      `tasks/brew.sh` retired; `brew` task → `packages`; `upgrade-apps` (which
      hardcoded 4 cask names) → `upgrade`.
      Did NOT use `packages import`: it is formulae-only and snapshots the
      machine, proposing 99 entries vs the Brewfile's 58 — mostly transitive libs
      flagged "installed on request". Hand-curated from the Brewfile instead.
      Name fixes needed (mise resolves via the Homebrew API):
      `whisper-cpp`→`whisper.cpp`; tapped packages need qualifying.
      Also dropped as unused: `flux-markdown` (+ xykong/tap), `stow`,
      `actionlint`, `mage`, `terraform-ls`, `bd`, and `terraform` (installed
      per-project via mise now). Taps down to grafana/grafana + heroku/brew.
      Packages are shared except two personal-machine apps (discord, signal)
      which live in mise.personal.toml.
      2026-09-20: all 20 casks migrated from Homebrew to mise ownership via
      `[bootstrap.brew] adopt = true` — 17 adopted IN PLACE (no bundle
      replacement, no TCC reset); obsidian needed a real install
      (adopt = false: old bundle lacks the obsidian-cli artifact the current
      cask declares); 1password-cli, codex and meetingbar needed real installs
      because they were outdated AND not self-updating, which also brought them
      current (op 2.34.0 -> 2.39.0).
      Reconciled 4 stale/dangling brew receipts found on the way: 1password's
      pointed at a gone `1Password 7.app` while v8.12.36 was installed;
      discord/signal/sequel-ace were recorded as installed with no app on disk.
      sequel-ace dropped entirely (DBeaver covers it).
- [x] Renovate + pins + lockfiles. `renovate.json` added (4 lines, same as
      hay-kot). Tools pinned exactly so Renovate's mise manager can PR each
      bump; `lockfile = true` with committed `mise.lock` / `mise.grafana.lock`.
      `[settings.github] gh_cli_tokens = true` — without it, resolving many
      github/aqua tools hits the 60/hr unauthenticated API limit.
- [x] Migrated 14 tools from brew to mise, pinned to the versions brew had so
      nothing changed behavior and Renovate proposes each bump:
      work-only in `home/.config/mise/mise.grafana.toml` (tanka, jsonnet-bundler,
      go-jsonnet, kustomize, kubectl, kubectx, k9s, kind, k3d, k6, tilt),
      global in `config.toml` (sops, age, shellcheck).
      Found: the old `tasks/brew.sh` ran `brew bundle --no-upgrade` and
      `upgrade-apps` only covered 4 casks, so formulae had NEVER been upgraded —
      k6 was a full major behind (1.6.1 vs 2.2.0), tilt 4 minors, tanka 3.
      Gotcha: `[tools]` in a repo-root overlay only resolves inside the repo;
      global tools need `home/.config/mise/mise.<env>.toml`.
- [x] End state reached. `bootstrap.sh` is now just Xcode CLT + Homebrew + mise
      + `mise trust` + `mise run stamp` + `mise bootstrap --yes`. Everything else
      is declared; the imperative remainder lives in `[tasks.bootstrap]`, which
      mise runs as its final step (fonts, go-link, neovim, tmux, install
      scripts, macOS sudo/PlistBuddy work).
      bootstrap.sh now REQUIRES the machine env as an argument — without a
      stamped `miserc.toml` the overlay never loads, so a fresh machine would
      silently skip the per-machine hive config and the work-only tools.
      Added `mise run sync` (pull + converge) for the two-machine setup.
      `install/scripts/ice.sh` had a blocking `read` prompt that would hang an
      unattended converge; it is now TTY-gated.
      Homebrew install removed from bootstrap.sh entirely (2026-09-20) after
      verifying mise creates the prefix: renamed /opt/homebrew aside and mise
      installed tldr + its dep closure into nothing, with extract/relocate/
      codesign/link. bootstrap.sh now just makes a bare user-owned
      /opt/homebrew; mise creates the 11 subdirectories itself. Caveats found:
      mise's own prefix creation needs a TTY for sudo, and its printed fallback
      omits the chown — root-owned dirs are NOT enough.
      Audited the 5 remaining install scripts — none should become mise tools:
      claude-code self-updates natively (2.1.277->278 today), Ice and Hive
      Desktop are GUI .app bundles needing /Applications, gcloud has its own
      component manager, and the whisper model is a 1.1GB data file. mise
      manages PATH binaries; none of these are that.

- [x] Moved gcloud from `install/scripts/gcloud.sh` to
      `brew-cask:gcloud-cli`, superseding the "staying imperative" note above.
      Two earlier conclusions were wrong: mise's brew-cask *does* run
      script-based installers (the docs section listing them reads as a
      limitations list), and a cask upgrade does *not* drop gcloud components —
      the prefix is unversioned and the installer gets
      `--update-installed-components`. A mise `[tools]` entry would still drop
      them, which is why the plugin backend stayed rejected.
      Also established that `[bootstrap.packages]` cannot pin a version at all:
      `mise WARN brew: cannot install pinned version 'jq@1.7.1', skipping`.
      `.zshrc` now derives `GCLOUD_SDK` from `$BREW_PATH`, and the duplicate
      PATH export is gone (`path.zsh.inc` is self-locating and did the same
      prepend). `SCRIPT_MANAGED` in `[tasks.update]` was added for gcloud and
      removed with it — no other install script is brew-installable.
      **Components are not restored by the cask install:**
      `gcloud components install gke-gcloud-auth-plugin gcloud-crc32c`.

- [x] Moved hive's configs out of this repo into iCloud
      (`~/Library/Mobile Documents/com~apple~CloudDocs/hive/{grafana,personal}/`),
      reached by one whole-directory symlink from `mise run hive-link`, which
      picks the folder matching `$MISE_ENV` and runs as part of
      `[tasks.bootstrap]`. Reason: hive configs can carry private roadmap
      detail and this repo is public. Nothing sensitive was in the committed
      versions — checked before removing, so no history rewrite was needed.
      Whole-directory rather than per-file because Hive Desktop saves by
      temp-file-plus-`rename()`; that is what kept rewriting the repo's
      `SKILL.md` files through the old per-file links. Both halves *can* be
      redirected by env var (`HIVE_CONFIG`, `HIVE_DESKTOP_CONFIG_DIR` and
      friends) but Hive.app inherits launchd's environment, not `.zshrc`'s, so
      that would need a `launchctl setenv` login agent — the symlink needs none.
      One folder per machine means iCloud never merges a file, so no conflict
      copies and `settings.yaml` stays machine-local.
      `machines/` is now gone entirely — hive was its only occupant.
      Known cost: iCloud evicts file contents under disk pressure and there is
      no "keep downloaded" pin for an arbitrary folder, so a launch while
      offline mid-eviction can read as a missing config.
      Rescued three gitignored files the old layout would have dropped: two
      `.mcp.json` and `ai-platform/{CLAUDE.md,.codex/config.toml}`, which the
      broken `ai-gateway` dotfiles key had never deployed.
- [x] Personal machine migrated 2026-09-30. It was still on GNU Stow's
      *folded* links — `~/.config` and `~/.claude` were whole-directory symlinks
      into the repo, so gh/op/sops/gcloud state and all of Claude Code's
      sessions had been living inside `home/`. Unfolded by hand (real dirs,
      untracked state moved out), then `./bootstrap.sh personal`. All 22 casks
      were still brew-owned; receipts dropped and adopted (codex needed its
      orphaned brew completions removed first). Hive desktop config restarted
      from the iCloud copy rather than merged.

## Cleanup after the personal-machine migration

- [ ] Work machine: `dotsync`, then `mise run casks-prune` and
      `APPLY=1 mise run casks-prune` to remove DBeaver (dropped from the
      declared set). `apply` also installs Tailscale and Jump Desktop there.
- [ ] Personal machine: delete `~/.config/hive.pre-icloud` once Hive Desktop
      has been reopened and verified against the iCloud copy.
- [ ] Personal machine: import `iCloud Drive/jump/JumpDesktopServers.jdz` into
      Jump Desktop; set `model` in `~/.claude/settings.local.json`.
- [x] hive orchestrator workspace adapted from Hayden's (2026-09-30) and synced
      to both `hive/{grafana,personal}/desktop/workspaces/orchestrator` in iCloud.
      Per-person details now live in one "This setup" section of its AGENTS.md;
      its `PORTABILITY.md` lists every Hayden-specific assumption found and what
      is still open. Dependencies added here: the workflow skills and agents it
      drives sessions with, plus `mi` and `uv` in the global mise config.
- [ ] Work machine: after `dotsync`, `mise trust` the orchestrator workspace's
      `mise.toml` (`~/.config/hive/desktop/workspaces/orchestrator/`), or
      `mi peek` refuses to run there.
- [ ] iCloud `hive/{grafana,personal}/config.yaml` header comment still points
      at the retired `machines/<env>/hive-config.yaml` paths.

## Open

- [ ] `mise run claude-prune` — 1.4GB of old Claude Code versions. Not run by
      the agent: the task's internal `rm -rf` would sidestep the
      `Bash(rm -rf:*)` deny rule.
- [ ] `mise prune` — orphaned mise installs declared nowhere: `git-lfs`,
      `github:hay-kot/gobusgen`, two `sqlc` versions, six old `go` builds.
      Also removes the `git-lfs` shim that shadows brew's binary (shadowing
      confirmed; the breakage hay-kot documents was NOT reproducible on
      2026.9.11, so this is tidiness, not a fix).

## Maintenance

- [ ] Run `mise run upgrade` — there is a backlog of ~101 formula pours from the
      era when `tasks/brew.sh` used `brew bundle --no-upgrade` and nothing ever
      upgraded formulae. Includes major-ish jumps (ansible 14.4.0,
      awscli 2.36.49, azure-cli 2.90.0) and `k6` is a full major behind
      (1.6.1 -> 2.x), so do it deliberately rather than incidentally.
      Note it will NOT move exactly-pinned `[tools]` — those only change via a
      Renovate PR — and casks are handled separately.
