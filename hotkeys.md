# Hotkeys & Aliases Cheat Sheet

## Tmux

**Prefix:** `C-q` or `C-Space`

### Windows & Panes
| Key | Action |
|-----|--------|
| `prefix c` | New window |
| `prefix ,` | Rename window |
| `prefix n/p` | Next/prev window |
| `prefix \|` | Split pane horizontally |
| `prefix -` | Split pane vertically |
| `C-w h/j/k/l` | Navigate panes (vim-style) |

### Sessions
| Key | Action |
|-----|--------|
| `prefix 1-9` | Switch to session by position |
| `prefix l` | Switch to `hive` session |
| `prefix $` | Rename session |
| `prefix s` | List/choose sessions |

### Copy Mode (vi)
| Key | Action |
|-----|--------|
| `prefix [` | Enter copy mode |
| `v` | Begin selection |
| `r` | Toggle rectangle selection |
| `y` | Copy selection → clipboard |
| `prefix P` | Paste buffer |

### Other
| Key | Action |
|-----|--------|
| `prefix r l` | Reload tmux config |
| `prefix I` | Install/update TPM plugins |

---

## Zsh / Readline (Terminal Input)

| Key | Action |
|-----|--------|
| `ctrl+w` / `opt+backspace` | Delete word backwards |
| `opt+d` | Delete word forwards |
| `ctrl+u` | Delete entire line |
| `ctrl+k` | Delete from cursor to end of line |

---

## Hive TUI

### Hard-coded (all views)
| Key | Action |
|-----|--------|
| `:` | Command palette |
| `tab` | Switch views |
| `q` | Quit |

### Sessions View
| Key | Action |
|-----|--------|
| `enter` | Open/attach tmux session |
| `n` | New session |
| `r` | Recycle session |
| `d` | Delete session |
| `R` | Rename session |
| `ctrl+d` | Kill tmux session |
| `A` | Send Accept (SendAccept) |
| `p` | Popup tmux session |
| `S` | Start tmux session in background |
| `J` | Jump to next active session |
| `K` | Jump to prev active session |
| `t` | Open todo panel |
| `v` | Toggle preview sidebar |
| `g` | Refresh git statuses |
| `ctrl+g` | Set session group |

### Tasks View
| Key | Action |
|-----|--------|
| `r` | Refresh |
| `f` | Cycle status filter |
| `y` | Copy task ID |
| `v` | Toggle preview |
| `s` | Select repo scope |
| `space` | Expand/collapse |
| `enter` / `l` | Open detail |
| `h` / `esc` | Back to tree |

### Palette-only commands (no default binding)
| Command | Description |
|---------|-------------|
| `FilterAll` | Show all sessions |
| `FilterActive` | Show sessions with active agents |
| `FilterApproval` | Show sessions needing approval |
| `FilterReady` | Show sessions with idle agents |
| `GroupToggle` | Toggle repo/group tree view |
| `SendBatch` | Send message to multiple agents |

---

## Git Aliases (`g <alias>`)

### Commit
| Alias | Command |
|-------|---------|
| `g ac` | `git add -A && git commit` |
| `g c` | `git commit` |
| `g ca` | `git commit --amend` |
| `g gm` | `git commit` (shell alias) |

### Diff & Log
| Alias | Command |
|-------|---------|
| `g d` | `diff --cached` (staged changes) |
| `g dm` | `diff master...HEAD --stat` |
| `g l` | `log -1 --stat` |
| `g lo` | `log --oneline` |
| `g lp` | `log --pretty=oneline` |
| `g lm` | `log master..HEAD --oneline` |
| `gdiff` | `git --no-pager diff` (shell alias) |

### Sync & Reset
| Alias | Command |
|-------|---------|
| `g p` | `pull` |
| `g fap` | `fetch --all --prune` |
| `g rom` | `fetch origin && rebase origin/main` |
| `g rr` | Hard reset to `origin/<current-branch>` |
| `g rb <branch>` | Hard reset to `origin/<branch>` |

### Branches
| Alias | Command |
|-------|---------|
| `g fc <hash>` | Find all branches containing commit |
| `g ib <hash> <branch>` | Check if commit is in branch |

### Meta
| Alias | Command |
|-------|---------|
| `g aliases` | List all git aliases |

---

## Shell Aliases

### Navigation
| Alias | Command |
|-------|---------|
| `..` / `...` / `....` | `cd` up 1/2/3 levels |
| `projects` | `cd ~/projects` |

### Tools
| Alias | Command |
|-------|---------|
| `v` / `nv` | `neovim` |
| `top` | `htop` |
| `rl` | `source ~/.zshrc` |
| `lg` | `lazygit` |

### Tmux
| Alias | Command |
|-------|---------|
| `hv` | Open/attach `hive` tmux session running `hive` |
| `t` | New tmux session named after current directory |

### Kubernetes
| Alias | Command |
|-------|---------|
| `k` | `kubectl` |
| `gk` | Grafana kubectl wrapper |

### AWS
| Alias | Command |
|-------|---------|
| `aws-ident` | `aws sts get-caller-identity` |
| `aws-unset` | Unset all AWS credential env vars |

### Go
| Alias | Command |
|-------|---------|
| `gor` | `go run` |
| `godoc <pkg>` | `go doc -u` piped to bat |
| `gosrc <pkg>` | `go doc -u -src` piped to bat |

### Docker
| Alias | Command |
|-------|---------|
| `cleandocker` | `docker system prune -f` |

### Obsidian
| Alias | Command |
|-------|---------|
| `obs` | Open Obsidian vault |

---

## Claude Code Skills

Skills are invoked with `/skill-name` in Claude Code.

| Skill | Description |
|-------|-------------|
| `/daily-prep` | Generate morning brief: open PRs, review queue, carryover tasks, yesterday summary. Writes to Obsidian daily note. |
| `/obsidian` | Save a document (research, plan, design doc) to `.hive/` context directory, which is symlinked into Obsidian. |
| `/summarize <url>` | Fetch and summarize a web article. |

### Daily Prep Workflow

1. Open Claude Code (or run from hive session)
2. Run `/daily-prep`
3. Claude gathers GitHub data (open PRs, reviews, merged PRs) from deployment_tools, bench, and recipinned
4. Creates/updates today's daily note in Obsidian at `Daily/YYYY-MM-DD - ddd.md`
5. Carries over incomplete tasks from yesterday

### Obsidian + Hive Integration

- `.hive/` in each repo is a symlink into the Obsidian vault (created by `hive ctx init`)
- Documents saved via `/obsidian` skill appear in Obsidian automatically
- Hive todos have an "obsidian" action to open items directly in Obsidian

---

## Obsidian Setup (Fresh Install)

1. **Install**: `brew install --cask obsidian` (already in Brewfile)
2. **Open Obsidian** and it should detect the "Notebook" vault in iCloud
   - If not: click "Open folder as vault" and select `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notebook`
3. **Enable community plugins**: Settings > Community plugins > Turn on community plugins
4. **Install plugins** (as needed): browse community plugins in Settings
5. **Verify Daily folder** exists in the vault sidebar
6. **Verify daily notes config**: Settings > Core plugins > Daily notes > Folder = `Daily`, Format = `YYYY-MM-DD - ddd`
7. **iCloud sync** handles the rest — config and notes sync to all devices automatically

### Environment

The vault path is exported in `.zshrc`:
```
OBSIDIAN_NOTEBOOK_DIR="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notebook"
```

This is used by the `daily-prep` skill and the `obs` shell alias.
