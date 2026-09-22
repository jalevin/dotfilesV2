# New Machine Setup Checklist

## Phase 1: Bootstrap (Terminal)

- [ ] Open Terminal.app
- [ ] Clone dotfiles (use HTTPS since SSH not configured yet):
  ```bash
  mkdir -p ~/projects
  git clone https://github.com/jalevin/dotfilesV2.git ~/projects/dotfiles
  ```
- [ ] Run bootstrap: `cd ~/projects/dotfiles && ./bootstrap.sh grafana`
      (or `personal` — this pins the machine's overlay)
  - Installs Xcode CLI tools
  - Creates a bare, user-owned `/opt/homebrew` (the only step needing sudo).
    **Homebrew itself is never installed** — mise pours brew bottles into that
    prefix itself and creates `Cellar/`, `Caskroom/`, `bin/` and the rest.
  - Installs mise (mise.run installer; upgrade via `mise self-update`)
  - Pins `MISE_ENV` for this machine (`mise run stamp`)
  - Runs `mise bootstrap --yes` (packages, `[dotfiles]` symlinks, macOS defaults,
    pinned tools, then the `bootstrap` task: fonts, neovim, tmux, install scripts)
  - Idempotent — safe to re-run on a configured machine
  - **Not headless**: `install/macos` needs Touch ID / a password for its sudo
    calls, so expect to authenticate a few times.
- [ ] Run one-time steps: `mise run first-run` (clears Dock, iCloud reminder)

## Phase 2: Apple ID & iCloud (System Settings)

- [ ] Sign in to Apple ID (if not done during macOS setup)
- [ ] **iCloud Drive - Desktop & Documents**
  - System Settings > Apple ID > iCloud > iCloud Drive > Options
  - Enable "Desktop & Documents Folders"
  - Wait for sync to complete
- [ ] iCloud Keychain: System Settings > Apple ID > iCloud > Passwords & Keychain
- [ ] Find My Mac: System Settings > Apple ID > iCloud > Find My Mac

## Phase 3: Security & Privacy

- [ ] **Touch ID**: System Settings > Touch ID & Password > Add fingerprints
- [ ] **Touch ID for sudo**: Already configured by `install/macos` script
- [ ] FileVault: System Settings > Privacy & Security > FileVault (likely already on)

## Phase 4: App-Specific Setup

### 1Password
- [ ] Open 1Password, sign in to account(s)
- [ ] Enable Safari extension
- [ ] System Settings > Privacy & Security > Accessibility > 1Password (for autofill)
- [ ] Configure SSH Agent: 1Password > Settings > Developer > SSH Agent
- [ ] Enable CLI integration: 1Password > Settings > Developer > "Integrate with 1Password CLI"
- [ ] Test CLI: `op account list`

### CleanShot X
- [ ] Open CleanShot, enter license key (stored in 1Password)
- [ ] System Settings > Privacy & Security > Screen Recording > CleanShot X
- [ ] System Settings > Privacy & Security > Accessibility > CleanShot X
- [ ] Configure hotkeys in CleanShot preferences (system shortcuts already disabled by macos script)

### Rectangle
- [ ] Open Rectangle, grant accessibility permissions
- [ ] Import settings if backed up, or configure shortcuts

### Ghostty
- [ ] Config already symlinked via `[dotfiles]`
- [ ] Set as default terminal if desired

### Docker / OrbStack
- [ ] Open OrbStack (or Docker Desktop), complete setup
- [ ] Sign in to Docker Hub if needed

### Slack / Discord / Signal
- [ ] Sign in to each app

### Telegram agent notifications (per-machine bot)

Local agents message my phone via Telegram. **Each machine has its own bot** so
the sender identity tells me which computer is talking. Full details in
`~/projects/dotfiles/telegram/README.md`. Setup per machine:

- [ ] In Telegram, create a bot for this machine via `@BotFather` → `/newbot`
  (unique, non-descriptive username ending in `bot`, e.g. `jl_relay_bot`).
  Optional: `/setjoingroups` → Disable, keep `/setprivacy` on.
- [ ] Get my numeric user id from `@userinfobot` (same on every machine).
- [ ] Message the new bot once (bots can't DM you until you've talked to them).
- [ ] Store creds in the login Keychain: `tg-setup`
  (prompts for the bot token + chat_id; validates the token; sends a test).
- [ ] Send from anywhere: `tg-notify "message"` or `cmd 2>&1 | tg-notify`.

Notes:
- Creds live in the **local login Keychain** (items `telegram-bot-token`,
  `telegram-chat-id`), never in this repo and not iCloud-synced. `tg-setup` and
  `tg-notify` are identical across machines; only the Keychain contents differ.
- Agents run as my user, so they can call `tg-notify` directly — no extra
  grants needed.
- Two-way bots must allowlist my `from.id` in their handler — anyone can *send*
  to a bot; the code decides what to act on.

### Tuple
- [ ] Sign in, grant screen recording & microphone permissions

### Obsidian
- [ ] Open vault from iCloud Drive (should sync automatically once iCloud Desktop & Documents is enabled)

### Visual Studio Code
- [ ] Sign in with GitHub/Microsoft for Settings Sync
- [ ] Or manually install extensions

### Brave / Chrome
- [ ] Sign in to sync bookmarks and extensions

## Phase 5: Development Environment

### Restore Projects

```bash
# Copy projects.tar.gz from backup drive to home directory
cp /Volumes/BACKUP_DRIVE/projects.tar.gz ~/

# Extract (dotfiles excluded from tar, already cloned in Phase 1)
tar -xzvf ~/projects.tar.gz -C ~

# Clean up
rm ~/projects.tar.gz
```

### Validate .env Files

Check that .env files restored from backup have correct values:

```bash
find ~/projects -maxdepth 2 -name ".env*" -type f
```

### Secrets from 1Password
- [ ] Sign in to 1Password CLI: `eval $(op signin)`
- [ ] Fetch secrets: `mise run secrets-pull`
  - Pulls `~/.ssh/config` from 1Password document "ssh-config"
  - Pulls `/etc/hosts` from 1Password document "hosts-file"

### Git & GitHub
- [ ] Verify git config: `git config --list`
- [ ] SSH key via 1Password should work automatically after 1Password SSH Agent setup
- [ ] Test: `ssh -T git@github.com`
- [ ] Switch dotfiles remote to SSH:
  ```bash
  cd ~/projects/dotfiles
  git remote set-url origin git@github.com:jalevin/dotfilesV2.git
  ```
- [ ] Authenticate GitHub CLI: `gh auth login`

### Heroku
- [ ] Authenticate: `heroku login`

### AWS
- [ ] Configure credentials: `aws configure` or set up SSO

### Kubernetes
- [ ] Copy/restore kubeconfig if needed
- [ ] Or re-authenticate with cloud providers

### Language Runtimes (managed by mise)
- [ ] Node: `mise install node`
- [ ] Python: `mise install python`
- [ ] Go: `mise install go`
- [ ] Ruby: `mise install ruby`

## Phase 6: Optional / As Needed

### Tailscale
- [ ] Open Tailscale, sign in

### Jump Desktop
- [ ] Install from iCloud (license stored there) or re-download
- [ ] Import connection configs

### Fonts (if not installed via mise run fonts)
- [ ] Copy any additional fonts to ~/Library/Fonts

### Time Machine
- [ ] Connect backup drive
- [ ] System Settings > General > Time Machine > Add Backup Disk

---

## Adopting a machine that already has apps and configs

Use this instead of Phase 1 when the machine is already set up by hand (e.g.
migrating the personal laptop). The goal is to hand existing packages and apps
to mise **without** reinstalling them.

- [ ] Clone the repo and install mise (Phase 1 steps, but **stop before**
      `./bootstrap.sh`)
- [ ] Ensure `/opt/homebrew` is user-owned. If Homebrew is already installed it
      will be; otherwise:
      ```bash
      sudo mkdir -p /opt/homebrew && sudo chown "$(id -un):admin" /opt/homebrew
      ```
- [ ] Pin the machine's overlay: `MISE_ENV=personal mise run stamp`
- [ ] `mise trust`

### Reconcile the config symlinks

`[dotfiles]` will not overwrite a real file that already exists at a target
path. Preview first, then move anything you want replaced out of the way:

```bash
mise bootstrap dotfiles diff      # shows every conflict before touching anything
mise run dotfiles                 # apply
```

### Formulae adopt themselves

mise reads Homebrew's `Cellar` and receipts directly, so anything already
installed reports `installed` with no re-download. Check for genuine gaps:

```bash
mise bootstrap packages status | grep -v installed
mise bootstrap packages apply --manager brew
```

### Casks need their Homebrew receipt dropped

While a cask carries brew's receipt, mise defers to it
(`installed and managed by Homebrew; leaving unchanged`). Dropping the receipt
lets `[bootstrap.brew] adopt = true` take the app **in place** — mise downloads
the artifact only to verify, then keeps the existing bundle, so macOS
permission grants survive.

An app cask's Caskroom entry is only a symlink marker, so this never touches the
app. Verify that before deleting:

```bash
# confirm it is a symlink, not a real bundle
find /opt/homebrew/Caskroom/<cask> -mindepth 2 -maxdepth 2

rm -rf /opt/homebrew/Caskroom/<cask>
mise bootstrap packages apply --manager brew-cask
```

Two cases cannot adopt and need a real install (which replaces the bundle):

- the app is **outdated and not self-updating** — content differs, so adoption
  fails. The real install brings it current, which it needed anyway.
- the cask declares an artifact the installed bundle lacks. `obsidian` is pinned
  `adopt = false` for exactly this reason.

### Reconcile drift

Brew's receipts drift. On the work machine, four were wrong: one pointed at an
app version no longer installed, and three claimed apps that weren't on disk at
all. Check every declared cask actually exists, and fix the declaration rather
than the symptom:

```bash
for d in /opt/homebrew/Caskroom/*/; do
  l=$(find "$d" -mindepth 2 -type l | head -1)
  [ -n "$l" ] && [ ! -e "$(readlink "$l")" ] && echo "DANGLING: $(basename "$d")"
done
```

- [ ] Finally, run `./bootstrap.sh personal` to converge everything else
- [ ] Work through Phase 4 onward for anything app-specific

---

## Verification

After setup, verify:
- [ ] `mise bootstrap packages status` shows everything `installed`
- [ ] `mise bootstrap dotfiles diff` reports "all files are applied"
- [ ] `ls -la ~/.config` shows symlinks pointing to dotfiles
- [ ] `git commit --amend --no-edit` works (SSH signing via 1Password)
- [ ] Desktop/Documents folders show iCloud sync icon
- [ ] Neovim plugins loaded: open nvim, run `:Lazy`
