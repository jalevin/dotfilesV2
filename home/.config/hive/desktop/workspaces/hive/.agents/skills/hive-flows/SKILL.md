---
name: hive-flows
description: "Author or edit a pipeline flow: the graph of sources, filters, and destinations that decides what reaches your feeds and what fires an action. Use when configuring this in Hive Desktop (/Users/jeff/.config/hive/desktop/flows/<id>.yaml)."
---
Author or edit a Hive Desktop pipeline flow.

Hive Desktop is a desktop app that turns GitHub activity and webhook deliveries
into triaged feeds and automated coding-agent sessions. Its configuration is
plain text on this machine, meant to be edited directly:

- /Users/jeff/.config/hive/desktop/flows/<id>.yaml — flows: the graph that decides what reaches which feed and what fires an action.
- /Users/jeff/.config/hive/desktop/actions.yml — actions: what a feed item, a terminal session or window, or a flow node can trigger.
- /Users/jeff/.config/hive/desktop/settings.yaml — app settings: polling, updates, notifications, appearance, keyboard shortcuts.

Write the flow to /Users/jeff/.config/hive/desktop/flows/<id>.yaml. The flow's id is the filename
stem — flows/triage.yaml is the flow "triage" — and is never written inside the
file. A sibling flows/<id>.ui.yaml holds canvas positions; leave it alone, the
app maintains it.

Rules for every file above:

- The schema is strict: an unknown key is a hard error, not a warning. Do not invent fields.
- The app watches these files and reloads on save — no restart, no build step.
- A file that fails to parse is rejected as a whole and the last good version stays live, so a mistake degrades to "nothing changed" rather than a broken app.

## Top-level schema

- `version` — must be `1`.
- `name` — display name.
- `enabled` — optional bool, defaults to true.
- `nodes` — the graph's nodes. Every node has:
  - `id` — unique within the flow.
  - `type` — one of the node types documented below.
  - `name` — optional display name; falls back to the type's label.
  - `disabled` — optional bool. A disabled node drops every message it receives instead of running.
  - plus that type's own fields, **flattened at the same level** — not nested under a `config:` key.
- `wires` — connections, each `{ from, out, to }`. `from`/`to` are node ids; `out` is the source node's output port index and defaults to 0, so omit it for single-output nodes.

A node's ports are fixed by its type: wiring into a source, out of a terminal,
or to an output index the type does not have is a validation error.

## Node types

### Sources

#### Command source — `sources.exec`

A **command source** node runs a shell command on every poll tick and ingests what it prints as this node's current items. It turns any CLI that can produce JSON into a source — no external scheduler, no webhook endpoint, no state file. It has no inputs; this is where a flow starts.

Its output is a **snapshot**: what the command prints is the complete current set. An item that stops appearing is treated as gone and archived, so the feed follows reality without the command tracking what changed since last time.

##### Fields

