# collab-plan protocol

Collaborators never see each other's Claude sessions. They coordinate only
through one Slack thread. For that to work, every coordination message carries a
small **machine-readable block** that any participant's Claude can parse
unambiguously, alongside human-readable prose so people reading the channel
follow along too.

## Anatomy of a coordination message

A message is: optional human prose, then exactly one fenced block whose info
string is `collab-plan` containing a single-line JSON object.

````
Kicking off the auth-refactor design. Canvas + scope inside. Pinging the folks
whose input I need. 👇

```collab-plan
{"v":"1","type":"INVITE","session":"1721490000.000100","from":"patrick","to":["alice","bob"],"canvas":"https://acme.slack.com/docs/T1/F123","text":"Auth refactor design"}
```
````

Parsing rule: scan a Slack message for a fenced code block tagged
`collab-plan`; the body is one JSON object. Ignore messages without such a
block — they're ordinary human chatter, not protocol. Build and read these with
`scripts/protocol.py` so formatting stays identical across sessions.

## Fields

| field | required | meaning |
|---|---|---|
| `v` | yes | Protocol version. Currently `"1"`. |
| `type` | yes | One of the message types below. |
| `session` | yes | The root thread `ts` that identifies this collab session. |
| `from` | yes | Sender handle — the Slack display name or user ID of the human whose Claude is posting. |
| `to` | no | Array of handles this message is addressed to. On `INVITE` it lists the **required** participants. Empty/absent = broadcast to everyone in the session. |
| `canvas` | no | URL of the relevant canvas (`INVITE` → design doc; `REPORT` → participant canvas; `SYNTHESIS` → final design). |
| `ref` | no | The `ts` of the message this one responds to (used by `REPLY`). |
| `text` | no | Short one-line summary. The human prose above the block carries the detail. |

Keep the JSON on **one line** — Slack fenced blocks preserve newlines and a
multi-line object is easy to mangle. `scripts/protocol.py format` guarantees
this.

## Message types

| type | sent by | meaning / effect |
|---|---|---|
| `INVITE` | initiator | Opens the session. Its message `ts` **is** the `session` id. `to` = required participants; `canvas` = design doc. |
| `JOIN` | participant | The "+1". Declares participation; the initiator must now wait for this person's `REPORT` before completing. |
| `NOTE` | anyone | On-the-record remark: a decision, a constraint, a status update. The initiator folds these into the design canvas. |
| `QUESTION` | anyone | A question addressed to `to`. Others watch for questions aimed at them. |
| `REPLY` | anyone | Answer to a `QUESTION`; set `ref` to that question's `ts`. |
| `REPORT` | participant | "I'm done." `canvas` links the participant's report canvas. Satisfies the completion condition for that participant. |
| `SYNTHESIS` | initiator | Final design is ready; `canvas` links the (updated) source-of-truth design doc. |
| `CLOSE` | initiator | Session finished. Watchers can stop polling. |

## Lifecycle

```
INVITE ──▶ JOIN(s) ──▶ (NOTE / QUESTION / REPLY, freely interleaved) ──▶ REPORT(s) ──▶ SYNTHESIS ──▶ CLOSE
```

The initiator's completion gate: for every handle in the `INVITE`'s `to`, there
must be a matching `REPORT` (or an explicit decline) before `SYNTHESIS`.

## Handles

A "handle" is how a person is named in `from`/`to`. Prefer the Slack user ID
(stable, unambiguous) resolved via `slack_search_users`; a display name is
acceptable if IDs are impractical. Whatever you choose, be consistent within a
session so `to`-matching works. When pinging people in the human prose, use a
real Slack mention so they get notified — the `to` array is for machines, the
mention is for humans.

## Why this shape

- **One thread = one session.** The root `ts` is a natural, collision-free id and
  keeps all coordination in one place humans can read.
- **Fenced JSON** survives Slack's markdown rendering intact and is trivial to
  find and parse, while the prose above it keeps the thread human-friendly.
- **`JOIN` instead of an emoji reaction** because there's no reaction tool — and
  a parseable message is actually better than a 👍 for tracking who's committed.
- **Polling with `oldest`** lets each side read only new replies, so watching the
  thread stays cheap even over a long session.
