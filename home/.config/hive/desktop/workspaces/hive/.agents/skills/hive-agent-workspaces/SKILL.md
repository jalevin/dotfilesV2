---
name: hive-agent-workspaces
description: "Author or edit an agent workspace: a named, durable directory where a CLI agent runs against a purpose-built MCP tool set, for work that has no repository. Use when configuring this in Hive Desktop (/Users/jeff/.config/hive/desktop/workspaces)."
---
Author or edit a Hive Desktop agent workspace: a named, durable directory
where a CLI agent runs against a purpose-built MCP tool set, for work that has
no repository.

Hive Desktop is a desktop app that turns GitHub activity and webhook deliveries
into triaged feeds and automated coding-agent sessions. Its configuration is
plain text on this machine, meant to be edited directly:

- /Users/jeff/.config/hive/desktop/flows/<id>.yaml — flows: the graph that decides what reaches which feed and what fires an action.
- /Users/jeff/.config/hive/desktop/actions.yml — actions: what a feed item, a terminal session or window, or a flow node can trigger.
- /Users/jeff/.config/hive/desktop/settings.yaml — app settings: polling, updates, notifications, appearance, keyboard shortcuts.

Every workspace lives under /Users/jeff/.config/hive/desktop/workspaces:

    /Users/jeff/.config/hive/desktop/workspaces/mcps.yaml                      — your own MCP server library
    /Users/jeff/.config/hive/desktop/workspaces/skills.yml                     — your skill package library
    /Users/jeff/.config/hive/desktop/workspaces/.shared/skills/<slug>/SKILL.md — skills you author
    /Users/jeff/.config/hive/desktop/workspaces/<dir>/agent-workspace.yaml     — one workspace's manifest
    /Users/jeff/.config/hive/desktop/workspaces/<dir>/AGENTS.md                — the workspace's own instructions, hand-edited

`<dir>` is the workspace's directory name and its whole identity — there is no
separate id field, so create one by creating the directory. Opening a
workspace regenerates everything else under `<dir>` (`CLAUDE.md`, `.mcp.json`,
`.codex/config.toml`, `.claude/`, `.agents/`, an empty `docs/`) from the
manifest and `AGENTS.md`. None of that generated output is meant to be
hand-edited — it is silently replaced the next time the workspace opens. One
directory is neither authored nor regenerated: `canvases/` holds artifacts a
chat's agent wrote through the `hive-canvas` MCP tools, and Hive leaves it
alone. Put
prose in `AGENTS.md`, not in the manifest: `agent-workspace.yaml` carries no
`system_prompt` field.

Rules for every file above:

- The schema is strict: an unknown key is a hard error, not a warning. Do not invent fields.
- The app watches these files and reloads on save — no restart, no build step.
- A file that fails to parse is rejected as a whole and the last good version stays live, so a mistake degrades to "nothing changed" rather than a broken app.

## agent-workspace.yaml schema

