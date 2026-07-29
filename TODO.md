# TODO

## mise bootstrap migration

Migrating machine setup to declarative [`mise bootstrap`](https://mise.jdx.dev/bootstrap.html)
(stable since v2026.7.4). Done so far: mise self-managed via mise.run
(`mise self-update` to upgrade), `bootstrap.sh` idempotent, one-time steps in
`mise run first-run`.

- [ ] Convert `install/macos` → `[bootstrap.macos.*]` sections in `mise.toml`
      (dock/finder/keyboard/defaults; gets drift detection via
      `mise bootstrap status` / `mise doctor`). Keep as hooks/scripts: PlistBuddy
      symbolic-hotkey edits, Touch ID PAM setup, `sudo chflags`, Dock/SystemUIServer
      restarts (`post-defaults` hook).
- [ ] Migrate GNU Stow → `[dotfiles]` (`mise dotfiles add` to seed; `symlink` mode
      mirrors current behavior). Retires stow and the `brew install stow` line in
      `bootstrap.sh`.
- [ ] Migrate Brewfile → `[bootstrap.packages]` (`mise bootstrap packages import`
      snapshots installed formulae; `mas:` entries supported). Cask-adoption
      metadata bug fixed in jdx/mise#11012 — verify casks adopt cleanly before
      switching `upgrade-apps`.
- [ ] End state: fresh machine = install mise + `mise bootstrap --yes`; slim
      `bootstrap.sh` to a Xcode CLT + mise.run + `mise bootstrap` shim.

## Misc

- [ ] `mise doctor` suggests migrating npm tool backend: `npm:npm` → `aqua:npm/cli`
      (`mise uninstall --all npm && mise install npm`)
