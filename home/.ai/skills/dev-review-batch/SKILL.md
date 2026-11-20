---
name: dev-review-batch
description: >
  Review a queue of other people's PRs with dev-review, tracked in Honeycomb (hive hc)
  so the batch can span sessions. Resolves the PRs from URLs, an author, a label, or a
  search; applies one shared bar; drafts a GitHub review per PR; collects approval per
  PR from a summary table; posts only approved text; reports patterns that repeat
  across PRs; and re-reviews only what changed when an author pushes. Reviews run
  one at a time in this session, or in parallel Hive worker sessions through
  dev-orchestrate. Use when the user needs to review several PRs, a teammate's
  backlog, or "a bunch of PRs".
argument-hint: "[PR URLs | --author <login> | --label <label> | --search <query>] [--to github|file] [--workers N]"
---

# Batch PR Review

Work through a queue of PRs without lowering the bar or losing track. Each PR gets a
full `/dev-review`; this skill owns the queue, the shared bar, batch approval, and
follow-up. Honeycomb carries the state, so a long queue can continue in a fresh
session.

Two modes, chosen in Step 4:

- **Sequential** (default for up to about 5 PRs, or when Hive is not running): this
  session reviews one PR at a time. `dev-review` already runs its reviewers in
  parallel, and sub-agents do not nest, so PRs cannot also run in parallel here.
- **Parallel** (`--workers N`, or more than about 5 PRs): `/dev-orchestrate` runs one
  Hive worker session per PR. Each worker is a top-level session, so its
  `dev-review` keeps its own sub-agents and a fresh context.

Run it from a checkout of the repository the PRs target. Honeycomb items are scoped
to the repository of the working directory, and reviews use worktrees of it. For PRs
across several repositories, run one batch per repository.

`.hive` must be a symlink. If it is missing, run `hive ctx init` -- never `mkdir`.

## Step 1 — Resolve the queue

Resume before creating anything. If `hive hc list --json` shows an open epic titled
`Review batch: ...` for this scope, continue it from Step 4. In parallel mode,
`hive session list --tags <epic-id> --json` shows which workers are still running;
an `in_progress` task whose worker is gone and has no `drafted` comment goes back to
`open`.

Otherwise resolve the PRs:

```bash
gh pr list --author <login> --state open --json number,title,author,isDraft,baseRefName,headRefOid,additions,deletions,url
gh pr list --label <label> --state open --json ...
gh pr list --search "<query>" --state open --json ...
gh pr view <url> --json ...          # explicit URLs
```

Skip drafts and PRs that already have your review at the current head, unless the
user asks for them. Show the queue as a table: number, title, author, size, base, and
whether it is stacked on another PR in the queue. Order stacked PRs bottom-up, so a
parent is reviewed before its children; otherwise order oldest first. Confirm the
scope with the user before reviewing.

## Step 2 — Track in Honeycomb

Create one epic with a task per PR:

```bash
hive hc create <<'JSON'
{
  "title": "Review batch: <scope> (<YYYY-MM-DD>)",
  "type": "epic",
  "desc": "<scope and query>; brief at .hive/reviews/<brief file>",
  "children": [
    { "title": "PR #<n>: <title>", "type": "task", "desc": "<url>" }
  ]
}
JSON
```

Status meanings for each PR task:

| Status | Meaning |
|--------|---------|
| `open` | not reviewed yet, or reopened after the author pushed |
| `in_progress` | being reviewed, or drafted and waiting for the user's approval; the latest comment says which |
| `done` | review posted, or the user chose not to post |
| `cancelled` | skipped: closed, merged, or out of scope |

Record each step with `hive hc comment <task-id> "<note>"`: the reviewed head SHA, the
verdict, the review file path, and after posting, the review URL. The reviewed SHA is
what makes Step 7 possible.

## Step 3 — Write the batch brief

Write `.hive/reviews/YYYY-MM-DD-batch-<slug>.md` before the first review. It holds the
shared bar every review in the batch applies:

- Who the author is and what they are working toward, if the user says
- What blocks merge in this repository, and what is only a nit
- The verdict rules below, and `dev-review` Step 8's GitHub text style, unless the
  user changes them
