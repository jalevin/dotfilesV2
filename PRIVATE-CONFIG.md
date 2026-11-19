# Private configuration

Portable SSH configuration is tracked in place by mise and synced manually to
`git@github.com:jalevin/dotfiles-private.git`. The public dotfiles repository
contains the tracking declarations and tasks, but no SSH file contents.

The initial files are `~/.ssh/config`, `~/.ssh/homesrv-hive.conf`,
`~/.ssh/homesrv-hive.known_hosts`, and `~/.ssh/homesrv-hive-key-0.pub`.
They apply to both laptops. Private SSH keys stay in 1Password; Hive API
credentials and Claude authentication stay on the VM. Contents in the private
repository are not encrypted by mise. Do not add credentials or recovery keys
to this history.

## Daily use

From `~/projects/dotfiles`:

```sh
mise run private-config:status
mise run private-config:push  # save local edits, then push and fetch
mise run private-config:pull  # fetch, then apply incoming changes
```

There is no watcher and no automatic network sync. Fetching does not change
live files; pulling does. If both laptops changed a file, mise stops for
conflict resolution. Inspect with `mise dot conflicts <path>`, edit and save
the desired contents, then resolve with `mise dot pull --keep-local <path>`.
To accept the remote version instead, back up local edits first and use
`mise dot pull --take-remote <path>`.

The 1Password SSH documents remain a fallback until the second laptop has
been verified. Avoid using both systems to edit the same files. `/etc/hosts`
and the personal age key still use the existing 1Password tasks.

## Another laptop

1. Install/update mise to at least 2026.10.21 and set up the public dotfiles
   repository in `~/projects/dotfiles`, with the appropriate machine profile.
2. Sign into 1Password and enable its SSH agent. Authenticate GitHub so the
   private repository can be read. `gh auth login` can use HTTPS before SSH
   configuration is restored; check local Git URL rewrites if Git still uses SSH.
3. Back up any existing copies of the four SSH files. Inspect `mise dot paths`,
   `mise dot history`, and `mise dot origin` before adopting. Do not run
   `mise dot save` on a new laptop before adopting the shared history.
4. Adopt the private history without installing packages or running setup tasks:

   ```sh
   cd ~/projects/dotfiles
   mise bootstrap --adopt git@github.com:jalevin/dotfiles-private.git --only dotfiles
   mise settings history.sync=manual
   mise dot status
   ```

   Review any conflicts. Do not use `--replace-history` or `--take-remote-all`
   without first inspecting and backing up the local state. If the machine
   already has unrelated mise history, resolve that explicitly before adopting.
5. Check `ssh -G homesrv-hive-direct`, connect with
   `ssh homesrv-hive-direct` while on the personal tailnet, and test Hive Desktop.
   Use the jump-host alias `homesrv-hive` when the network path requires it.

After successful verification on both laptops, remove the four SSH entries
from the custom 1Password sync list. Keep the old documents temporarily as a
fallback.

## Profiles and local files

The initial SSH files are shared. For a future work-only or personal-only
path, use `mise dot track <path> --profile grafana` or `--profile personal`.
Profiles control application, not access to the repository's history.
Use `mise dot track --local <path>` for history that must never leave a laptop.
Every newly tracked path is saved immediately, so review it before tracking.

Connection settings live in the ignored
`home/.config/mise/config.local.toml`; history lives under
`~/.local/state/mise/history`. Do not connect the public dotfiles repository
as the history origin.
