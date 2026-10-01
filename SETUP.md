# New Machine Setup Checklist

The order matters: bootstrap refuses to run without iCloud, and SSH, commit
signing and secrets all wait on 1Password.

## Phase 1: Apple ID & iCloud (System Settings) — before anything else

`./bootstrap.sh` stops at `icloud-check` until this is done: hive's config and
the Obsidian vault live in iCloud.

- [ ] Sign in to Apple ID (if not done during macOS setup)
- [ ] **iCloud Drive - Desktop & Documents**
  - System Settings > Apple ID > iCloud > iCloud Drive > Options
  - Enable "Desktop & Documents Folders"
  - Wait for sync — in particular `~/Library/Mobile Documents/com~apple~CloudDocs/hive/<env>/`
- [ ] iCloud Keychain: System Settings > Apple ID > iCloud > Passwords & Keychain
- [ ] Find My Mac: System Settings > Apple ID > iCloud > Find My Mac

## Phase 2: Bootstrap (Terminal)

- [ ] Open Terminal.app
- [ ] Clone dotfiles over HTTPS (SSH comes later, via 1Password). `git` prompts
      to install the Xcode command line tools the first time:
  ```bash
  mkdir -p ~/projects
  git clone https://github.com/jalevin/dotfilesV2.git ~/projects/dotfiles
  ```
- [ ] `cd ~/projects/dotfiles && ./bootstrap.sh grafana` (or `personal`)
  - Creates a bare, user-owned `/opt/homebrew`. **Homebrew itself is never
    installed** — mise pours bottles into that prefix on its own.
  - Installs mise, pins `MISE_ENV` (`mise run stamp`), checks iCloud
  - Runs `mise bootstrap --yes`: packages and casks, `[dotfiles]` symlinks,
    macOS defaults, pinned `[tools]` (Go, Node, Ruby, …), then the `bootstrap`
    task — fonts, neovim plugins at their locked commits, tmux, install scripts,
    `go-link`, `hive-link`, and `install/macos` (hotkeys, Touch ID for sudo)
  - **Not headless**: `install/macos` uses sudo, so expect password/Touch ID prompts
  - Safe to re-run. If a step fails it prints how to fix it; fix and re-run.
- [ ] Optional, brand-new machine only — clear the stock Dock apps:
      `defaults write com.apple.dock persistent-apps -array && killall Dock`

## Phase 3: 1Password, SSH, secrets

Everything authenticated hangs off 1Password: the SSH agent backs `git` over
SSH and commit signing, and secrets are stored there as documents.

- [ ] Open 1Password, sign in to account(s)
- [ ] System Settings > Privacy & Security > Accessibility > 1Password (autofill)
- [ ] 1Password > Settings > Developer > **SSH Agent** — enable
- [ ] 1Password > Settings > Developer > **Integrate with 1Password CLI**
- [ ] Test: `op account list`
- [ ] Pull secrets (`~/.ssh/config`, `/etc/hosts`, sops age key):
  ```bash
  eval $(op signin)
  mise run secrets-pull
  ```
- [ ] Test SSH: `ssh -T git@github.com`
- [ ] Switch the dotfiles remote to SSH:
  ```bash
  git -C ~/projects/dotfiles remote set-url origin git@github.com:jalevin/dotfilesV2.git
  ```
- [ ] `gh auth login` (mise also borrows this token for GitHub API lookups)

## Phase 4: Security

- [ ] **Touch ID**: System Settings > Touch ID & Password > Add fingerprints
      (Touch ID for sudo is already configured by bootstrap)
- [ ] FileVault: System Settings > Privacy & Security > FileVault (likely already on)

## Phase 5: Apps — sign-ins and permissions

All of these are installed by bootstrap; this is only what can't be automated.

- [ ] **CleanShot X**: license key (1Password); grant Screen Recording and
      Accessibility. macOS's own Cmd+Shift+4 shortcuts stay **enabled** (set by
      `install/macos`) — pick CleanShot hotkeys that don't collide.
