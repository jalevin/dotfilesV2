---
name: msg-review
description: >
  Open the latest assistant message in Plannotator's annotation UI and use the
  returned annotations to revise it or continue. Use when the user says
  "annotate that", "let me mark up your last message", "review what you just
  said", or "open that in plannotator".
allowed-tools: "Bash(plannotator:*)"
disable-model-invocation: true
---

# Message Review

Open the latest rendered assistant message in Plannotator so the user can mark
it up inline, then act on what comes back.

## Before running

Do **not** print a commentary or status message first. This command targets the
latest rendered assistant response, so any preamble becomes the thing being
annotated. Go straight to the command.

## Run

```bash
plannotator annotate-last
```

Run the command yourself. Don't ask the user to copy it into a terminal.

The session log is discovered automatically for the current agent host, so no
path argument is needed.

## After plannotator returns

- **Annotations returned** — fold the feedback into a revised version of that
  message, or into the next step if the annotations point forward rather than
  back.
- **Approved with notes** — the notes are guidance, not a rewrite request. Carry
  them into subsequent work and leave the message alone.
- **Session closed without feedback** — mention it briefly and continue.

## Notes

- This annotates prose, not files. For code changes use `/diff-review`; for a
  saved markdown doc use `/doc-review`.
