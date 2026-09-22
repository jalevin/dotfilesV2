---
name: diff-review
description: >
  Open the current branch's diff (or a specific PR) in Plannotator's
  browser-based code review UI and act on the returned feedback. Use when the
  user says "review my changes in plannotator", "open the diff for review",
  "review this PR in plannotator", "let me annotate the diff", or returns to a
  session to gate code the agent produced.
allowed-tools: "Bash(plannotator:*),Read"
disable-model-invocation: true
---

# Diff Review

Open code changes in Plannotator's review UI, then act on the feedback in the
same conversation. Review mode handles both the current worktree (no args) and a
specific PR (URL).

## Argument handling

`$ARGUMENTS` controls what gets reviewed:

| Argument        | Behavior                                            |
| --------------- | --------------------------------------------------- |
| _empty_         | Current branch's changes vs the trunk merge-base    |
| GitHub PR URL   | That pull request (needs an authenticated `gh`)     |
| GitLab MR URL   | That merge request (needs an authenticated `glab`)  |
| `--base <ref>`  | Compare against `<ref>` instead of the trunk        |

Don't try to detect or resolve the current PR yourself — `plannotator review`
already inspects the worktree when called with no args. Pass `$ARGUMENTS`
through.

Reviewing one layer of a stacked branch? Pass `--base <the branch immediately
below yours>` so the session shows only what this layer adds instead of
everything since `main`. `--base` is git-only and session-only — it does not
write any saved default.

## Run

```bash
plannotator review $ARGUMENTS
```

Run the command yourself. Don't ask the user to copy it into a terminal.

The session blocks until the user submits, approves, or closes the tab — that can
take minutes. Launch it with a long (or no) timeout and read stdout when it
exits. Do not kill the process to "finish" a review; a session that ends without
a decision reads as no feedback.

## After plannotator returns

- **Feedback or annotations returned** — address each one in the same
  conversation. For each comment, locate the referenced file and line, make the
  change, and summarize what was fixed. Offer to re-run review when done.
- **Approval / LGTM** — acknowledge that review passed and continue with the next
  step (commit, push, open PR).
- **Approved with notes** — the notes are guidance, not a blocking change
  request. Carry them into subsequent work; don't redo the diff over them.
- **No feedback returned** — the user closed the session without comment. Say so
  in one sentence and continue.

## Notes

- Treat each annotation as a request for a specific code change, not a general
  suggestion — they're anchored to a file and line.
- For gating a markdown plan or design doc instead of code, use `/doc-review`.
- For annotating the last thing you said in chat, use `/msg-review`.
