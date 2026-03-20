# New Machine Setup Checklist

## Phase 1: Bootstrap (Terminal)

- [ ] Open Terminal.app
- [ ] Clone dotfiles (use HTTPS since SSH not configured yet):
  ```bash
  mkdir -p ~/projects
  git clone https://github.com/jalevin/dotfilesV2.git ~/projects/dotfiles
  ```
- [ ] Run bootstrap: `cd ~/projects/dotfiles && ./bootstrap.sh`
  - Installs Xcode CLI tools
  - Installs Homebrew
  - Installs mise + stow
  - Runs `mise run setup` (brew packages, stow symlinks, fonts, neovim plugins, macOS defaults)

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

### Alfred
- [ ] Open Alfred, enter license key (stored in 1Password or iCloud)
- [ ] Set preferences sync folder (if using iCloud/Dropbox sync):
  - Alfred Preferences > Advanced > Set preferences folder
  - Point to `~/Library/Mobile Documents/com~apple~CloudDocs/Alfred` (or your sync location)
- [ ] System Settings > Privacy & Security > Accessibility > Alfred
- [ ] Spotlight hotkey (Cmd+Space) already disabled by `install/macos` - Alfred can use it

### CleanShot X
- [ ] Open CleanShot, enter license key (stored in 1Password)
- [ ] System Settings > Privacy & Security > Screen Recording > CleanShot X
- [ ] System Settings > Privacy & Security > Accessibility > CleanShot X
- [ ] Configure hotkeys in CleanShot preferences (system shortcuts already disabled by macos script)

### Rectangle
- [ ] Open Rectangle, grant accessibility permissions
- [ ] Import settings if backed up, or configure shortcuts

### Ghostty
- [ ] Config already symlinked via stow
- [ ] Set as default terminal if desired

### Docker / OrbStack
- [ ] Open OrbStack (or Docker Desktop), complete setup
- [ ] Sign in to Docker Hub if needed

### Slack / Discord / Signal
- [ ] Sign in to each app

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

## Verification

After setup, verify:
- [ ] `brew list` shows expected packages
- [ ] `ls -la ~/.config` shows symlinks pointing to dotfiles
- [ ] `git commit --amend --no-edit` works (SSH signing via 1Password)
- [ ] Desktop/Documents folders show iCloud sync icon
- [ ] Neovim plugins loaded: open nvim, run `:Lazy`
