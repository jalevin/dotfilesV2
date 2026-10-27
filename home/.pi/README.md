# Pi configuration

Pi extensions live in `home/.pi/agent/extensions/` and deploy individually through
mise. Authentication, settings, and sessions stay local to the machine.

## Setup and skills

After installing Pi, run `mise run pi-setup`. It links the 21 tracked shared skills,
installs the pinned packages from `home/.pi/setup.json`, and configures Hive Drive
MCP through Pi's CLI. Bootstrap also runs it. Existing model, authentication, theme,
and unrelated package/server preferences are preserved. `CHECK=1 mise run pi-skills`
reports skill-link drift without changing anything; both Pi and Codex use
`tasks/link-agent-skills.sh`, with `git ls-files` as the source of the skill list.

Run `/reload` in an open Pi session after deploying changes. Start a prompt with
`$` to open the skill menu, type part of a name, and select it with Tab/Enter:

```text
$review https://github.com/owner/repo/pull/123
$design-review https://github.com/owner/repo/pull/123
```

The extension converts a leading, recognized `$name` into Pi's native
`/skill:name` before skill expansion. `/skill:review` and `/skill:design-review`
continue to work. Ordinary shell variables such as `$HOME` are left alone.
Skill descriptions also support natural-language selection by the model.

`pi-subagents` provides delegation, and the Pi `diff-reviewer` profile reads its
shared contract from `~/.ai/agents/diff-reviewer.md`. It defaults to fresh context
and inherits the selected model. `pi-web-access` provides web research. These are
pinned in the setup manifest; update the pins deliberately rather than using
`pi update` to move managed packages independently.

Hive Drive connects to `http://127.0.0.1:50505/mcp/drive`, verified against this
machine's running Hive. Inspect it with `pi mcp list` or `/mcp`; update the setup
manifest if Hive's configured port changes. Models can discover the canvas tools
through Pi's built-in codemode. Session identity must follow the tool schemas;
connecting the server does not authorize writing to another session's canvas.

## Questions, Plannotator, and handoffs

The `ask_user_question` tool presents Hayden's structured question UI in the TUI,
including multi-select, custom answers, and “Chat about this.” Hive RPC clients
use Pi's native select/input dialogs. Ask Pi to use structured questions when
you want to work through a decision.
In the TUI, Tab/Down moves to the next option and Shift-Tab/Up moves to the
previous option. Enter selects; multi-select also supports Space to toggle.

- `/review:code [PR/MR URL]` opens Plannotator for the local diff or an explicit PR.
- `/review:doc [path or URL]` gates a document; no argument offers recent documents
  under `.hive/plans`, `.hive/research`, and `.hive/reviews`.
- `/review:cancel` cancels the open Plannotator session.
- `/handoff <goal>` generates a focused handoff using the current model, then opens
  it for editing. Saving starts a linked fresh session and submits the edited text;
  cancelling stays in the current session.
- `/handoff-auto <goal>` skips the preview and continues immediately.
- `/handoff cancel` cancels generation. Handoffs retain the latest compaction and
  recent conversation; the old session remains available. The summary uses a model
  call. CI repair authorization must be renewed in the fresh session.

Question and handoff extensions were adapted from `hayden-dotfiles`. Plannotator
results return to the originating session; cancellation, process errors, and session
changes do not become repair requests. External replies still require text approval.

Validate with `node --test tasks/pi-*.test.mts`, `bash -n tasks/link-agent-skills.sh`,
and `mise exec -- go vet tasks/pi-setup.go`. No live model call, browser review,
GitHub write, or canvas write is required by these checks.

## Theme

The `codex` dark theme uses Catppuccin Mocha; `codex-light` uses Catppuccin Latte.
Both use Codex's blue UI accents. The terminal still owns the overall background;
Pi's widgets and syntax colors are adapted to its own theme roles.

Select `codex-light/codex` for automatic light/dark switching, or just `codex` for
dark-only, through Pi's `/settings` → Theme. The selection is a local Pi preference.
Theme files deploy individually through mise and do not replace Pi's settings file.

The input editor uses a filled gray box with a blue `>` prompt, following Codex's
layout. It retains Pi's native editing, history, paste, and autocomplete behavior.
The neutral gray background adapts to light/dark themes, with one filled padding
row above and below the input and a separate blank row below the status line. Run `/reload`
after deploying `home/.pi/agent/extensions/editor.ts` to apply the editor.

The footer uses Codex's syntax-based accents: model/effort from type colors,
context and cost from numeric colors, branch from function colors, and directory
from string colors. These are softened to 85% saturation without dimming, matching
the installed Codex 0.161.0 styling. High context usage retains amber/red warnings.

References: [Codex theme selection](https://github.com/openai/codex/blob/rust-v0.161.0/codex-rs/tui/src/render/highlight.rs),
[status-line styling](https://github.com/openai/codex/blob/rust-v0.161.0/codex-rs/tui/src/bottom_pane/status_line_style.rs),
and [Catppuccin palettes](https://github.com/catppuccin/bat/tree/main/themes).

## CI monitoring

`home/.pi/agent/extensions/ci-watch/` is a native Pi extension, linked individually
into `~/.pi/agent/extensions/ci-watch` by mise. Pi's settings, authentication, and
sessions remain machine-local. Reload Pi extensions with `/reload` after deployment.

- `/ci-watch [PR number | GitHub PR URL]` monitors CI and review feedback. With no
  target it finds the open PR for the current branch; if none exists, it offers
  branch CI monitoring. An explicit URL can be watched from another checkout.
- `/ci-fix [PR number | GitHub PR URL]` additionally authorizes verified repairs,
  tests, commits, and pushes for that PR. It requires a clean checkout at the PR's
  head, matching branch and upstream repository. A mismatch offers checkout, an
  isolated Hive session, or watch-only mode. It never resets or stashes changes.
- Both commands accept `status`, `stop`, and `help`. They poll every five minutes
  without model calls while waiting and continue after green. Closing the PR or
  Pi session stops monitoring. The widget distinguishes WATCH and FIX modes.
- Fixes start only while Pi is idle. Each failure/head or feedback revision is
  handled once; three repair attempts pause fixes while retaining watch mode.
  Reissuing `/ci-fix` renews the attempt budget without forgetting handled items.
- Replies, submitted reviews, and thread resolution require separate approval.
  Switching to watch or stopping monitoring lets an already-started repair finish.

Validate with `node --test tasks/pi-ci-watch.test.mts` (Node 24's native TypeScript
support; no additional npm dependencies). Pi loads the extension's TypeScript with
its own loader. GitHub access uses `gh`; no Claude-specific script paths are used.

## Footer

`home/.pi/agent/extensions/footer/` replaces Pi's interactive footer with one line:
model/effort, context used/limit/percentage, branch, working directory, and estimated
session cost, all aligned left. Theme colors distinguish the fields; context turns
amber at 70% and red at 90%. Unknown usage after compaction stays `?`. Narrow panes
shorten the directory first. Cost sums Pi's recorded usage, including compaction and
tool usage, and is an estimate rather than a subscription bill.
The CI widget remains separate, and other extensions' status messages are retained.

Deploy its individual mise entry and run `/reload` in Pi. Validate layout and lifecycle
with `node --test tasks/pi-footer.test.mts`; these tests use the installed Pi runtime.
