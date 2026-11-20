---
name: dev-orchestrate
description: >
  Coordinate parallel work across Hive worker sessions from a normal chat. Splits a
  goal into independent tasks, tracks them in a Honeycomb (hive hc) epic, dispatches
  one pi worker session per task with hive batch, and coordinates through hive msg:
  answering worker questions, catching stalled workers with hive-agent peek, and
  escalating decisions to the user. This chat stays the single place where the user
  approves results. Use when the user wants to fan out, run several agents in
  parallel, dispatch sessions, or work through a queue too big for one context.
argument-hint: "[goal or task list] [--workers N]"
---

# Orchestrate

You are the coordinator. You plan the split, dispatch workers, and keep them moving;
the workers do the work. You do not do a worker's task yourself unless the user asks,
and nothing a worker produces leaves the machine without the user's approval here.

**Use this when** each unit of work needs its own top-level session: its own worktree,
a fresh context, its own sub-agents (pi sub-agents do not nest), or hours of runtime
the user may want to watch. **Use pi sub-agents instead** for bounded parallel work
inside one session, such as a reviewer fan-out.

## Tools and what they guarantee

| Tool | Role | Guarantee |
|------|------|-----------|
| `hive hc` | Source of truth for every task's status and results | Durable; shared by all worktrees of a repo |
| `hive batch` | Starts worker sessions | One session and worktree per entry |
| `hive msg` | Events from workers, answers to workers | Durable, but `sub --wait` only returns messages published *during* the wait |
| `hive-agent peek` / `send` | Read or type into a worker's agent pane | Pane text only; its `state` field matches Claude Code's UI, so read the tail |
| `hive todo add` | Put a decision in the user's Hive action panel | Durable, visible while the user is away |

Because `--wait` misses messages sent between waits, never treat messages as the
record. They only wake you; Honeycomb is what you act on.

## Step 1 — Plan the split with the user

Restate the goal and propose the tasks. Each task must:

- produce one deliverable that can be checked on its own,
- not depend on another task's output, or name that dependency as a blocker,
- fit one worker session.

For each task, write a **worker contract**: the deliverable and where it goes (a file
under `.hive/`, a branch commit, an hc comment), the workflow or skill to run, what
the worker must not do, and when it must stop and ask. Default prohibitions: no
pushing, posting, commenting, or messaging outside Hive unless that is the agreed
deliverable.

Confirm the tasks, contracts, and concurrency with the user before dispatching.
Default to 3 concurrent workers; more workers mostly buys rate-limit errors. The
worker agent is Hive's configured default (`hive config`, `agents.Default`) unless the
user picks another profile.

## Step 2 — Create the epic

Run from a checkout of the repository the work targets. Honeycomb resolves the repo
from the working directory, and workers' worktrees see the same items. For work across
several repositories, create one epic per repository, each from its own checkout.

Workers write `.hive/` files into Hive's shared context directory for the repository
(`~/.local/share/hive/context/<owner>/<repo>`). A normal checkout may have no `.hive`
link. If `.hive` is missing, run `hive ctx init` so this session reads the same
directory; never `mkdir` it.

```bash
hive hc create <<'JSON'
{
  "title": "<goal> (<YYYY-MM-DD>)",
  "type": "epic",
  "desc": "Coordinated by dev-orchestrate. Events: orchestrate.<epic-id>",
  "children": [
    { "title": "<task>", "type": "task", "desc": "<worker contract>" }
  ]
}
JSON
```

The epic ID only exists after creation, so update the description with the real
topic: `hive hc update <epic-id> --desc "Coordinated by dev-orchestrate. Events:
orchestrate.<epic-id>"`. That recovers the topic if this chat is lost. Record the
epic ID, task IDs, and topic in the chat.
Keep scratch files (batch JSON, dispatch output) in
`${XDG_DATA_HOME:-$HOME/.local/share}/hive-orchestrate/<epic-id>/`, so a failed
dispatch can be inspected and the iCloud-synced context directory stays clean.

Status rules for every task:

| Status | Set by | Meaning |
|--------|--------|---------|
| `open` | coordinator | not dispatched, or sent back for rework |
| `in_progress` | worker (`--assign`) | claimed by a worker session |
| `done` | coordinator only | deliverable accepted |
| `cancelled` | coordinator only | dropped |

Workers never set `done` or `cancelled`. That keeps acceptance in this chat.

## Step 3 — Dispatch workers

Write the batch file, then dispatch. Tag every session with `orchestrate` and the epic
ID; the tags recover the worker list if this chat is lost
(`hive session list --tags <epic-id> --json`).

