---
name: collab-plan
description: >-
  Run a multi-Claude collaborative design session over Slack. Use this whenever
  the user wants several people (each with their own Claude) to co-author a
  design doc, RFC, technical plan, or architecture proposal for a shared repo —
  phrases like "start a collab-plan", "let's design this together", "get the
  team's Claudes to weigh in", "collaborate on this design with Alice and Bob",
  "kick off a design review in Slack", or "join the collab-plan in #channel".
  It coordinates an initiator Claude and any number of participant Claudes using
  a Slack thread as the message bus and Slack canvases as the shared design
  document. Trigger both to START a session (initiator) and to JOIN one
  (participant). Requires the Slack tools and, ideally, a shared git repo.
---

# collab-plan

A protocol for **many Claudes collaborating on one design**. Each collaborator
runs their own Claude session, from a checkout of the **same repo**, and they
coordinate entirely through Slack:

- **A Slack thread** is the message bus. Every coordination signal is a reply in
  that thread carrying a small machine-readable block (see
  `references/protocol.md`). The thread doubles as the human-readable record.
- **Slack canvases** are the shared documents. The **initiator** owns one canvas
  — the *materialized design doc*, which is the single source of truth. Each
  **participant** produces their own canvas capturing the decisions and design
  constraints they contribute.

There are two roles. This skill runs both — figure out which one applies, then
follow that section.

- **Initiator** (Claude A): opens the session, frames the problem, invites
  people, answers questions during the work, and synthesizes everything into the
  final design.
- **Participant** (Claude B, C, …): joins a session, does independent analysis
  from the shared repo, discusses in-thread, and hands back a report.

> Before your first canvas/message/thread call, quickly confirm the parameter
> shapes of the Slack tools you'll use — MCP wrappers vary. Read
> `references/protocol.md` once; it defines the exact message format both roles
> depend on. If Slack tools aren't connected, tell the user and stop.

## Deciding the role

1. If the user clearly says "start / kick off / open a collab-plan" → **initiator**.
2. If they say "join / participate in / respond to the collab-plan" and point at
   a channel or link → **participant**.
