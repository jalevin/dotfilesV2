# Machine Backup Checklist

Run these steps before wiping/resetting a machine.

## 1. Time Machine Backup

- [ ] Connect Time Machine drive
- [ ] System Settings > General > Time Machine > Back Up Now
- [ ] Wait for backup to complete

## 2. Projects Archive

```bash
# Creates ~/projects.tar.gz (excludes large/generated dirs and dotfiles which is in git)
tar --exclude='go' \
    --exclude='.go' \
    --exclude='node_modules' \
    --exclude='vendor' \
    --exclude='tmp' \
    --exclude='.gems' \
    --exclude='dotfiles' \
    -czvf ~/projects.tar.gz -C ~ projects
```

Copy `projects.tar.gz` to external drive or cloud storage.

## 3. Secrets to 1Password

```bash
cd ~/projects/dotfiles
eval $(op signin)
mise run secrets-push
```

This uploads:
- `~/.ssh/config` → 1Password document "ssh-config"
- `/etc/hosts` → 1Password document "hosts-file"

## 4. Verify

- [ ] Time Machine backup completed successfully
- [ ] `projects.tar.gz` copied to safe location
- [ ] `mise run secrets-check` shows all secrets in sync
- [ ] Any app-specific exports (Alfred preferences, etc.)
