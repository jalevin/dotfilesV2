---
name: hive-actions
description: "Define the actions a feed item, a terminal session or window, or a flow node can trigger — launching an agent session, running a shell command, publishing a message, or copying text to the clipboard. Use when configuring this in Hive Desktop (/Users/jeff/.config/hive/desktop/actions.yml)."
---
Define Hive Desktop actions.

Hive Desktop is a desktop app that turns GitHub activity and webhook deliveries
into triaged feeds and automated coding-agent sessions. Its configuration is
plain text on this machine, meant to be edited directly:

- /Users/jeff/.config/hive/desktop/flows/<id>.yaml — flows: the graph that decides what reaches which feed and what fires an action.
- /Users/jeff/.config/hive/desktop/actions.yml — actions: what a feed item, a terminal session or window, or a flow node can trigger.
- /Users/jeff/.config/hive/desktop/settings.yaml — app settings: polling, updates, notifications, appearance, keyboard shortcuts.

Write the actions to /Users/jeff/.config/hive/desktop/actions.yml.

The file holds two lists. An **action** is something the app can trigger on your
behalf: it shows up as a button in the detail pane when a feed item is selected,
in the row menus of terminal mode's sessions and windows, and as the target of a
flow `action` node, which fires it automatically for every message routed there.
A **launcher** opens the pop-up terminal into a program and is documented under
"Launchers" below.

Rules for every file above:

- The schema is strict: an unknown key is a hard error, not a warning. Do not invent fields.
- The app watches these files and reloads on save — no restart, no build step.
- A file that fails to parse is rejected as a whole and the last good version stays live, so a mistake degrades to "nothing changed" rather than a broken app.

## Top-level schema

- `version` — must be `1`.
- `actions` — the list, in presentation order: every surface that offers actions — the detail pane, the item action menu, and terminal mode's session and window row menus — presents the applicable ones in the order they appear here. Every action has:
  - `id` — a slug (lowercase letters, digits, hyphens, starting with a letter or digit), unique across the file. This is what a flow `action` node references.
  - `label` — the human-readable name shown on the button.
  - `type` — one of the action types documented below.
  - `targets` — optional list of the surfaces this action is offered on: `item` (a feed item), `session` (a terminal session's row menu), `window` (a terminal window's row menu). Omit it for an item action — that is the default, and it is what every action written before terminal mode means. A `launch-session` action cannot target `session` or `window`: it creates a new session, and there is no New Session form on those surfaces.
  - `applies_to` — optional list of item kinds this action is offered for in the detail pane (e.g. `[pr]`, `[issue]`, or a webhook item's own `kind`). Empty means any kind. It refines the `item` target only — a terminal target has no item kind — and it does not restrict flow `action` nodes, which target one id explicitly.
  - `show_in_detail` — whether the detail pane offers it as a manual button. It too refines the `item` target only. Flow `action` nodes can target the action either way.
  - `inputs` — optional list of values collected from the user when the action is run, each `{name, label, type, required, default, placeholder, options}`. `name` must be a template identifier (letters, digits, underscores) because it is read as `{{ .Inputs.<name> }}`; `type` is `text` (default), `multiline`, or `select`; `options` is required for — and only valid on — a `select`, and a `default` must be one of them. An action with a required input that has no default can only be run by a person — from the detail pane or a terminal row menu; a flow `action` node cannot fire it, because there is nobody to ask.
  - plus that type's own fields, **flattened at the same level** — not nested under a `config:` key.
- `launchers` — the other list, in palette order. A launcher is not an action and carries none of the keys above beyond `id` and `label`; see "Launchers" below for its schema.

## Template data

Every `*_template` field is a Go `text/template` rendered over whatever the
action was invoked against. **Which values exist depends on the target**, so a
template that reads the wrong target's data fails the run rather than rendering
a blank command.

On the `item` target — a feed item, in the detail pane or from a flow `action`
node:

- `{{ .Payload.<field> }}` — the item's payload. GitHub items carry `repo`, `title`, `url`, `num`, `author`, `body`, `labels`, and `state`; webhook items carry whatever was POSTed.
- `{{ .Key }}` — the item's stable identity, e.g. `colonyops/hive#2841`.
- `{{ .Raw }}` — the payload as raw JSON.

On the `session` and `window` targets — a terminal session row, or a window row
inside it:

- `{{ .Session.Path }}` — the session's checkout on disk. This is also the default working directory of a `shell` action run from a terminal target, so a command that just works in the checkout does not have to name it.
- `{{ .Session.Slug }}` — the session's slug, which is also its tmux session name.
- `{{ .Session.Name }}`, `{{ .Session.ID }}`, `{{ .Session.Repo }}`, `{{ .Session.Branch }}` — the session's name, hive id, remote, and worktree branch (blank for a session that is not a worktree).
- `{{ .Window.ID }}` — the tmux window id, on the `window` target only. Addressed as `{{ .Session.Slug }}:{{ .Window.ID }}` in a tmux command. There is no window name: the id survives a rename and the name does not.
- `{{ .Key }}` — the session's slug.

On every target:

- `{{ .Inputs.<name> }}` — a value the user typed or chose when running the action, for each input the action declares. Undeclared names are a render error, so declare what you reference.

## Action types

### Clipboard — `clipboard`

A **clipboard** action renders a template over whatever it was invoked against
and puts the result on the clipboard. Use it for "get me a ready-to-paste
command" — a `gh pr checkout`, a session's checkout path, a branch name, a
link — without shelling out to `pbcopy`.

#### Fields

- `text_template` (required) — the text placed on the clipboard.

#### Templates

`text_template` is a Go `text/template` rendered over the target's data (see
"Template data" above), the same context a shell action's `command_template`
renders over. The `shq` helper is available, though clipboard text is not run
through a shell, so quoting is rarely needed:

