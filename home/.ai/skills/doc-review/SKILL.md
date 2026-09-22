---
name: doc-review
description: >
  Open a plan, research note, or design doc in Plannotator's browser UI for
  human review and act on the returned annotations. Use when the user says
  "review the plan", "open the doc in plannotator", "let me annotate the
  research", "gate this spec", or returns to a session to review work the agent
  produced.
allowed-tools: "Bash(plannotator:*),Bash(ls:*),Bash(find:*),Bash(stat:*),Read"
disable-model-invocation: true
---

# Doc Review

Open a markdown document in Plannotator with `--gate`, then act on the
annotations in the same conversation. `--gate` adds the **Approve** button and
blocks until the user approves, denies, or closes the tab.

## Argument handling

`$ARGUMENTS` controls which doc opens:

| Argument     | Behavior                                                     |
| ------------ | ------------------------------------------------------------ |
| _empty_      | Newest `.md` across `.hive/plans/`, `.hive/research/`        |
| `plans`      | Newest `.md` in `.hive/plans/`                               |
| `research`   | Newest `.md` in `.hive/research/`                            |
| `references` | Newest `.md` in `.hive/references/`                          |
| any path     | That file directly (relative to cwd or absolute)             |
| any URL      | That URL (Plannotator fetches `https://` natively)           |

`.hive/` is a symlink into `~/.local/share/hive/context/`. Resolve it with `ls`
or `find` — do NOT use Glob, it won't follow the symlink. If `.hive/` doesn't
exist, tell the user to run `hive ctx init` and stop.

To pick the newest file on macOS, use `stat -f '%m %N'` and take the highest
mtime. If no candidate is found, say which directory was empty and stop — don't
guess a path.

## Run

```bash
plannotator annotate <resolved-path-or-url> --gate
```

Run the command yourself. Don't ask the user to copy it into a terminal.

Two constraints worth remembering:

- Plain `annotate` without `--gate` has no **Approve** button, only feedback or
  close. Never promise an approval action unless `--gate` is present.
- `.env` files are refused by design, and source code belongs in `/diff-review`,
  not here.

## After plannotator returns

- **Annotations returned** — address each one in the same conversation. If the
  document needs edits, edit the file, summarize what changed, and offer to
  re-gate.
- **Approval / LGTM** — acknowledge briefly and continue with whatever the doc
  was setting up (implementation, the next research question).
- **Approved with notes** — carry the notes into subsequent work as guidance;
  don't revise the document over them.
- **Denied with no actionable feedback** — ask what they'd like changed before
  re-gating.
- **Session closed without feedback** — say so in one sentence and continue.

## Notes

- The result comes back on the same CLI invocation, so the annotations land in
  the next tool turn — no polling, no separate hook.
- Files are read from disk at their real paths; keep the reviewed source where it
  lives rather than copying it somewhere temporary.
- For code changes use `/diff-review`. For the last thing you said in chat, use
  `/msg-review`.