```json
{
  "sessions": [
    {
      "name": "<short-task-slug>",
      "prompt": "<worker prompt, below>",
      "tags": ["orchestrate", "<epic-id>"]
    }
  ]
}
```

```bash
hive batch -f "$dir/batch-<n>.json" | tee "$dir/batch-<n>.out.json"
```

Do not set `clone_strategy`; the Hive config decides it per repository. Set `remote`
only when the task targets a different repository from the current directory. Record
each task's session ID and name from the output in an hc comment on the task.

`hive hc update --assign` binds to the calling session, so you cannot claim a task for
a worker. The prompt names the task ID and the worker claims it.

### Worker prompt

Fill this in per task. It must stand alone: the worker has not seen this chat.

```
You are a worker in an orchestrated batch. Coordinator topic: orchestrate.<epic-id>.
Your task: <task-id>. Read it with `hive hc show <task-id>`; its description is
your contract.

1. Claim it: `hive hc update <task-id> --status in_progress --assign`.
2. Publish `{"task":"<task-id>","event":"claimed"}` to the topic with
   `hive msg pub -t orchestrate.<epic-id> -m '<json>'`.
3. Do the work: <workflow or skill, e.g. /dev-review <url> --to github>.
4. Record the result as an hc comment on your task: what you produced, where it is,
   and anything the coordinator must decide. Do not set the task to done.
5. Publish `{"task":"<task-id>","event":"done","summary":"<one line>"}`, then stop.

If you need a decision you cannot make from the contract, comment the question on
your task, publish `{"task":"<task-id>","event":"question","text":"<question>"}`,
then wait for the answer on your inbox: check `hive msg inbox --ack` first, then
`hive msg inbox --wait --timeout 15m`, and check `hive msg inbox --ack` again
after each wait, because a reply can arrive just before a wait starts. After three timeouts, comment that you
are blocked, publish `{"task":"<task-id>","event":"blocked"}`, and stop.

If you fail, comment the error and publish `{"task":"<task-id>","event":"failed"}`.
Never: <contract prohibitions>. Never change another task.
```

## Step 4 — Coordinate

Loop until every task is `done` or `cancelled`:

1. **Wait** for an event, at most 10 minutes:
   `hive msg sub --wait --topic orchestrate.<epic-id> --timeout 10m`.
2. **Catch up** on everything since the last event you handled:
   `hive msg sub --topic orchestrate.<epic-id>`, keeping messages whose `created_at`
   is newer than the last one you processed.
3. **Reconcile** from Honeycomb: `hive hc list <epic-id> --json`, and
   `hive hc show <task-id>` for tasks with new events. Act on hc, not the message.
4. **Handle each event:**
   - `question` — answer from the contract, the repository, or the user's earlier
     instructions, with `hive msg pub -t agent.<worker-session-id>.inbox -m '<answer>'`. If
     the answer is the user's decision, ask in chat and run `hive todo add` with the
     task URI, then relay their answer.
   - `done` — check the deliverable against the contract. Accept it into the
     results summary, or send concrete rework through the worker's inbox and set
     the task back to `open`. Recycle accepted sessions
     (`hive session recycle <id>`); for a worktree session this removes the
     checkout and session record and keeps the shared bare clone. If Hive refuses
     because of unpushed commits, verify with `git log @{u}..` in the worktree
     before using `--force`: the check reports false positives for worktrees,
     whose bare clone has no remote-tracking refs. Never `--force` a session whose
     commits are not on the remote.
   - `failed` or `blocked` — read the hc comments and decide: re-dispatch with a
     fixed contract, ask the user, or cancel.
5. **Check quiet workers.** For an `in_progress` task with no event for two waits,
   run `hive-agent peek <session-name> --lines 30` and read the tail. If the agent
   is idle at its prompt, nudge it with `hive-agent send <session-name> "<next
   step>"`. If it is waiting on a prompt it cannot answer, decide or escalate. If the
   tmux session is gone, treat the task as failed.
6. **Refill:** while fewer than N workers are active and `open` tasks remain,
   dispatch the next one.

Keep the chat short while looping: one line per event handled. The user can interrupt
at any time; after answering them, resume the loop at step 2 so nothing is missed.

## Step 5 — Report and hand back

When the queue is empty, or the user stops the run, give a results table (task,
status, deliverable, decision needed) and list anything that needs the user: drafts
to approve, branches to review, follow-ups. Close the epic only when every task is
`done` or `cancelled`. Leave workers that hold unaccepted work running and say which
ones they are.

Anything external, such as GitHub comments, pushes, or Slack messages, waits for the
user's approval of the exact text here, even when a worker drafted it.