```
text_template: "gh pr checkout {{ .Payload.num }} -R {{ .Payload.repo }}"
```

#### Copied, never run

A clipboard action is offered wherever it declares a target, but it is not
runnable from a flow, which has no clipboard to write to. It leaves no durable
command record either: copying again just re-renders, with no rerun prompt.

### Launch session — `launch-session`

A **launch-session** action starts a hive coding session from the triggering
item. It is the action type behind manually invoking "review this PR" /
"start work on this issue" on an item, and behind flow `action` nodes that
spawn agents automatically.

#### Fields

- `prompt_template` (required) — the new session's initial prompt.
- `repo_template` — which repository the session is created against. Set it and
  the action can run **headlessly** (a flow `action` node can fire it with no
  human present). Leave it empty and the action becomes interactive: invoking
  it manually prompts for repository, session name, and agent before the
  session launches, and a flow `action` node is **rejected at validation
  time** for referencing it.
- `agent` — a non-default agent profile (e.g. `claude`, `aider`). Omit for the
  launcher's default.
- `post_hook` — a shell command to run once the session exists, in its
  checkout. See below.
- `post_hook_timeout` — how long the hook may run, as a duration string
  (`"2m"`). Defaults to one minute.

#### Post hook

`post_hook` runs after the session is created, through `sh -c`, with the new
session's checkout as the working directory and the login shell's environment
(so `gh`, `zed`, and the rest of your `PATH` resolve). It is the place to put
the setup the agent's prompt cannot do — check out the pull request the item is
about, then open an editor on it:

```yaml
- id: review-pr
  label: Review PR
  type: launch-session
  applies_to: [pr]
  repo_template: "https://github.com/{{ .Payload.repo }}.git"
  prompt_template: "Review pull request #{{ .Payload.num }}"
  post_hook: "gh pr checkout {{ .Payload.num }} && zed ."
```

The hook is rendered over the same data as the other templates, plus
`.Session`, bound to the session that was just created: `{{ .Session.Path }}`,
`{{ .Session.Slug }}` (its tmux session name), `{{ .Session.Name }}`,
`{{ .Session.ID }}`, and `{{ .Session.Repo }}`. `{{ .Session.Branch }}` is
empty here — a fresh session has no branch to report, and the hook is a shell
in the checkout already.

A hook that fails does **not** fail the action: the session exists by then, so
reporting the launch as failed would be untrue and would invite a retry that
creates a second session. Its exit status and output land in the action's run
log instead, under the item it ran for.

#### Item target only

A launch-session action creates a *new* session, so it cannot declare
`targets: [session]` or `targets: [window]` — the terminal's row menus have no
New Session form to collect the interactive variant's repository and name, and
the headless variant's `repo_template` renders over a feed item's payload,
which a terminal target carries none of. Declaring one is rejected when the
catalog is parsed.