- [ ] **Rectangle**: grant Accessibility; import settings or configure shortcuts
- [ ] **Ghostty**: config already linked; set as default terminal if desired
- [ ] **OrbStack**: open and complete setup; Docker Hub sign-in if needed
- [ ] **Slack** (and on `personal`: **Discord**, **Signal**): sign in
- [ ] **Tuple**: sign in; grant Screen Recording and Microphone
- [ ] **Obsidian**: open the vault from iCloud Drive
- [ ] **Visual Studio Code**: sign in for Settings Sync
- [ ] **Brave / Chrome**: sign in to sync bookmarks and extensions
- [ ] **Tailscale**: open, approve the system extension/VPN prompt, sign in
- [ ] **Hive Desktop**: open only after `ls -la ~/.config/hive` shows the iCloud
      link — launched earlier, it creates a real directory that `hive-link`
      then refuses to replace

### Telegram agent notifications (per-machine bot)

Local agents message my phone via Telegram. **Each machine has its own bot** so
the sender identity tells me which computer is talking. Full details in
`~/projects/dotfiles/telegram/README.md`. The `tg-*` commands are already on
PATH via `[dotfiles]`.

- [ ] In Telegram, create a bot for this machine via `@BotFather` → `/newbot`
  (unique, non-descriptive username ending in `bot`, e.g. `jl_relay_bot`).
  Optional: `/setjoingroups` → Disable, keep `/setprivacy` on.
- [ ] Get my numeric user id from `@userinfobot` (same on every machine).
- [ ] Message the new bot once (bots can't DM you until you've talked to them).
- [ ] `tg-setup` — stores the bot token + chat_id in the login Keychain,
  validates the token, sends a test.
- [ ] Send from anywhere: `tg-notify "message"` or `cmd 2>&1 | tg-notify`.

Creds live in the **local login Keychain** (`telegram-bot-token`,
`telegram-chat-id`), never in this repo and not iCloud-synced. Two-way bots
must allowlist my `from.id` — anyone can *send* to a bot.

## Phase 6: Development environment

### Restore projects

From the backup made with [BACKUP.md](BACKUP.md) (dotfiles are excluded — already cloned):

```bash
cp /Volumes/BACKUP_DRIVE/projects.tar.gz ~/
tar -xzvf ~/projects.tar.gz -C ~
rm ~/projects.tar.gz

# check restored .env files still have correct values
find ~/projects -maxdepth 2 -name ".env*" -type f
```

### CLI logins

- [ ] Heroku: `heroku login`
- [ ] AWS: `aws configure`, or set up SSO
- [ ] Claude Code: set `model` in `~/.claude/settings.local.json` (deliberately
      not in the tracked `settings.json`)

### Work machine only (`grafana`)

- [ ] gcloud components are not restored by the cask install:
  ```bash
  gcloud components install gke-gcloud-auth-plugin gcloud-crc32c
  ```
- [ ] Restore kubeconfig, or re-authenticate with each cloud provider

## Phase 7: By hand

- [ ] **Jump Desktop** (copied from `iCloud Drive/jump/` by bootstrap): import
      `iCloud Drive/jump/JumpDesktopServers.jdz` via File > Import
- [ ] **Time Machine**: plug in the backup drive, then
  ```bash
  sudo tmutil setdestination -a /Volumes/<drive>   # -a adds alongside any existing destination
  sudo tmutil enable
  tmutil destinationinfo                           # confirm
  ```
  If `setdestination` is refused, grant the terminal Full Disk Access
  (System Settings > Privacy & Security) or use System Settings > General >
  Time Machine instead.

---

## Verification

- [ ] `mise run check` — packages, dotfiles, macOS defaults and codex-skills, all read-only
- [ ] `mise bootstrap dotfiles diff` reports "all files are applied"
- [ ] `ls -la ~/.config/hive` points into iCloud `hive/<env>`
- [ ] `git commit --amend --no-edit` works (SSH signing via 1Password)
- [ ] Desktop/Documents folders show the iCloud sync icon
- [ ] Neovim plugins loaded: open nvim, run `:Lazy`
