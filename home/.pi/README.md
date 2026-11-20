# Pi configuration

Pi extensions live in `home/.pi/agent/extensions/` and deploy individually through
mise. Authentication, settings, and sessions stay local to the machine.

## Setup and skills

Pi reads `home/.ai/AGENTS.md` from `~/.pi/agent/AGENTS.md`, so the shared instructions
apply even outside your home directory. Under `~`, Pi also finds `~/AGENTS.md` (kept for
Cursor and Amp). Pi only skips a context file whose path repeats, so the
`context-dedupe.ts` extension drops files that resolve to the same real file and keeps
the first. Run `/reload` after editing the instructions.

After installing Pi, run `mise run pi-setup`. It links the tracked shared skills,
installs the pinned packages from `home/.pi/setup.json`, and configures MCP servers
through Pi's CLI. Bootstrap also runs it. Existing model, authentication, theme,
and unrelated package/server preferences are preserved. `CHECK=1 mise run pi-skills`
reports skill-link drift without changing anything; both Pi and Codex use
`tasks/link-agent-skills.sh`, with `git ls-files` as the source of the skill list.

Run `/reload` in an open Pi session after deploying changes. Start a prompt with
`$` to open the skill menu, type part of a name, and select it with Tab/Enter:

```text
$dev-review https://github.com/owner/repo/pull/123
$dev-research how does auth refresh work
```

The extension converts a leading, recognized `$name` into Pi's native
`/skill:name` before skill expansion. `/skill:dev-review` and the
other `/skill:` forms continue to work. Ordinary shell variables such as `$HOME` are left alone.
Skill descriptions also support natural-language selection by the model.

### Where the startup entries come from

| Entries | Source |
| --- | --- |
| Shared skills such as the `dev-*` lifecycle | Tracked under `home/.ai/skills/` and linked by `mise run pi-skills` |
| `pi-subagents`, `council-mode`, and all six bundled prompts (`/council`, `/gather-context-and-clarify`, `/parallel-cleanup`, `/parallel-research`, `/parallel-review`, `/review-loop`) | The installed `pi-subagents` package |
| `pi-intercom` | The installed `pi-intercom` package |
| Skills shown as `auto (user)` under `~/.agents/skills/` | Discovered directly by Pi, outside this repo's managed skill links |

The `dev-*` skills cover the development lifecycle described in
`home/.ai/AGENTS.md`: `$dev-review` for code review and `$dev-babysit` to
follow a PR through CI and review feedback. Plannotator's `/review:code` and `/review:doc` commands open the
annotation UI. Package prompts such as `/parallel-review` keep their upstream names.

The locally installed `agento11y-instrument` comes from Grafana's gcx skill
bundle in `~/.agents/skills/`. Its description exceeds Pi's 1024-character limit;
the startup warning identifies a metadata problem in that external copy. This
repository neither installs nor updates it.

`pi-subagents` provides delegation and bundled agents, including `reviewer` for
code and plan review and `oracle` for design questions and second opinions. Their
prompts live in the installed package's `agents/` directory, normally
`~/.pi/agent/npm/node_modules/pi-subagents/agents/`; no separate skill install or
copy is needed. Inspect the available agents with `/subagents`.

The custom Pi `diff-reviewer` profile reads its shared contract from
`~/.ai/agents/diff-reviewer.md`. It defaults to fresh context and inherits the
selected model. It is separate from the package's bundled `reviewer`.

`pi-intercom` adds communication between local Pi sessions and integrates with
subagents for parent/child questions through `contact_supervisor`. Start or reload
Pi after installation. Use `/alias api-worker` to name a session, then `/intercom`
or Alt+M to choose another connected session and send it a message. Both sessions
must have the extension loaded. The broker starts automatically; its state stays
local under `~/.pi/agent/intercom/`, outside the repo. Hive still manages sessions.

For a parallel review, ask Pi to use the bundled `reviewer` for implementation
bugs and tests and `oracle` for the approach and design. Give each agent the exact
diff or commit range, requirements, and any PR stack boundaries, then ask the
parent to reconcile their findings. Repository-specific checks, such as AI SDK
parity review, belong in that repository's own skills.

`pi-web-access` provides web research. Packages are pinned in the setup manifest;
update the pins deliberately rather than using `pi update` to move managed
packages independently.

### MCP servers

`home/.pi/setup.json` lists servers for both machines. `setup.grafana.json` and
`setup.personal.json` are overlays selected by `MISE_ENV`: an entry adds or
replaces a server, and `null` removes it, so switching a machine cleans up the
other machine's servers. Servers you add by hand are left alone.

| Server | Machines | Notes |
| --- | --- | --- |
| `hive-drive` | both | Hive canvases, documents, and layout (`127.0.0.1:50505/mcp/drive`) |
| `hive-desktop` | both | Hive sessions, workspaces, inbox, actions, and schedules (`127.0.0.1:50505/mcp`) |
| `airbud` | Grafana | Sign in once with `pi mcp login airbud` |
| `slack` | Grafana | Sign in once with `pi mcp login slack`. Slack has no dynamic client registration, so this reuses the Claude Slack plugin's published client ID (callback port 3118); Slack shows the session as that app |
| `grafana-enghub` | Grafana | Runs from Claude's `grafana-ai-kit` marketplace checkout; signs in through a browser window on first use and stores it in `~/.enghub-mcp/` |

All use `codemode` exposure: tools are called from codemode scripts instead of
being declared to the model. Each server's `description` is what tells the model
the server exists — Pi lists it in the system prompt — so keep it specific.
Update the manifest if Hive's port changes. Session identity must follow the tool
schemas; connecting a server does not authorize writing to another session's canvas.

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

The `codex` dark theme matches colors sampled from Codex in this terminal: body text
uses the terminal's default foreground, secondary text uses neutral grays (`#a9aaad`,
`#949699`), user messages sit on a `#4b4d53` band, the prompt on `#42454b`, and tool
rows have no background except errors. Syntax and footer accents keep Catppuccin Mocha
hues, which already match Codex. `codex-light` uses Catppuccin Latte.
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

## Status line

`home/.pi/agent/extensions/statusline/` replaces Pi's interactive footer with one line:
working directory, branch, model/effort, context remaining (for example
`Context 88% left`), and estimated session cost in purple, all aligned
left. Theme colors distinguish the fields; context turns amber at 70% used and red
at 90% used. Unknown usage after compaction stays `?`. Narrow panes
shorten the directory first. Cost sums Pi's recorded usage, including compaction and
tool usage, and is an estimate rather than a subscription bill.
The CI widget remains separate, and other extensions' status messages are retained.

Deploy its individual mise entry and run `/reload` in Pi. Validate layout and lifecycle
with `node --test tasks/pi-statusline.test.mts`; these tests use the installed Pi runtime.