3. If ambiguous, read the target channel (`slack_read_channel`) and look for an
   open `INVITE` (a message with a `collab-plan` block of `type: INVITE` whose
   session isn't yet `CLOSE`d). If one exists and the current user isn't its
   author → **participant**. Otherwise ask the user which they want.

Keep a small local state file so a session survives across Claude runs (a user
may re-invoke this skill later to check status or resume). Default location:
`.collab-plan/state.json` in the repo root (create the dir; suggest gitignoring
it). Store at least: `role`, `channel_id`, `session_ts`, `my_canvas_id`,
`design_canvas_id`, `required` (participant handles the initiator is waiting on),
`joined`, `reported`, and `last_seen_ts` (for incremental thread reads).

---

## Role: Initiator

### 1. Frame the work (before touching Slack)

Talk with the user to pin down the design problem. Explore the shared repo as
needed. You need enough to write a real problem statement — don't invent scope.
Capture:

- **Problem statement** — what we're solving and why now.
- **Scope & non-goals** — what's in, what's explicitly out.
- **Context** — the repo, relevant paths/systems, constraints already known.
- **Open questions** — the decisions you actually want collaborators to shape.
- **Who to invite** — resolve each person to a Slack user ID with
  `slack_search_users`. Decide which invitees are **required** (their feedback
  blocks completion) vs. optional (nice-to-have). By default treat everyone the
  user explicitly pings as required.

### 2. Pick the channel

There is **no channel-creation tool**. Ask the user to create the collaboration
channel and invite the people they care about (this is step 1 of their plan, and
it's a human action), then give you the channel — resolve it with
`slack_search_channels`. Don't proceed without a real `channel_id`.

### 3. Create the design-doc canvas (source of truth)

Build the materialized design doc from `assets/design-doc-canvas.md`. Fill in the
problem statement, scope, context, and open questions from step 1. Leave the
"Decisions", "Constraints", and "Final design" sections as placeholders — they
fill in as collaboration proceeds. Create it with `slack_create_canvas` and keep
the returned `canvas_id` and URL. This canvas is authoritative: the thread is
discussion, the canvas is the design.

> Canvas editing note: `slack_update_canvas` needs a **fresh** `section_id` from
> `slack_read_canvas`, and section IDs change after every edit. Always read the
> canvas immediately before updating it; never reuse a stale section ID.

### 4. Post the INVITE and open the session

Send one message to the channel with `slack_send_message`. This is the **root**
of the collab thread; its `ts` becomes the `session` id for everything that
follows — save it. The message contains human framing (a short summary + the
canvas link), pings the invited people, and carries an `INVITE` block listing
the `required` handles. See `references/protocol.md` for the exact block; build
it with `scripts/protocol.py format`.

Record `session_ts`, `design_canvas_id`, and `required` in state.

### 5. Wait for JOINs (the "+1")

There is **no reaction API**, so a participant signals participation by replying
with a `JOIN` block — that *is* the "+1". The rule from the plan: **the work is
not done until every required participant who was pinged has provided feedback.**

Poll the thread with `slack_read_thread` (use `oldest: last_seen_ts` to fetch
only new replies; advance `last_seen_ts` each pass). Between polls, sleep with
bash (e.g. `sleep 45`) rather than busy-looping. Parse new messages with
`scripts/protocol.py parse`. Track who has `JOIN`ed in state.

Bounded waiting: poll for a reasonable window (default ~10 rounds), then report
status to the user — "Alice and Bob joined; still waiting on Carol" — and let
them decide whether to keep waiting, ping again, or drop a required participant.
Don't block a session forever on someone who's offline.

### 6. Collaborate in real time

While participants work, the thread is a live message bus. Each poll, look for:

- `QUESTION` blocks addressed to you (`to` includes your handle or is empty =
  broadcast) → answer with a `REPLY` block referencing their message `ts`.
- `NOTE` blocks that reveal a decision or constraint → fold it into the design
  canvas as it firms up (read canvas → update the relevant section). Keeping the
  canvas current is the whole point; don't let it drift behind the discussion.

You can also raise your own `QUESTION`s to specific participants when you need a
direction call. This is the mechanism by which Claude A watches for Claude B and
vice versa: everyone polls the same thread and reacts to blocks addressed to them.

### 7. Collect REPORTs

A participant finishes by posting a `REPORT` block linking their own canvas.
Mark them `reported` in state and read their canvas (`slack_read_canvas`) so you
have their decisions and constraints in context. **Completion condition:** every
`required` participant is either in `reported` or has explicitly bowed out (a
`NOTE` declining, or the user releases them). Until then, keep polling
(steps 5–6 interleave — new joiners, questions, and reports all arrive on the
same thread).

### 8. Synthesize the final design

Once all required reports are in:

1. Read the design canvas and every participant canvas.
2. Reconcile: merge agreed decisions, surface conflicts, and note which
   constraints are hard vs. soft. Where participants disagree, make a call (or
   flag it for the user) rather than silently dropping one side.
3. Update the design canvas — fill "Decisions", "Constraints", and "Final
   design", and set status to reflect closure. This canvas remains the source of
   truth; the participant canvases are inputs, cited from it.
4. Post a `SYNTHESIS` block to the thread summarizing the outcome and linking the
   final canvas, followed by a `CLOSE` block to mark the session done.

Then give the user a short recap and the canvas link.

---

## Role: Participant

### 1. Find the session

From the channel or link the user gave, locate the open `INVITE`
(`slack_read_channel`, then `slack_read_thread` on the root). The root message
`ts` is the `session` id. Read the linked design-doc canvas
(`slack_read_canvas`) — that's the initiator's problem statement, scope, and
open questions. Save `channel_id`, `session_ts`, and `design_canvas_id` to state.

### 2. JOIN (send your +1)

Reply in the thread with a `JOIN` block (`scripts/protocol.py format`). This
tells the initiator to wait for your feedback before finishing. Do this early —
before you disappear into analysis — so the initiator knows to hold the session
open for you.

### 3. Do the work from the same repo

Analyze independently against the **shared repo** (the reason everyone starts
from the same checkout). Form your own view: the decisions you'd make and the
design constraints you'd impose, grounded in the actual code. This is meant to
be genuine parallel thinking, not a rubber stamp of the initiator's framing —
disagreement surfaced now is the point.

While working, poll the thread (`slack_read_thread` with `oldest: last_seen_ts`,
sleeping between passes) for `QUESTION`s addressed to you and answer with
`REPLY` blocks. Raise your own `QUESTION`s to the initiator or another
participant when you need a call. Post `NOTE`s for decisions/constraints worth
putting on the record as you go.

### 4. Write your report canvas

Capture your contribution in a canvas from `assets/participant-report-canvas.md`:
the decisions you made and why, the design constraints you're asserting (hard vs.
soft), risks/open questions, and anything the synthesis must not drop. Create it
with `slack_create_canvas`; save `my_canvas_id`.

### 5. REPORT and stay reachable

Post a `REPORT` block to the thread linking your canvas. Until you see a
`SYNTHESIS`/`CLOSE`, stay available: keep answering `QUESTION`s addressed to you
so the initiator can reconcile without guessing. Once the session is `CLOSE`d,
you're done — surface the final canvas link to the user.

---

## Watching / polling loop (both roles)

You can't subscribe to pushes, so "watching for the other Claude" is bounded
polling:

1. `slack_read_thread(channel_id, message_ts=session_ts, oldest=last_seen_ts)`.
2. Parse new messages (`scripts/protocol.py parse`); act on any block addressed
   to you; advance `last_seen_ts` to the newest `ts` seen.
3. If the thing you're waiting for hasn't arrived, `sleep` (30–60s) and repeat,
   up to a sensible cap.
4. When the cap is hit, stop and report status to the user instead of looping
   silently. Sessions are resumable from state — the user can re-run the skill
   to pick the poll back up.

## Failure modes to handle gracefully

- **No canvas support** (free Slack teams can't use canvases): fall back to
  posting the design doc as a pinned message / thread reply and treat that
  message as the source of truth. Tell the user about the downgrade.
- **Required participant never joins**: don't hang. Report and let the user
  decide (re-ping, wait, or release them from `required`).
- **Two initiators / duplicate INVITEs in a channel**: use `session_ts` to
  disambiguate; always act within one session.
- **Externally shared (Slack Connect) channels**: `slack_send_message` can't
  post there — flag it and ask for an internal channel.

## Reference material

- `references/protocol.md` — the message block format, all message types, and
  parsing rules. Read this before sending or reading any coordination message.
- `scripts/protocol.py` — `format` and `parse` helpers so every session builds
  and reads blocks identically. Run `python scripts/protocol.py --help`.
- `assets/design-doc-canvas.md` — initiator's source-of-truth canvas template.
- `assets/participant-report-canvas.md` — participant's report canvas template.
