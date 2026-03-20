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