- Repository conventions that reviews should check (from AGENTS.md, CONTRIBUTING, or
  the user)
- Anything the user asked to focus on or ignore

Default verdict rules for every review in the batch:

- Minor and Nit findings never block. Draft them as inline comments prefixed `nit:` or
  `optional:`, and include them in the same review.
- No verified Critical or Major finding introduced by the PR means the verdict is
  APPROVE and the drafted GitHub event is `APPROVE`, even when nits are attached.
  Agreeing to these rules in the brief is what lets `dev-review` Step 8 draft
  `APPROVE`. The user still approves the exact text before anything is posted.
- A verified Critical or Major finding that the PR introduced means REQUEST CHANGES.
- Pre-existing findings never set the verdict. They stay in the review file and are
  posted only if the user asks. Verified pre-existing Critical or Major findings
  become issue drafts (see `dev-review` Step 8), collected in Step 6.

Confirm the brief with the user in one message. It keeps the 1st and 10th review to
the same standard.

## Step 4 — Review each PR

State the mode and why in one line.

### Parallel mode

Run `/dev-orchestrate` on the epic from Step 2 instead of creating a new one. Each
task's worker contract is:

> Run `/dev-review <PR url> --to github` with the batch brief at `<brief path>` as
> extra context. Stop at the drafts; do not post anything. Comment `drafted` on your task with the
> reviewed head SHA, the verdict, the Critical/Major/Minor/Nit counts, and the review
> file path, then publish `done`. Never post to GitHub, push, or comment on the PR.

When a worker reports `done`, check its comment has all four fields, then continue
with Step 5 for that PR while other workers run. Approval and posting stay in this
session.

### Sequential mode

For each task from `hive hc next <epic-id> --assign`:

1. Run `/dev-review <url> --to github`, giving it the batch brief as extra context.
   Stop at the drafts: do not post during this step.
2. Comment `drafted` on the task, with the head SHA, verdict, finding counts, and
   review file path. `hc next --assign` already set it to `in_progress`.
3. Keep only a one-line summary of the PR in this conversation. The full review lives
   in its file.

After about eight reviews, or when context is getting full, stop and tell the user the
queue can continue in a fresh session with `/dev-review-batch`, which resumes the epic.

## Step 5 — Approve and post

Show a summary table of the drafted PRs:

| PR | Author | Verdict | Critical / Major / Minor / Nit | Drafts | Review file |
|----|--------|---------|--------------------------------|--------|-------------|

Let the user pick a PR to approve, edit, or skip. Before posting a PR, show its exact
summary body, inline comments, and event, as in `dev-review` Step 8. A summary table
row is not approval of text the user has not seen. Post approved PRs with `dev-review`
Step 8, then set the task to `done` and comment the review URL. A PR the user decides
not to post is also `done`, with a comment saying so.

## Step 6 — Report cross-PR patterns

After the queue is drafted, look across the review files for findings that repeat in
two or more PRs, such as the same missing error check or the same test gap. List each
pattern with the PRs it appears in. Draft, but do not send, a short note to the author
or team about the pattern, and ask the user whether to send it, add it to each
review, or drop it.

Then collect the pre-existing issue drafts from every review file. Several PRs can hit
the same old bug, so merge duplicates into one draft that links each PR where it was
found. Show the list of issue drafts with their exact text, and create only the ones
the user approves.

## Step 7 — Re-review after the author pushes

When the user returns to the batch, compare each `done` task's recorded SHA with the PR
head (`gh pr view <url> --json headRefOid,state`). For a PR that moved:

- Reopen the task (`--status open`) and review only the change since the reviewed
  SHA: `git diff <reviewed-sha> <new-head>`. A force-push that drops the reviewed SHA
  needs a full review again; say so.
- Check whether each earlier comment was resolved, and whether the fix introduced a
  new problem.
- Draft replies or a follow-up review the same way, with the same approval gate.
- Follow `dev-review`'s "Re-reviews and limits": no repeated findings, and from round
  3 only Critical and Major findings, with a recommendation to rethink the approach
  if Major problems remain.

Set merged or closed PRs to `cancelled` with a comment. When every task is `done` or
`cancelled`, close the epic and give the user the final table.