- `command` — required. The command line, run through `sh -c`, so pipes, redirection, and `&&` work. It runs with the PATH your login shell reports (not the desktop's), your own environment, and no shell aliases — an alias is interactive-shell sugar and does not resolve here.
- `timeout` — required, e.g. `30s`. How long one run may take before it is killed and the tick fails. At most `2m`: a tick drains sources in sequence, so this budget is taken out of every other source's freshness.
- `cwd` — optional. Absolute path (or one starting with `~/`) to run in. Empty runs in the app's own directory, which for a launched app is not a useful place — set this if the command cares.
- `env` — optional map of extra environment variables, added to the inherited environment. Values are literal: nothing is expanded or interpolated.
- `interval` — optional, e.g. `1h`. The shortest time between runs, for a command that is expensive or only worth running occasionally. The command still only runs on a poll tick, so the real cadence rounds up to the next one; empty runs it every tick. It is not persisted — a restart runs every source once.
- `icon` — optional glyph, from the curated feed icon set, shown on this source's items. Empty uses the default command glyph.
- `image` — optional uploaded image (the tool's logo) shown as this source's mark instead of the glyph. It is a content hash of a normalized PNG kept in the app data dir, set through the editor's image picker; it is presentation only and never affects ingest. Empty falls back to `icon`.

##### Output contract

- Print a **JSON array of objects** on stdout and exit `0`. The array is the whole snapshot: `[]` is a legitimate empty one, and it archives every item this source owns.
- Item identity: each object needs a top-level `"id"` (string or number). It is the stable key — the same id on the next run updates the same item; a new id is a new item. This is the one field a command must supply, because without it a changed item is indistinguishable from a new one.
- A top-level `"title"` and `"url"` are promoted so the item renders in feeds; everything else stays in the opaque `msg.Payload` for downstream nodes, decoded against the canonical item contract (docs/decisions/0008) wherever it renders.
- A top-level `"kind"` is the item's type label and what actions target with `applies_to`. Omit it and the item is kind `Item` — still automatable (`applies_to: [Item]`), just not distinguishable from other untyped items.
- A top-level `"state"` drives lifecycle: `resolved`, `closed`, and `done` (case-insensitive) system-archive the item with the state as the archive reason; any other or absent state keeps it active. An item whose state leaves one of those values resurfaces.
- This is the same item contract a webhook delivery carries, so a payload written for one works in the other.

If the command emits one JSON object per line, pipe it through `jq -s .` to make an array.

##### Failure

A run either produces the whole snapshot or fails; there is no partial ingest. These are all failures, not empty snapshots:

- a non-zero exit,
- no output at all (an empty snapshot must be printed as `[]`),
- stdout that is not a JSON array — including `null`, a bare object, or NDJSON,
- an item with no `id`, two items sharing one, or an array entry that is not an object,
- more than 1 MiB on stdout, or exceeding `timeout`.

A failed run changes nothing: the previous snapshot stays in place, no item is archived, and nothing is emitted. It is recorded in Activity with the exit status and an excerpt of stderr. A source that keeps failing is re-announced at most once an hour until it succeeds, so a broken command does not bury the log.

The failure this contract exists to prevent is the quiet one: without it, a command that broke would print nothing, ingest as an empty snapshot, and silently archive every item the source owns.

##### Trust

This node runs a command on your machine, on a timer, with your environment. Flow files are meant to live in a dotfiles repo, so treat one that arrives from elsewhere the way you would treat a shell script from the same place. The command is a fixed string and is never templated from ingested data, so nothing this or any other node fetches can change what runs.

#### Gitea source — `sources.gitea`

A **Gitea source** node emits messages from a Gitea or Forgejo instance — either a filtered issue and pull-request search, or that account's notification inbox. It has no inputs; this is where a flow starts. Forgejo serves the same API, so one node type covers both.

##### Fields

- `credential` — required. The connected account to fetch as, written as `gitea/<host>-<login>` (for example `gitea/git.example.com-octocat`). Connect an instance under Settings ▸ Integrations.
- `kind` — `search` runs a filtered query; `notifications` drains that account's inbox.
- `limit` — optional max items per fetch (search caps at 100, notifications at 50).

The rest apply to `search` only, and a `notifications` node carrying any of them is rejected:

- `items` — `all` (default), `issues`, or `pulls`.
- `state` — `open` (default), `closed`, or `all`.
- `involving` — return only items the connected account is related to: `created`, `assigned`, `mentioned`, `review_requested`, `reviewed`. Listing several returns the **union** — items matching any one of them.
- `owner` — limit the search to one user's or organization's repositories.
- `labels` — return items carrying any of these labels.
- `text` — free-text search over title and body.
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

Everything is optional: a search with no filters returns every open issue and pull request the token can see, newest-updated first.

##### Behavior

The source runs in the backend: Go polls every enabled flow's source nodes and appends each item to the event log under topic `source:<flowId>/<nodeId>`. This node has one output — every item becomes a `msg` whose payload is the same normalized pull-request/issue shape a GitHub source emits, so the same downstream filters and actions work on both.

Filters are typed fields rather than a query string because Gitea has no search syntax to write one in: its search endpoint takes discrete parameters, and `text` is only a free-text match on title and body. Unknown values are rejected when the flow is saved, because the server itself ignores them and would answer an unfiltered page — a typo would otherwise read as "these are all my open pull requests".

`involving` is the one field that costs more than it looks: the API intersects those relationships, so a union is one request per entry, issued on every poll. Two entries is two requests; the results are merged, deduplicated, and cut back to `limit`.

An item that stops appearing in a search — merged, closed, relabelled out of the filter, or simply pushed off the page by newer activity — has its current state looked up before anything is archived, one request per item. A notifications source usually skips that: Gitea reports each thread's subject state on the notification itself, so most items are archived before they ever leave the inbox — only an item pushed off the page while still open gets the lookup.

The access token needs the `read:user` scope (connecting resolves which account it authenticates as), plus `read:issue` for a search source and `read:notification` for a notifications one.

`credential` is a reference, never a token. Flow files are meant to live in a dotfiles repo, so the secret stays in the OS keychain and only the account name is written here. The host is bound to the account when it is connected, which is why the account half names it — a node cannot point an account's token at a different server, and two instances never collide.

#### GitHub source — `sources.github`

A **GitHub source** node emits messages from an embedded GitHub search or notifications source. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected GitHub account to fetch as, written as `github/<login>` (for example `github/octocat`). Connect an account under Settings ▸ Integrations.
- `kind` — `search` runs a GitHub Search API query; `notifications` drains that account's inbox.
- `query` — required for `search`, unused for `notifications`.
- `limit` — optional max items per fetch (search caps at 100, notifications at 50).
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

##### Behavior

The source itself runs in the backend: Go polls every enabled flow's source nodes and appends each item to the event log under topic `source:<flowId>/<nodeId>`. This node has one output — every item becomes a `msg` whose payload mirrors the normalized PR/Issue/notification shape.

`credential` is a reference, never a token. Flow files are meant to live in a dotfiles repo, so the secret stays in the OS keychain and only the account name is written here. Sources on different accounts fetch independently — separate caches, separate rate limits — so one account being throttled does not stall another.

#### Grafana alerts source — `sources.grafana_alerts`

A **Grafana alerts source** node emits one item per currently firing Grafana-managed alert on a connected stack. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected Grafana stack to fetch as, written as `grafana/<account>`. Connect a stack under Settings ▸ Integrations by pasting its URL and a service-account token; a Viewer-role service account is enough to read alerts.
- `matchers` — optional. Alertmanager label matchers, one per entry. An alert must match **every** one to be fetched. The operators are `=`, `!=`, `=~` and `!~`, and the value is passed through untouched:
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

  ```yaml
  matchers:
    - squad=adaptive-telemetry
    - severity=~critical|warning
    - team!=infra
  ```

  With no matchers the node fetches the stack's entire active alert set. On a large shared stack that is tens of thousands of alerts and tens of megabytes per tick, so a feed scoped to a team should say so here rather than narrow the result in a downstream `function` node.

##### Behavior

The source runs in the backend: Go polls the stack's Alertmanager on each tick and appends the result to the event log under topic `source:<flowId>/<nodeId>`. Each firing alert becomes **one message keyed by its fingerprint**, so an alert maps to its own durable item. The payload carries the alert's `title` (its summary annotation, or its `alertname`), a `state` of `firing`, and the raw `labels` and `annotations` for a `function` node to route on.

An alert that is still firing re-reports the same fingerprint and payload and is deduplicated — it produces no new event. When an alert stops firing it leaves the Alertmanager's active set, so the source treats its absence as authoritative: the item is marked `resolved` and archived on the next poll, rather than left to age out.

Filtering happens on the server and does not change item identity — alerts are keyed by fingerprint either way. What it does change is the set this node claims: absence is judged against the *matched* set, so tightening `matchers` archives the alerts that no longer match. That is the correct reading — they are no longer in this node's set — but it means editing matchers reconciles items out of the feed, so change them deliberately.

##### Choosing between this and the IRM source

This node reads the stack's own Alertmanager. If a feed is meant to mirror what reaches an on-call channel, `sources.grafana_irm_alerts` is usually the right object instead: alerts evaluated elsewhere and posted straight to an IRM integration never appear here, and IRM groups related alerts where this node lists one item per instance.

#### Grafana IRM alerts source — `sources.grafana_irm_alerts`

A **Grafana IRM alerts source** node emits one item per active Grafana IRM (OnCall) alert group on a connected stack, carrying the group's triage state. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected Grafana stack to fetch as, written as `grafana/<account>` — the same credential the other Grafana source nodes use. The token needs `grafana-irm-app.alert-groups:read`; if the stack answers `403`, the service account's role is too low rather than the token being wrong.
- `integration` — optional. An IRM integration id (e.g. `CFRPV98RPR1U8`), found on the integration's page in Grafana. This is usually what pins a feed to one squad, because the integration is the unit the upstream routes deliver to. Empty fetches every integration.
- `team` — optional. An IRM team id. Empty fetches every team.
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

##### Behavior

The source runs in the backend. On each tick Go resolves the stack's OnCall API host from the IRM plugin's settings — cached per stack, so it costs one request per connection rather than one per poll — then lists the active alert groups and appends them to the event log under topic `source:<flowId>/<nodeId>`.

Each alert group becomes **one message keyed by its IRM id**. The payload carries:

- `title` — the group's title
- `state` — `firing`, `acknowledged`, `silenced` or `resolved`
- `url` — the group's Slack permalink, falling back to its IRM web page
- `integration`, `team` — the group's scoping ids
- `labels` — sorted `key=value` tags from the source alert and the group's IRM labels
- `alertLabels` and `annotations` — the source alert's common maps, merged with the IRM labels, for a `function` node to route on
- `cluster`, `namespace`, `severity` — commonly acted-on labels lifted to top level
- `alertsCount`, `createdAt`, `acknowledgedAt`, `silencedAt`

The detail body starts with the source alert's description and labels, then shows the IRM group's count and triage timestamps. The connector reads this context from `last_alert.payload`, which the public alert-groups listing embeds, so it does not add one request per group.

`acknowledged` is genuine triage state: someone has picked the alert up. A move between two active states — firing to acknowledged, acknowledged to silenced — is reported as activity, so a feed can react to a colleague taking an alert. A group re-observed at an unchanged state produces no new event.

Absence is authoritative. The listing is the complete active set for the node's scope, so a group that stops appearing is resolved: its item is marked `resolved` and archived on the next poll rather than left to age out. As with matchers on `sources.grafana_alerts`, narrowing `integration` or `team` archives the groups that fall outside the new scope.

##### Choosing between this and the Alertmanager source

`sources.grafana_alerts` reads the stack's Grafana Alertmanager, which is a different set. An alert evaluated in another Mimir and posted straight to an IRM integration never reaches the stack's Alertmanager, and alerts that do reach it may carry no team label to scope on. IRM also groups related alerts, so this node emits roughly one item per on-call notification where the Alertmanager source emits one per firing instance.

Reach for this node when the feed should mirror what an on-call channel sees, and for `sources.grafana_alerts` when it should mirror what the stack is evaluating.

For Alertmanager-shaped integrations, the source context comes from the latest notification's `commonLabels` and `commonAnnotations`. Labels that differ between alert instances are not presented as facts about the whole group. Other integration payloads may not expose common maps; in that case the node keeps the IRM labels and triage facts it can read safely.

#### Grafana metrics source — `sources.grafana_metrics`

A **Grafana metrics source** node runs a PromQL query against a connected Grafana stack and emits its result. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected Grafana stack to fetch as, written as `grafana/<account>` (the account is the stack host and org, resolved when you connect). Connect a stack under Settings ▸ Integrations by pasting its URL and a service-account token; a Viewer-role service account is enough to query metrics.
- `datasource_uid` — required. The uid of the Prometheus-compatible datasource the query runs against.
- `expr` — required. A PromQL expression, for example `up` or `sum(rate(http_requests_total[5m]))`.
- `title` — optional. The feed item's title. Defaults to the query when empty.
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

##### Behavior

The source runs in the backend: Go polls every enabled flow's source nodes on each tick and appends the result to the event log under topic `source:<flowId>/<nodeId>`. This node emits **one message per poll**, keyed by the node id, so the whole node maps to a single durable item. The message payload is `{ title, result }`, where `result` is the datasource's query response verbatim (`resultType` plus the `result` series array).

The item's feed presentation — its title and url — is minted at ingest from what this node emits, from the configured `title`. A downstream `function` node reads `msg.Payload.result` and decides **whether** the item appears in a feed by routing it or not; it cannot change the item's title or url. When the function stops routing the item, it leaves the feed on the next poll.

Because a metric's value changes almost every poll, each changed poll appends an event and is routed through the graph. A `function` node fed by this source must therefore be a **pure function of its input** — no dedup or counters that assume one run per change — and the query should return a bounded number of series, since the item's payload carries the whole result.

#### PostHog insight alerts source — `sources.posthog_alerts`

A **PostHog insight alerts source** node emits one item per insight alert configured in a connected project. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected PostHog project to fetch as, written as `posthog/<account>`. Connect a project under Settings ▸ Integrations; the key needs the `project:read` and `alert:read` scopes.
- `firing_only` — emit only alerts that are currently firing. Off by default, because emitting every alert is what lets one that stops firing update the item that was already there rather than silently disappear from the feed.
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

##### Behavior

The source runs in the backend: Go lists the project's alerts on each tick and appends the result to the event log under topic `source:<flowId>/<nodeId>`. Each alert becomes **one message keyed by its alert id**, so a firing→resolved cycle updates one durable item.

The payload carries the alert's `title` (its name, falling back to the insight's), a `kind` of `Alert` so an action can target alert items specifically, a `body` holding the watched insight and the last evaluation for the detail pane, a `url` that deep-links to the monitored insight, a normalized `state` — `firing`, `not_firing`, `snoozed` or `errored` — and the raw `threshold` and `condition` for a `function` node to route on. PostHog reports states as display strings (`Not firing`); the source normalizes them, so route on `not_firing` rather than on what the API returns.

An alert that starts breaching is summarized as **Firing**; one that stops is summarized as **Resolved** and archived. Only `firing` counts as active — a snoozed or errored alert is not a breach asking to be looked at.

An alert that stops appearing is **not** treated as resolved: the list carries every alert with its current state, so an alert missing from it was deleted in PostHog. A resolution always arrives as a state change on an alert that is still listed.

One page of alerts is polled per tick. A project with more alerts than that logs a warning rather than quietly serving a partial set.

#### PostHog error tracking source — `sources.posthog_errors`

A **PostHog error tracking source** node emits one item per error-tracking issue in a connected project. It has no inputs — this is where a flow starts.

##### Fields

- `credential` — required. The connected PostHog project to fetch as, written as `posthog/<account>`. Connect a project under Settings ▸ Integrations by pasting your instance URL and a personal API key, then picking a project; the key needs the `project:read` and `error_tracking:read` scopes. There is no host or project field here — both are bound to the account when it is connected, so a node cannot point a key at a project it was not connected to.
- `status` — `active` (default), `resolved`, `suppressed`, or `all`. Which issues to fetch.
- `order_by` — `last_seen` (default), `first_seen`, `occurrences`, `users`, or `sessions`. How issues are ranked before `limit` is applied, descending.
- `date_from` — the start of the window the counts cover, as a PostHog relative date such as `-7d` (default) or `-24h`.
- `limit` — how many issues one poll fetches, 1 to 100. Defaults to 25. Because ranking happens before the cut, this is "the top N issues by `order_by`", not "the first N".
- `include_test_accounts` — include traffic PostHog classifies as internal or test. Off by default, matching PostHog's own default.
- `interval` — optional, e.g. `1h`. The shortest time between fetches, for a source that costs more than its freshness is worth. It still only runs on a poll tick, so the real cadence rounds up to the next one; empty fetches every tick. A manual refresh ignores it, and it is not persisted — a restart fetches once from every source.

##### Behavior

The source runs in the backend: Go queries the project's error-tracking issues on each tick and appends the result to the event log under topic `source:<flowId>/<nodeId>`. Each issue becomes **one message keyed by its issue id**, which is the roll-up that matters — PostHog has already grouped every occurrence of one exception under that id, so a spike of ten thousand events updates a single feed item instead of flooding the inbox.

The payload carries the issue's `title` as `name: description` — PostHog's `name` is the exception class alone, so a project with several unrelated `TypeError`s would otherwise get several identically-titled items — a `kind` of `Error` so an action can target error items specifically, a `body` holding the occurrence/user/session counts, first/last seen, and the top `source` file for the detail pane, a `url` that deep-links to the issue in PostHog, a `state` of `active`, `resolved` or `suppressed`, the `occurrences`, `users` and `sessions` counts over the `date_from` window, and `firstSeen`/`lastSeen`/`library`/`source` for a `function` node to route on. The issue query returns no stack trace — PostHog exposes those per-issue through a separate sampled-events endpoint, which this node does not call.

Two transitions are called out rather than reported as ordinary updates: an issue that goes terminal is summarized as **Resolved** and archived, and one that comes back out of a terminal state is summarized as **Regressed**. Between those, an issue whose `lastSeen` has advanced since the last poll is a new occurrence; an issue that has not been seen again is a trivial update, so a steadily-firing issue does not re-notify on every tick.

An issue that stops appearing is **not** treated as resolved. The query is filtered by status, bounded by `date_from` and capped by `limit`, so an issue can leave the result set by aging out of the window or being ranked below the cut — archiving on absence would close live issues. Resolution is only recognised when PostHog reports it as a status change, which means an issue resolved in PostHog is seen on the next poll only while it is still inside the configured window.

#### RSS feed — `sources.rss`

An **RSS feed** node fetches one feed document on the poll tick and ingests its entries as items. RSS, Atom and JSON Feed all go in the same `url` field; the parser reads the document, not the file extension. It has no inputs; this is where a flow starts.

Its output is a **window**, not a snapshot. A publisher drops old entries as new ones arrive, and `limit` cuts the list further, so an entry that stops appearing has scrolled off the end rather than been resolved. Nothing is archived when that happens -- the entry stays until retention ages it out.

The first fetch of a new node ingests everything still in the window, up to `limit`. Point a notify node at a busy feed and the first tick is the loud one.

##### Fields

- `url` -- required. The feed document, `http` or `https`. It must be readable without credentials: this node sends no token and no basic auth. A URL that carries its own `?token=` works, but it puts a secret in a file you probably commit.
- `limit` -- optional. How many of the feed's most recent entries to ingest per fetch. Empty is 50, the maximum is 500. Entries are ordered newest first by their published date, falling back to their updated date; entries the feed dated neither way sort last in the order it listed them.
- `interval` -- optional, e.g. `30m`. The shortest time between fetches. The feed still only loads on a poll tick, so the real cadence rounds up to the next one; empty fetches on every tick. It is not persisted -- a restart fetches every source once.
- `icon` -- optional glyph, from the curated feed icon set, shown on this source's items. Empty uses the default feed glyph.
- `image` -- optional uploaded image (the site's logo) shown as this source's mark instead of the glyph. It is a content hash of a normalized PNG kept in the app data dir, set through the editor's image picker; it is presentation only and never affects ingest. Empty falls back to `icon`.

##### What an entry becomes

Each entry is emitted as one item against the canonical item contract:

- **Identity** is the entry's `<guid>` (RSS) or `<id>` (Atom). Without one it is the entry's link, and without that a digest of its title and date -- which makes an edited title a new item, so a feed that publishes no ids is the one case where duplicates are possible.
- `kind` is `Post`, so `applies_to: [Post]` targets a feed entry whichever feed it came from.
- `title`, `url` and `author` come from the entry.
- `repo` is the **feed's** title, which is what the row renders above the entry.
- `body` is the entry's summary, or its content when it publishes no summary. HTML becomes markdown text, cut at 4000 characters: tags go, links stay as markdown links, and a block boundary becomes a space. This is a description, not a reader. Plenty of feeds publish no summary at all, and one that puts only a link in its summary (Hacker News points at its comments page) gives you that link and nothing else.
- `labels` are the entry's categories, at most 20.
- `published` and `updated` are RFC 3339 timestamps, absent when the feed omits them.

There is no `state`. A feed entry has no lifecycle to report, so nothing here ever archives itself -- route on `published`, or archive by hand.

##### Fetching

Each fetch sends the `ETag` and `Last-Modified` of the previous one. A feed that answers `304 Not Modified` costs one round trip and no parse, and the previous window is re-emitted unchanged. **Set an `interval`** anyway: a conditional request is cheap, not free, and the default poll tick is far more often than any feed publishes.

Two nodes pointing at the same URL share one fetch and one cache. A manual refresh drops both, so a feed whose `ETag` went stale can still be forced.

##### Failure

A fetch either produces the whole window or fails. These are all failures, not empty windows:

- the host is unreachable, or the request times out,
- a non-2xx response, including a 404 for a feed that moved,
- a document larger than 8 MiB,
- a document the parser cannot read as a feed -- an HTML error page served with a 200, most often.

A failed fetch changes nothing: the previous window stays in place, nothing is archived, and nothing is emitted. It is recorded in Activity. A source that keeps failing is re-announced at most once an hour until it succeeds.

#### Webhook source — `sources.webhook`

A **webhook source** node turns anything that can send an HTTP request into a flow input. The desktop runs a local listener on `127.0.0.1`; JSON POSTed to `http://127.0.0.1:<port>/hooks/<path>` becomes messages on this node's output, exactly like a GitHub source's poll would produce them.

The port is picked at random the first time Hive starts and then kept, so it differs per machine. Settings → Integrations → Webhooks shows this install's full endpoint URL, changes the port, or turns the listener off entirely.

##### Fields

- `path` — the endpoint under `/hooks/`: slug segments separated by `/`, e.g. `ci-alerts` or `ci/deploys`. Several nodes (even across flows) may share a path — each enabled one receives every request.
- `secret` — optional shared secret. When set, requests must carry the same value in the `X-Hive-Secret` header or they are rejected with 401.
- `icon` — optional glyph, from the curated feed icon set, shown on this source's items. Empty uses the default webhook glyph.
- `image` — optional uploaded image (a service logo) shown as this source's mark instead of the glyph. It is a content hash of a normalized PNG kept in the app data dir, set through the editor's image picker; it is presentation only and never affects ingest. Empty falls back to `icon`.

##### Delivery contract

- POST only, JSON body only (any shape — object, array, or scalar), capped at 1 MiB. Accepted deliveries return `202`.
- Item identity: a top-level `"id"` (string or number) is the stable key — re-posting the same id updates the same inbox item. Without an `id`, the body's content hash is the key, so exact duplicate deliveries deduplicate and any changed body is a new item.
- A top-level `"title"` and `"url"` are promoted so the item renders in feeds; everything else stays in the opaque `msg.Payload` for downstream nodes, decoded against the canonical item contract (docs/decisions/0008) wherever it renders.
- A top-level `"kind"` is the item's type label and what actions target with `applies_to`. Omit it and the item is kind `Item` — still automatable (`applies_to: [Item]`), just not distinguishable from other untyped deliveries.
- A top-level `"state"` drives lifecycle: `resolved`, `closed`, and `done` (case-insensitive) system-archive the item with the state as the archive reason; any other or absent state keeps it active. A later delivery whose state leaves one of those terminal values resurfaces the item. A stateless payload behaves exactly as before — manual triage only.

##### Rendering and transformation

Feeds render an item from what was ingested. A payload carrying the canonical item contract's fields (`id`, `kind`, `repo`, `title`, `url`, …; docs/decisions/0008) renders like a first-party item; anything else still ingests fine but renders minimally (title + link). To reshape a payload, put a `function` node downstream of this one; the node editor shows the last captured delivery, flags payloads missing the render-critical fields, and offers a copyable LLM prompt for writing that function. A function node must only change `msg.Payload` — `msg.Key` and `msg.Topic` are how feed membership resolves.

##### Behavior

The listener binds localhost only and resolves routes live from the current flows, so adding or editing webhook nodes needs no restart. Deliveries ingest immediately (no poll delay).

### Process

#### Function — `function`

A **function** node runs author-trusted JavaScript against every message that reaches it. It has 1 input and up to 16 outputs (`outputs`, default 1).

##### Fields

- `on_message` (required) — the body of `function on_message(msg, node, state, kv) { ... }`. Return:
  - a single `msg` — goes out port 0
  - an array of `msg` — multiple messages, all on port 0 (when `outputs` is 1)
  - a port-indexed array (e.g. `[msg, null]`) — `array[i]` goes out port `i`, once `outputs` is more than 1
  - `null` — discard (reported, never silently dropped)
- `outputs` — 1 to 16, default 1.
- `timeout` — how long a single `on_message` call may run before it's terminated and the message is discarded as an error. 100ms to 60s, default 5s.

`on_message` is the whole lifecycle: there are no start or stop hooks. The node does no I/O, so a stop hook could only mutate state that is about to be discarded, and setup belongs inside `on_message` as lazy initialization:

```
state.counts ??= {};
```

##### The msg shape

```
msg.Payload   // opaque — shape set by the source; reshape it toward the
              // canonical item contract (docs/decisions/0008) for feed rendering
msg.Key       // stable item identity (e.g. "colonyops/hive#2841")
msg.Topic     // "source:<source-id>"
msg.ID        // unique per log record
```

The message envelope is exactly these fields plus `Ts`, `SourceKind`, `SourceScope` and `OccurrenceKey`. Extra properties attached to `msg` itself are not carried to the next node — per-message data belongs in `msg.Payload`, which is opaque and passes through whole.

`msg.Payload` is usually a live object — never `JSON.parse` it. A scalar payload (a bare number or string) reads back `undefined` for any field access rather than throwing, so a change-detection recipe degrades to "never a meaningful change" instead of crashing.

##### Durable state: `kv`

`kv` is a small durable key-value store scoped to this node — the memory behind "notify once" and "notify on change". Unlike `state` it survives restarts and redeploys, and a write becomes durable atomically with the tick that made it: a script that throws after `kv.set` persists nothing.

- `kv.get(key)` — the stored value, or `undefined`
- `kv.set(key, value, { ttl })` — store a JSON-serializable value; `ttl` is a whole number of seconds (omit or `0` = no expiry). An expired key reads as absent immediately — re-arming does not wait on cleanup
- `kv.has(key)` / `kv.delete(key)` / `kv.keys(prefix)` — prefix matching is case-sensitive

Values must be JSON-serializable (a function or `undefined` throws). Keys cap at 512 bytes and stored values at 4096 — this is a dedup memory, not a blob store.

Key on the full identity tuple, `JSON.stringify([msg.SourceKind, msg.SourceScope, msg.Key])`, not `msg.Key` alone: two sources feeding one node can emit the same external id for different items.

KV identity is the node **id**, which the editor preserves across renames — renaming a node keeps its memory and does not re-notify. The id disappearing is what reclaims it: deleting the node (or replacing it with a fresh one) clears its KV on the next deploy, converting the node to another type clears it too, while hand-recreating a node under the *same* id inherits the old memory. Keep dedup on the notify branch, not upstream of a feed — feeds recompute membership from full snapshots on deploy, with `kv` deliberately reading empty during that recompute, so a dedup in front of a feed and its live snapshot handling would disagree.

##### Debugging: `console` and the dry run

`console.log` / `.info` / `.warn` / `.error` / `.debug` / `.trace` are available. Strings print verbatim, everything else as JSON. In a live run the output goes nowhere — it is a debugging affordance, not a log — so leaving a `console.log` in a deployed script costs nothing.

Where it *is* readable is a dry run: the `execute_flow` tool on this install's MCP server runs a flow against input you supply and returns what every node received, emitted per output port, and dropped, plus its console output and structured script errors with line and column. Nothing is committed — no feed membership, inbox rows, notifications, queued actions or durable `kv` — so it is safe to call repeatedly. The flow can be one that is installed or a document you have not saved yet; the input is delivered to any node you name, so a single function node can be exercised against a captured payload without its source running; and `kv` is an in-memory sandbox you seed, which is how notify-once logic is tested against a known starting state. The tool's own input schema is the request shape.

##### Example

```
if (msg.Payload.state === "closed") return null;   // drop
msg.Payload.tag = "reviewed";
return msg;
```

##### Splitting one message into many feed items

Return several messages, each with a `Key` you mint, to turn one source message
into one durable feed item per entity — the way to fan a metrics query with N
series into N items, each with its own payload, triage state, and actions:

```
return msg.Payload.result.map(function (s) {
  return {
    ...msg,                                  // keep Topic, SourceKind, SourceScope
    Key: [s.cluster, s.namespace, s.kind, s.name].join("/"),
    Payload: { title: s.kind + "/" + s.name, cluster: s.cluster, namespace: s.namespace },
    // No updatedAt: a metrics series carries no time of its own, so the item
    // is stamped when it is minted.
  };
});
```

Three rules make this work:

- **Mint `Key`, never `Topic`.** The key is the item's identity — set it to
  whatever makes each entity distinct. `Topic` is what scopes feed membership to
  its source; rewriting it detaches the item and breaks the lifecycle below.
- **Put what the item renders and acts on in `Payload`.** `title`, `url` and
  `updatedAt` are read from it; the rest is yours (an `applies_to` action reads
  `.Payload`). A key the source never emitted has no inbox row yet, so the feed
  mints one on first appearance from this payload.
- **Set `updatedAt` if the entity has a time of its own.** It is unix
  milliseconds and it is what a feed row shows as the item's age. Omit it and
  the item is stamped when it was minted, which is right for an entity that has
  no timestamp — a metrics series does not. Do not compute it from a payload
  field the source does not carry: `new Date(undefined)` is `0`, and the row
  then reads as decades old. The value is read once, at mint; a later poll
  re-claims the existing row without refreshing it.

Lifecycle is presence-based and automatic: each poll restates the whole set, so
an entity that stops appearing drops from the feed on the next poll (it moves to
Trash, and returns if the entity does — its read/unread state is kept). This
mirrors how a feed reconciles any source snapshot. One caveat: one item per
entity means an unbounded-cardinality query is an unbounded feed — key on a
bounded identity, not on an open-ended label.

##### Behavior

Each node instance gets its own JavaScript VM, so a timeout only affects this node, never a sibling. `state` survives across messages for the lifetime of one Deploy, but is not durable across app restarts, and a node that times out is respawned with a fresh `state`.

A timeout interrupts the script cooperatively. Code that neither allocates nor returns to the interpreter — a tight empty loop — can outlive its interrupt; the node's message is still discarded as an error, and the abandoned evaluation consumes part of a fixed process-wide budget rather than blocking anything else.

#### GitHub filter — `github-filter`

A **GitHub filter** node narrows a stream of GitHub items down to the ones you care about — a faithful port of the feed filtering the app has always had, now usable anywhere in a flow. It has 1 input and **2 outputs**: port 0 (pass) and port 1 (fail).

##### Fields

- `repos` / `exclude_repos` — one doublestar glob per line, matched against `owner/repo`.
- `authors` / `exclude_authors` — one glob per line, matched case-insensitively.
- `labels` / `exclude_labels` — one glob per line, matched against any of the item's labels.
- `types` — `pr` and/or `issue`.
- `reasons` — GitHub notification reasons (e.g. `mention`, `review_requested`). Items with no reason (search-only items) never match a reasons filter.

##### Behavior

Groups AND together; values within a group OR; exclude groups win over includes. Leave port 1 unwired to get today's plain "drop on fail" behavior, or wire it up to route rejected items somewhere else (e.g. a low-priority feed).

### Destinations

#### Action — `action`

An **action** node is a terminal (one input, no outputs). Every arriving
message creates a durable `output_command` for the selected global action.
Commands deduplicate on `(action_id, msg.Key)`, so retries or duplicate graph
invocations cannot repeat a side effect.

##### Selecting an action

The `action` field is an id from the global desktop `actions.yml` catalog. The
catalog supports create, edit, delete, and safe external YAML reload. Its
`show_in_detail` flag only controls whether the action can also be invoked
manually on an item; flow action nodes can reference the action regardless of
that flag or its `applies_to` kind scope.

##### Execution

This node only selects which catalog action runs — it carries no execution
semantics of its own. `action` resolves to one entry of type `launch-session`,
`shell`, or `publish-message`, and that type's own doc (see
`internal/app/actions/docs/`) is what defines how it runs. Action results are
typed to match: a successful run reports whatever that action type produces,
and a failed run remains readable from the durable command record with its
diagnostics.

#### Feed — `feed`

A **feed** node is a terminal (1 input, 0 outputs): every message routed here creates an unread item under this feed. A feed's durable identity is its flow-qualified node id (`<flowId>/<nodeId>`) — what membership claims are keyed on.

##### Fields

- `icon` — optional. One glyph from a curated feed icon set (e.g. `git-branch`, `bell`, `star`, `rss`, `webhook`, `bug`); empty uses the default (`git-branch`).
- `description` — optional, up to 500 characters. Free-text context for what this feed collects — useful for explaining what an LLM-generated feed is for.

`icon` and `description` are cosmetic only and never affect which items land in the feed.

##### Behavior

A message routed here always lands — there's nothing downstream to wire. Items stay unread until triaged.

A feed never interrupts: it is a place items live, read at the reader's own pace. To be notified about something, route it to a [notify](notify.md) node — typically a second branch off the same filter, so the items land in the feed *and* raise a banner.

#### Notify — `notify`

A **notify** node is a terminal (one input, no outputs). Every arriving
message creates a durable `output_command` that the backend delivers as a
native system notification. It is how a flow says "this one is worth
interrupting me for" — routing, rather than an app-wide on/off switch.

##### Templates

`title` and `body` are Go templates rendered over the arriving message, the
same way an action's `prompt_template` is:

```
title: "{{ .Payload.repo }} needs review"
body:  "{{ .Payload.title }}"
```

`.Payload` is the item, `.Key` its source id. A title that renders blank
fails the command rather than sending a nameless banner.

##### Clicking a notification

Clicking the banner focuses Hive and selects the item that triggered it. An
item Hive no longer holds (or a message no source produced) still notifies —
the click just raises the window.

##### What stops it from being noisy

- **Dedup.** Commands deduplicate on the message's occurrence key, which
  changes only when something meaningful about the item changed. A source
  re-emitting an unchanged item on every poll notifies once, not once per
  tick. A message with no occurrence key falls back to a digest of its
  payload, so identical payloads still collapse.
- **Cooldown.** A per-item delivery floor: after this node interrupts about
  an item, it stays quiet about that same item for `cooldownSeconds` (default
  300; `0` disables the floor entirely), however often the item genuinely
  changes. It is not dedup — deciding *whether* an item is worth notifying
  belongs upstream; the cooldown only bounds how often the same accepted item
  may re-interrupt.
- **Staleness.** A notification queued more than 10 minutes before it could
  be delivered — the app was closed, or the queue was backed up — is dropped
  instead of arriving late.
- **Replay.** Recomputing a flow on startup or deploy never re-sends
  anything: replay commits feed memberships only, and snapshot messages are
  dropped before they reach this node.

##### Settings always win

Delivery is checked against the app's notification settings immediately
before each send, so turning notifications (or system notifications) off
silences every flow at once. `sound: false` can silence this node, but it
cannot make a notification audible when the global sound setting is off.

`severity` selects the native interruption level: `info` (the default) and
`success` are ordinary banners, while `warning` and `error` are marked
time-sensitive.

## Worked example

A complete, valid flow — a GitHub search filtered down to non-bot PRs in one
org, tagged by a function node, then routed to both a feed and an action:

```yaml
version: 1
name: Frontend Triage
nodes:
  - { id: in-prs, type: sources.github, credential: github/octocat, kind: search, query: "is:open is:pr archived:false" }
  - { id: drop-bots, type: github-filter, exclude_authors: ["*[bot]"], repos: ["colonyops/*"] }
  - id: tag
    type: function
    outputs: 2
    on_message: |
      if (msg.Payload.state === "closed") return null;
      msg.Payload.tag = "review"; return [msg, null];
  - { id: team-feed, type: feed }
  - { id: spawn-review, type: action, action: review-pr }
wires:
  - { from: in-prs, to: drop-bots }
  - { from: drop-bots, to: tag }
  - { from: tag, out: 0, to: team-feed }
  - { from: tag, out: 0, to: spawn-review }
```

---

What I want:

<describe it here>