- `version` — must be `5`.
- `name` — display name shown on the workspace's card.
- `command` — the whole invocation, as a Go template rendered when a session starts. It is required, and it is the only thing that decides what runs. There is no `agent` key: Hive reads the label off the command's first word to pick the icon, the activity indicator and the resume probe, and a CLI it has never heard of is a normal workspace.

  Available fields: `.Dir` (the workspace directory), `.MCPConfig` (the generated `.mcp.json`, written for every workspace whatever the agent), `.SessionID` (a uuid Hive minted), `.Resume` (true when reattaching to a conversation), and `.Prompt` (a scheduled chat's opening message; empty on a chat started by hand). `shq` quotes a value for the shell: use it on every path.

  A workspace with `schedules:` needs a command that passes `.Prompt`, or Hive refuses the manifest: a scheduled chat whose prompt the command drops would sit idle with nobody watching. End the command with `{{ if .Prompt }}-- {{ .Prompt | shq }}{{ end }}`, which is what the shipped presets do.

  The line runs as `cd <workspace> && <your command>` under a login shell, so an env prefix or a pipeline works. Break it across several lines for readability; they are folded before rendering.

  Pin the session id (`--session-id {{ .SessionID }}`) or Hive cannot address the conversation later. Branch on `.Resume` or a reopened session relaunches fresh — Hive decides a command supports resume by rendering it both ways and checking that the output differs.

  A claude workspace usually wants:

  ```yaml
  command: >-
    claude --permission-mode acceptEdits
    --strict-mcp-config --mcp-config {{ .MCPConfig | shq }}
    {{ if .Resume }}--resume{{ else }}--session-id{{ end }} {{ .SessionID }}
    {{ if .Prompt }}-- {{ .Prompt | shq }}{{ end }}
  ```

  `--dangerously-skip-permissions` (and codex's `--dangerously-bypass-approvals-and-sandbox`) skips prompting entirely. Hive flags a command carrying one, but the flag is yours to add: reserve it for a workspace you already trust completely, remembering that every enabled MCP server is in reach.
- `mcps` — optional list of MCP server ids this workspace enables. Each id is either one of the shipped catalogue entries below or a key from your own mcps.yaml `servers:` map; an mcps.yaml entry can also replace a shipped entry of the same id.
- `skills` — optional list of **skill package** names this workspace enables, each a key from skills.yml's `packages:` map. Packages are the unit, never individual skills: `skills: [hive]` carries every `hive-*` skill this build ships, because that is what the seeded package's pattern selects. Naming a skill slug here (`hive-mcp`) enables nothing — it is read as a package that does not exist and reported when the workspace opens. Opening renders the selected skills into `.claude/skills/` and `.agents/skills/`.
- `schedules` - optional list of recurring chats this workspace launches on its own, on a cron schedule. See "schedules schema" below.

## schedules schema

Recurring chats this workspace launches on its own. Each entry in the
`schedules` list:

- `id` - required, `[a-z0-9-]+`, unique within this workspace.
- `name` - optional, shown in the UI and used to name the launched chat; defaults to `id`.
- `cron` - required. A 5-field cron expression, or one of `@hourly`, `@daily`, `@weekly`, `@monthly`, `@every 1h`. Evaluated in local time.
- `prompt` - required. A Go `text/template` string, rendered into the agent's opening message. See "Prompt template variables" below.
- `disabled` - optional; `true` skips this schedule. Omitted means enabled.
- `on_missed` - optional, `run` (default) or `skip`. `run` folds every occurrence Hive missed while it was closed into one catch-up launch; `skip` records a missed occurrence instead of launching.

Hive frames a scheduled chat before it starts: it tells the agent which
schedule and workspace started it, that nobody is watching, and how to end the
session when the task is done (a `curl` to Hive's loopback server with a token
the launch handed the process). The agent MUST end the session; a chat left
open blocks the schedule's next run. Write `prompt` as the task itself and
leave that framing to Hive.

An id is `[a-z0-9-]+` and must be unique in the workspace, so do not reuse one
for a different schedule. Changing a schedule's `cron` restarts its cursor, so
nothing back-fires: Hive only ever measures missed occurrences since the last
time this exact `cron` ran, never since the schedule was first created. An
edit to `schedules:` -- yours or the agent's -- takes effect the next time this
workspace opens; no restart needed. With the `hive-desktop` MCP server
declared in `mcps:`, `put_schedule`, `remove_schedule`, `list_schedules` and
`preview_schedule` make the same edit in place, one entry at a time, without
touching the rest of the file; a `put_schedule` on an existing id changes only
the fields it passes.

### Prompt template variables

`prompt` renders with:

- `{{ .Now }}` - the time the prompt is rendered.
- `{{ .ScheduledFor }}` - the occurrence this run honors.
- `{{ .LastRun }}` - the `ScheduledFor` of this schedule's previous launched run; unset on the first run. `date` renders it as empty text when unset, but write `{{ if .LastRun }}...{{ end }}` when you want different wording for the first run, as in the example below.
- `{{ .Reason }}` - why this run is happening: `due`, `catch_up`, or `manual` (a "Run now" from the UI).
- `{{ .Missed }}` - how many earlier occurrences in the same window were folded into this run.
- `{{ .Schedule.ID }}`, `{{ .Schedule.Name }}`, `{{ .Schedule.Cron }}` - this schedule's own fields.
- `{{ .Workspace.Dir }}`, `{{ .Workspace.Name }}` - the workspace running it.
- `{{ date "2006-01-02" .Now }}` - a helper that formats a time value with a Go reference-time layout.

A weekly summary that reads back how long it has been since the last run:

```yaml
schedules:
  - id: weekly-summary
    name: Weekly product summary
    cron: "0 9 * * 5"
    prompt: |
      Summarize product activity since {{ if .LastRun }}{{ date "2006-01-02" .LastRun }}{{ else }}last week{{ end }}.
      Check this workspace's MCP servers and write up what changed.
```

## skills.yml schema

The skill package library — which skills a workspace can enable as a unit.

- `version` — must be `1`.
- `packages` — a map of package name to definition. Each entry has an optional `title` and `description`, an `include` list (required, at least one pattern), and an optional `exclude` list.

  Patterns are globs over skill *names*, not file paths: `include: ["hive-*"]` selects every shipped skill, `exclude` then carves out. A pattern with no wildcard is an exact name, so selecting one skill needs no separate syntax. A package holds no copy of a skill, so one skill can belong to several packages and a newly authored skill joins every workspace whose enabled package already matches its name.

  Names come from two sources in one flat name-space: the skills this build ships (`hive-*`, rendered per install) and the ones authored at `.shared/skills/<name>/SKILL.md`. An authored file of the same name as a shipped skill wins.

## mcps.yaml schema

Your own MCP server library — the escape hatch beyond the shipped catalogue.

- `version` — must be `1`.
- `servers` — a map of id to server declaration. Each entry is one of:
  - a **stdio** server: `command` (required), `args`, `env`.
  - an **http** or **sse** server: `type: http` or `type: sse`, `url` (required), `headers`.

  `type` defaults to `stdio` when omitted. A stdio entry rejects `url`/`headers`; an http or sse entry rejects `command`/`args`/`env`.

## Shipped MCP catalogue

### Chrome DevTools — `chrome-devtools`

The `chrome-devtools` MCP server gives an agent DevTools' view of a real
Chrome: read network requests, console messages, and performance traces, run
Lighthouse-style audits, and inspect the live page. It is Google's own MCP
server (`chrome-devtools-mcp`), not a Hive-authored wrapper.

It is the inspection counterpart to `playwright`, not a replacement: enable
`playwright` to drive UI flows, `chrome-devtools` to debug what a page is
doing — network, console, and performance — while it runs. A web workspace
often wants both.

#### Launch

Hive launches it over stdio:

```
npx -y chrome-devtools-mcp@latest
```

`-y` skips npx's interactive install confirmation, which would otherwise
stall a non-interactive agent launch the first time this package version is
fetched on a machine. `@latest` is the documented invocation; Hive does not
vendor or pin a specific `chrome-devtools-mcp` version, so a workspace
enabling this entry gets whatever the registry resolves at launch time.

#### Stability

`stable`. The server is Google-maintained, past 1.0, and its launch command
is settled.

#### What it needs

Node.js 20.19 or newer and a current stable Chrome installed and reachable
from the workspace's environment. No credentials, and nothing
workspace-specific: this entry ships with no configuration in M1.

### Hive Canvas — `hive-canvas`

The `hive-canvas` MCP server is the chat's output surface: its tools put
content in front of the user in a pane beside the conversation, in the Agents
area, while the session keeps running. It is the difference between describing
a document in terminal scrollback and handing the user one to read
(ADR canvases-are-named-files-in-the-workspace-folder-served-over-their-own-mcp-entry).

Like `hive-desktop`, the server is the running app itself — nothing to
install, nothing to fetch. It is a separate entry so a workspace can have a
canvas without granting the app-control tool set, and the other way around.

#### What a canvas is

A canvas is a named artifact in the workspace: an ordered list of blocks,
saved as `canvases/<name>.json` in the workspace folder. A chat can make as
many as it needs — name them by artifact (`release-notes`, `perf-report`),
give each a display title, and they outlive the conversation that made them.
Blocks are:

- **markdown** — a title (optional) and a body, rendered as GitHub-flavored
  markdown. Raw HTML in the body is escaped, not rendered.
- **html** — a title (optional) and a body of markup, for layout markdown
  cannot express: a row of stat tiles, a two-column comparison, a card grid,
  or a drawn diagram. See [Writing an html block](#writing-an-html-block).
- **link** — a title and an `http`, `https`, or `mailto` URL, shown as an
  openable link.

Block ids are the agent's own: reusing an id updates that block in place,
which is how a status line is revised instead of duplicated; a `before`
anchor places or moves a block ahead of an existing one.

#### Writing an html block

How a block looks is yours. Any class, any `style` attribute, any colour or
size — nothing in the allowlist is second-guessed, and a block renders inside
the pane it was written for, so it cannot paint over the rest of the app.

What a block may **reach** is not yours: no script, no event handler, no
embedded document, and links only to `http`, `https` or `mailto`. A write that
uses one of those fails and names it, rather than rendering something you
believe is intact.

Reach for the `hv-` classes below before you invent styling. They are what
Hive styles for you: pick one and the block follows the user's theme, in light
and dark, now and after a restyle, and two canvases written months apart still
look like the same product. Write your own colours when the block needs
something the vocabulary has no name for, and remember the user may be in
either theme.

##### Tags

Sectioning and text (`div`, `section`, `article`, `header`, `footer`, `aside`,
`figure`, `figcaption`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `p`, `span`,
`strong`, `em`, `b`, `i`, `u`, `s`, `small`, `mark`, `sub`, `sup`, `abbr`,
`q`, `time`, `br`, `hr`, `blockquote`), lists (`ul`, `ol`, `li`, `dl`, `dt`,
`dd`), code (`pre`, `code`, `kbd`, `samp`, `var`), tables (`table`, `thead`,
`tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`), disclosure
(`details`, `summary`), `a` with an `http`, `https` or `mailto` href, and the
drawing tags in [Diagrams](#diagrams).

Also `img`, with an `http`, `https` or base64 `data:` image source. Note that
the app fetches whatever host you name, from the user's machine, every time
the canvas is opened.

Refused: `script`, `style` (the element — the `style` attribute is fine),
`iframe`, `object`, `embed`, `form` and form controls, every `on*` handler,
and `id`, which can shadow a global in the app's own page.

Attributes are `class`, `style`, `title`, `lang`, `dir`, `href` on `a`, `src`
and `alt` on `img`, `colspan`/`rowspan` and `scope` on cells, `open` on
`details`, and the drawing attributes in [Diagrams](#diagrams).

##### Classes

**Layout** — `hv-stack` (vertical, evenly spaced), `hv-row` (horizontal,
wraps), `hv-grid` with one of `hv-cols-2`, `hv-cols-3`, `hv-cols-4` (equal
columns; they collapse to one when the pane is narrow, so pick for the
content, not for a width you cannot see).

**Containers** — `hv-card` (a bordered, raised box: one unit of content),
`hv-panel` (a flat tinted region: a grouped aside), `hv-callout` (a
left-ruled block for something the reader must not miss).

**Data** — `hv-stat` wrapping an `hv-stat-value` and an `hv-stat-label` is one
tile; `hv-kv` on a `<dl>` lays its `<dt>`/`<dd>` pairs out as an aligned
key/value table.

**Emphasis** — `hv-badge` (an inline pill), `hv-muted` (de-emphasised text),
`hv-mono` (monospace, for ids, shas and figures).

**Tones**, for `hv-callout`, `hv-badge` and the diagram roles — `hv-info`,
`hv-success`, `hv-warn`, `hv-error`, `hv-accent`. Without one, each is
neutral.

##### Diagrams

Prose and boxes cannot say which node feeds which, or which path is a return
path. Draw that as an `svg`: you place the geometry, Hive picks the size and
every colour, exactly as it does for the classes above.

Give the `svg` a `viewBox` and it scales to whatever width the user dragged
the pane to, which is usually what you want. State a `width` and `height`
instead and it keeps that size, up to the width of the pane.

The role classes below are defaults, not rules. An unclassed shape still
follows the theme; a `fill` or `stroke` attribute, or a `style`, overrides
whatever the app would have picked.

**Tags** — `svg`, `g` (a group, to move or tone several shapes at once),
`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`
and `tspan`. There is no `defs`, `marker` or `use`: draw an arrowhead as a
`polygon`.

**Attributes** — the geometry (`viewBox`, `transform`, `d`, `points`, `x`,
`y`, `dx`, `dy`, `width`, `height`, `rx`, `ry`, `cx`, `cy`, `r`, `x1`, `y1`,
`x2`, `y2`, `preserveAspectRatio`) and the paint (`fill`, `stroke`,
`stroke-width`, `stroke-dasharray`, `stroke-linecap`, `stroke-linejoin`,
`opacity`, `fill-opacity`, `stroke-opacity`, `fill-rule`, `paint-order`,
`vector-effect`, `font-size`, `font-family`, `font-weight`, `font-style`,
`letter-spacing`, `text-anchor`, `dominant-baseline`).

**Roles** — `hv-node` (a filled, bordered shape: one box in the diagram),
`hv-edge` (a stroked connector), `hv-arrow` (a filled arrowhead or any other
solid mark), `hv-label` (text the reader reads first), and `hv-dashed`
alongside `hv-edge` for a path that is conditional, asynchronous, or a read
rather than a write. A tone on the element — or on a `g` around a whole path
— colours it; `hv-muted` and `hv-mono` work on `text` exactly as they do on a
`span`.

##### Worked examples

A row of stat tiles:

```html
<div class="hv-grid hv-cols-3">
  <div class="hv-card hv-stat">
    <span class="hv-stat-value">1,284</span>
    <span class="hv-stat-label">Requests</span>
  </div>
  <div class="hv-card hv-stat">
    <span class="hv-stat-value">98.2%</span>
    <span class="hv-stat-label">Success</span>
  </div>
  <div class="hv-card hv-stat">
    <span class="hv-stat-value">412ms</span>
    <span class="hv-stat-label">p95</span>
  </div>
</div>
```

A before/after comparison, and a status line:

```html
<div class="hv-grid hv-cols-2">
  <section class="hv-panel">
    <h3>Before</h3>
    <p class="hv-mono">412ms</p>
  </section>
  <section class="hv-panel">
    <h3>After</h3>
    <p class="hv-mono">96ms</p>
  </section>
</div>
<p class="hv-row">
  <span class="hv-badge hv-success">passing</span>
  <span class="hv-badge hv-warn">2 flaky</span>
  <span class="hv-muted">last run 4m ago</span>
</p>
```

Facts, and something the reader must not miss:

```html
<dl class="hv-kv">
  <dt>Branch</dt><dd class="hv-mono">feat/canvas-html</dd>
  <dt>Base</dt><dd class="hv-mono">main</dd>
  <dt>Reviewer</dt><dd>unassigned</dd>
</dl>
<div class="hv-callout hv-error">
  <strong>Migration 0042 is not reversible.</strong>
  Take a backup before deploying.
</div>
```

A pipeline with a return path:

```html
<svg viewBox="0 0 300 120">
  <g class="hv-accent">
    <rect class="hv-node" x="4" y="10" width="90" height="40" rx="7" />
    <text class="hv-label" x="49" y="35" text-anchor="middle">Poller</text>
  </g>
  <rect class="hv-node" x="150" y="10" width="90" height="40" rx="7" />
  <text class="hv-label" x="195" y="35" text-anchor="middle">Store</text>

  <line class="hv-edge" x1="94" y1="30" x2="140" y2="30" />
  <polygon class="hv-arrow" points="140,26 149,30 140,34" />

  <path class="hv-edge hv-dashed" d="M195 50 L195 90 L49 90 L49 50" />
  <polygon class="hv-arrow" points="45,58 49,50 53,58" />
  <text class="hv-muted" x="122" y="105" text-anchor="middle">re-read on wake</text>
</svg>
```

An html block is exported as its markup, so a canvas saved to a file keeps the
structure and loses the styling — the `hv-` names mean nothing outside Hive,
and a drawing that leans on them falls back to svg's own defaults, which are
black boxes and no edges. What you write inline survives: a `style`, a `fill`,
a `stroke`. Style a diagram yourself when the canvas is meant to leave the
app. Reach for `markdown` for prose and `html` only when the layout is the
point.

#### Tools

- `put_block` — create or replace one block; the first write under a new
  canvas name creates that canvas. Answers with the canvas metadata and the
  stored block, never the whole surface.
- `put_blocks` — write a batch of blocks in one atomic call, for laying out
  a canvas whole instead of block by block.
- `remove_block` — remove one block by id.
- `clear_canvas` — remove every block; the canvas, its name and title survive.
- `delete_canvas` — remove a canvas entirely.
- `read_canvas` — read one canvas exactly as the user sees it, every block
  in order.
- `list_canvases` — every canvas in the workspace, including ones earlier
  chats made.
- `open_canvas` / `close_canvas` — ask to show or hide the pane beside this
  chat, optionally pinned to one canvas. Best-effort: it applies only while
  the user is viewing this chat, and there is no acknowledgment either way.
  Open when something is finished and worth looking at, not on every write —
  a write while the pane is closed already lights an unseen dot.

Every tool takes a `session` id naming the calling chat. Hive sets it in the
launched process's environment as `HIVE_AGENT_SESSION`; a chat launched
before canvas support existed does not have the variable until it is
relaunched.

#### Launch

Hive reaches it over Streamable HTTP on the loopback server that also hosts
the webhook listener:

```
http://127.0.0.1:<port>/mcp/canvas
```

The port is allocated at startup, so this entry carries **no URL in the
registry** — the live address is resolved when the catalogue is rendered
(`Descriptor.RuntimeURL`), and the catalogue reports a problem instead when
the loopback server is disabled.

The server requires no token. It sits behind the loopback bind, spawns no
processes, and writes only under the workspace's `canvases/` directory.

### Hive Desktop — `hive-desktop`

The `hive-desktop` MCP server is this install itself. It is how a workspace's
agent observes and operates the running app — reading the inbox, feeds,
profiles and action catalog, forcing a source refresh, and dry-running a flow
— instead of reading `desktop-pipeline.db` or editing config files blind
(ADR mcp-replaces-the-agent-facing-http-api).

It is the only shipped entry that is not a third-party program: there is
nothing to install and nothing to fetch, because the server is already running
inside the app the agent was launched from.

#### Launch

Hive reaches it over Streamable HTTP on the loopback server that also hosts
the webhook listener:

```
http://127.0.0.1:<port>/mcp
```

The port is allocated at startup, so this entry carries **no URL in the
registry** — it is resolved when the catalogue is rendered and written into a
workspace's generated `.mcp.json` at that moment (`Descriptor.RuntimeURL`).
That is also why the catalogue reports a problem, rather than a URL, when the
loopback server is disabled: an entry that rendered an address nothing answers
would fail silently inside the agent's own `/mcp` output.

The server requires no token. It sits behind the loopback bind and spawns no
processes — session control stays on the HTTP adapter's token-guarded terminal
prefix (ADR terminal-transport, ADR a-workspace-declares-its-own-authority).

#### Stability

`beta`. The tool set is settled enough to build against, but it is new and
still growing toward the rest of the app's surface; tool names may still
change before it is called stable.

#### What it needs

`http.enabled` in `settings.yaml`, which is on by default. Nothing else — no
Node, no network access, and no per-workspace configuration.

### Playwright — `playwright`

The `playwright` MCP server gives an agent a real, controllable browser:
navigate, click, fill forms, take screenshots, and read page content and the
accessibility tree. It is Microsoft's own MCP server for Playwright
(`@playwright/mcp`), not a Hive-authored wrapper.

#### Launch

Hive launches it over stdio:

```
npx -y @playwright/mcp@latest
```

`-y` skips npx's interactive install confirmation, which would otherwise
stall a non-interactive agent launch the first time this package version is
fetched on a machine. `@latest` is the documented invocation; Hive does not
vendor or pin a specific `@playwright/mcp` version, so a workspace enabling
this entry gets whatever the registry resolves at launch time.

#### Stability

`stable`. The server and its launch command are settled; this entry's shape
in the catalogue may still change if a configurable variant ships later
(see the catalogue's Migration Notes).

#### What it needs

Node.js and a Playwright browser install reachable from the workspace's
environment — the same prerequisites `npx @playwright/mcp` has anywhere else.
Nothing workspace-specific: this entry ships with no configuration in M1.

## Worked example

A complete, valid `agent-workspace.yaml` naming shipped catalogue entries
(`hive-desktop`, `playwright`), an `mcps.yaml` entry (`home-assistant`), and
the seeded `hive` skill package. `hive-desktop` is this install itself —
declaring it is what lets a session read the inbox and dry-run a flow rather
than guessing at the app's state:

```yaml
version: 5
name: Home Assistant
# The whole invocation, as a Go template. Available fields: .Dir, .MCPConfig,
# .SessionID and .Resume; shq quotes a value for the shell.
command: >-
  claude --permission-mode acceptEdits
  --strict-mcp-config --mcp-config {{ .MCPConfig | shq }}
  {{ if .Resume }}--resume{{ else }}--session-id{{ end }} {{ .SessionID }}
mcps:
  - hive-desktop
  - playwright
  - home-assistant
skills:
  - hive
```

The `mcps.yaml` it references:

```yaml
version: 1
servers:
  home-assistant:
    title: Home Assistant
    type: http
    url: http://homeassistant.local:8123/mcp
    headers:
      Authorization: "Bearer op://vault/item/token"
  local-tool:
    command: npx
    args: ["-y", "@example/mcp"]
    env:
      TOKEN: "op://vault/item/token"
```

And the `skills.yml` defining the `hive` package it enables:

```yaml
version: 1
packages:
  hive:
    title: Hive
    description: Configure Hive Desktop itself — flows, actions, settings, webhooks.
    include:
      - "hive-*"
  infra:
    title: Infrastructure
    include: ["terraform-*", "k8s-*", "runbook"]
    exclude: ["terraform-experimental"]
```

---

What I want:

<describe it here>