#### Templates

`prompt_template` and `repo_template` are Go `text/template` strings rendered
over the triggering message (see "Template data" above). A GitHub-shaped item
exposes `{{ .Payload.repo }}`, `{{ .Payload.title }}`, `{{ .Payload.url }}`,
`{{ .Payload.body }}`, `{{ .Payload.num }}`, and `{{ .Payload.author }}`. A
webhook-sourced item exposes whatever its payload carries, so reshape it with a
`function` node first if you want stable names.

### Publish message — `publish-message`

A **publish-message** action renders a message and publishes it durably to one
topic, with sender `hive-desktop` and no session id. Use it to hand work to
another agent or process that is listening on a topic.

#### Fields

- `message_template` (required) — the message body.
- `topic` (required) — the destination topic. It must be a **constant literal**:
  no wildcards (`*`) and no template syntax (`{{ }}`). Routing is an authoring
  decision, not a runtime one, so a topic can never be computed from payload
  data.

#### Templates

`message_template` is a Go `text/template` rendered over the target's data (see
"Template data" above). On an `item` target the payload is at `.Payload` — e.g.
`{{ .Payload.title }} ({{ .Payload.url }})`; on a `session` or `window` target
the session is at `.Session` — e.g. `{{ .Session.Name }} needs a look`.

### Shell — `shell`

A **shell** action runs an author-trusted command line via `sh -c`. Use it to
reach anything the desktop app has no first-class integration with — a CLI, a
script, a `curl` to an internal service.

#### Fields

- `command_template` (required) — the command line to run.
- `cwd` — working directory. On a `session` or `window` target it defaults to
  the session's checkout, so `mise run test` is a complete action; on an `item`
  target it defaults to the desktop process's own. Setting it wins either way.
- `timeout` — a duration string like `"30s"` bounding the run. Must be quoted:
  a bare number is a hard error, not seconds. Omit for no deadline beyond the
  invoking context's.
- `env` — a map of extra environment variables for the command.

#### Templates and quoting

`command_template` is a Go `text/template` rendered over the target's data (see
"Template data" above). **Pipe every interpolated value through the `shq`
helper** — it shell-quotes the value so a title containing spaces, quotes, or
`;` cannot break out of its argument:

```
command_template: 'notify-send {{ .Payload.title | shq }} {{ .Payload.url | shq }}'
```

```
targets: [session]
command_template: 'zed {{ .Session.Path | shq }}'
```

#### Where a failure shows up

On an `item` target the run is a durable command, and failures keep bounded
stdout/stderr diagnostics on that record, readable from the activity view.

A `session` or `window` run is deliberately not durable — it is a manual
operation against live local state, so it must stay repeatable and must not
replay after a restart. There is no record to hold its streams, so its failure
reason carries the tail of stderr instead, in the jobs list.

## Launchers

A **launcher** opens the pop-up terminal straight into a program instead of a
bare shell: `lazygit` where the terminal you are looking at is, `btop`, a test
watcher. Something you want on screen for as long as you are using it,
and gone afterwards.

Launchers are the `launchers:` list in this same file, beside `actions:`. They
are deliberately **not** actions and carry none of the action envelope — no
`type`, `targets`, `applies_to`, `show_in_detail` or `inputs`. An action runs
something on your behalf and reports how it went; a launcher hands you a
terminal.

```yaml
launchers:
  - id: lazygit
    label: lazygit
    icon: git-branch
    command: lazygit
  - id: dotfiles
    label: Edit dotfiles
    icon: folder
    cwd: ~/.dotfiles
    command: $EDITOR .
```

## Fields

- `id` (required) — a slug, unique among launchers. Launcher ids and action ids
  are separate namespaces, so a launcher may share an id with an action.
- `label` (required) — the name shown in the command palette.
- `command` (required) — the command line the terminal opens into.
- `cwd` — pin the launcher to one directory (a leading `~` is expanded). Omit it
  to follow the terminal you are looking at, which is what makes `lazygit` open
  on the repository at its prompt — a `cd` into another checkout takes the
  launcher with it. Any terminal answers, including the ones under **Terminals**
  and a pinned chat, so a launcher is not limited to a session. A launcher with
  no `cwd` is **session-scoped**: it is offered only while a terminal is open,
  and it is not in the command palette or dispatched from its shortcut anywhere
  else. Pin a `cwd` for a launcher you want to reach from anywhere.
