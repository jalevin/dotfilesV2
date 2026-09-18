---
name: hive-mcp
description: "Point a coding agent at this install's live MCP server — the tools it calls to drive the app directly, without editing config files. Use when configuring this in Hive Desktop (http://127.0.0.1:50505/mcp)."
---
Drive Hive Desktop directly through its local MCP server, instead of — or
alongside — editing its config files.

Hive Desktop is a desktop app that turns GitHub activity and webhook deliveries
into triaged feeds and automated coding-agent sessions. Its configuration is
plain text on this machine, meant to be edited directly:

- /Users/jeff/.config/hive/desktop/flows/<id>.yaml — flows: the graph that decides what reaches which feed and what fires an action.
- /Users/jeff/.config/hive/desktop/actions.yml — actions: what a feed item, a terminal session or window, or a flow node can trigger.
- /Users/jeff/.config/hive/desktop/settings.yaml — app settings: polling, updates, notifications, appearance, keyboard shortcuts.

This install also runs an MCP server whose tools observe and operate the app:
list and create profiles, read a profile's graph, read the inbox and feeds, set
a profile avatar, force a source refresh, and dry-run a flow against a payload
you supply — without editing the files above.

Connect over Streamable HTTP at:

    http://127.0.0.1:50505/mcp

There is no token to configure: the server is bound to loopback and spawns no
processes.

The server describes itself, so you do not work from this prompt — you work
from the server. Call `tools/list` and work from what it reports; the input
schemas come from the server's own types, so they never drift from what it
actually accepts.

Conventions those schemas assume:

- A failing tool answers with an error result whose text opens with a stable machine string — `invalid`, `not_found`, `conflict`, `unavailable`, `unauthenticated`, `internal` — followed by the detail. Branch on that, never on the prose.
- Every id-taking argument names a profile, and `list_profiles` is where profile ids come from. `get_flow` turns one into its graph, which is where node ids come from — `execute_flow` and the node-image tools take those.
- A thing that does not exist is `not_found`, not an empty collection. An empty list means nothing has landed there, never that you named the wrong profile, feed or item.
- Images go in as base64 and come back as images: `set_profile_image` takes base64 bytes (a `data:` URL is accepted, prefix and all), while `get_profile_image` answers with the PNG itself.
- Any tool that would answer with source-supplied JSON takes a `detail` argument and defaults to `summary`, which omits it. A payload is as large as the source made it and gets repeated per item or per node, so ask for `full` only once you have narrowed the read. Each answer echoes the level it used.
- Scheduled chats are managed here too. `list_workspaces` names the agent workspaces; `list_schedules`, `put_schedule` and `remove_schedule` read and write one workspace's `schedules:` list, editing its `agent-workspace.yaml` in place with every other key and comment kept; `put_schedule` on an existing id changes only the fields you pass, so an omitted `disabled` or `name` stays as stored; `preview_schedule` dry-runs a cron and prompt template before you save it, rendering the prompt both with a previous run and as the first run sees it; `schedule_runs` reads what a schedule did. Running a schedule outside its timetable spawns an agent CLI, which this server never does; that stays the Chats area's "Run now".
- Reads and dry runs are safe to repeat. `execute_flow` commits nothing in particular — no feed membership, inbox rows, notifications, queued actions or durable kv — so use it to test a flow edit, including one you have not saved, instead of deploying and waiting for a poll.

---

What I want:

<describe it here>