- `icon` — the palette glyph: `terminal` (the default), `git-branch`,
  `git-compare`, `folder`, `file-text`, `search`, `database`, `gauge`,
  `activity`, `flask-conical`, `hammer`, `container`, `cloud`, `bug`, `zap`,
  `package`.

## Reaching one

Every launcher appears in the command palette, and each is bindable under
`launcher.<id>` — unbound until you bind it. The `lazygit` launcher above gets
a shortcut by adding this to `settings.yaml`:

```yaml
keybindings:
  launcher.lazygit: [alt+g]
```

## Not templates, and not shell actions

`command` and `cwd` are used exactly as written — they are not Go templates,
which is why neither carries the `_template` suffix the rendered action fields
do. There is no triggering item to render over, and none is needed: the command
runs through a **login shell** in the working directory, so your own PATH,
aliases, functions and `$PWD` resolve it. Anything you would type in a terminal
is a valid `command`.

Use a `shell` action for something with a result to report — it runs
non-interactively, its output is captured, and its exit status becomes a job
outcome. Use a launcher for something to sit in front of.

## Lifetime

A pop-up terminal dies with the app and is never re-attachable; anything that
has to survive a restart is a hive session, not a pop-up. Quitting the program
takes the panel down with it, which is what makes quitting `lazygit` the way to
dismiss it. One pop-up is open at a time: invoking a different launcher replaces
whatever the panel is holding, and invoking the one already on screen hides it.

## Worked example

A complete, valid actions.yml demonstrating every type:

```yaml
version: 1
actions:
  - id: review-pr
    label: Review PR
    type: launch-session
    show_in_detail: true
    applies_to: [pr]
    repo_template: "https://github.com/{{ .Payload.repo }}.git"
    prompt_template: |
      Review pull request {{ .Payload.title }}

      {{ .Payload.url }}
  - id: start-implementation
    label: Start implementation
    type: launch-session
    show_in_detail: true
    applies_to: [issue]
    agent: claude
    repo_template: "https://github.com/{{ .Payload.repo }}.git"
    prompt_template: |
      Work on {{ .Payload.title }}

      {{ .Payload.url }}

      {{ .Payload.body }}
  - id: open-in-editor
    label: Open in editor
    type: shell
    show_in_detail: true
    timeout: "30s"
    cwd: /tmp
    env:
      EDITOR: code
    command_template: '$EDITOR --goto {{ .Payload.repo | shq }}'
  - id: open-session-in-zed
    label: Open in Zed
    type: shell
    targets: [session]
    command_template: 'zed {{ .Session.Path | shq }}'
  - id: run-tests
    label: Run tests
    type: shell
    targets: [session]
    timeout: "10m"
    command_template: 'mise run test'
  - id: interrupt-window
    label: Interrupt agent
    type: shell
    targets: [window]
    command_template: 'tmux send-keys -t {{ printf "%s:%s" .Session.Slug .Window.ID | shq }} C-c'
  - id: notify-oncall
    label: Notify oncall
    type: publish-message
    show_in_detail: false
    topic: oncall.alerts
    message_template: "{{ .Payload.title }} — {{ .Payload.url }}"
  - id: copy-checkout
    label: Copy checkout command
    type: clipboard
    show_in_detail: true
    applies_to: [pr]
    text_template: "gh pr checkout {{ .Payload.num }} -R {{ .Payload.repo }}"
  - id: silence-alert
    label: Silence alert
    type: clipboard
    show_in_detail: true
    inputs:
      - name: reason
        label: Reason
        type: multiline
        required: true
        placeholder: why this alert is being silenced
      - name: window
        label: For how long
        type: select
        default: 1h
        options: [1h, 24h, 7d]
    text_template: |
      amtool silence add alertname={{ .Payload.title | shq }} \
        --duration {{ .Inputs.window }} --comment {{ .Inputs.reason | shq }}
launchers:
  - id: lazygit
    label: lazygit
    icon: git-branch
    command: lazygit
  - id: dotfiles
    label: Edit dotfiles
    icon: folder
    cwd: ~/.dotfiles
    command: $EDITOR .
```

---

What I want:

<describe it here>
