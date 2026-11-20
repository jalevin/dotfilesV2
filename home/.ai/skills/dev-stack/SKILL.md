---
name: dev-stack
description: >
  Start the next stacked branch on top of the current one, show the stack, or restack
  branches after a parent changed or merged. Records each branch's parent so
  dev-review, dev-rethink, dev-pr, and dev-babysit use the right base. Use when the
  user found more work and wants a new branch on top, asks to stack, fork off, or
  "start the next PR", wants to see the stack, or needs to rebase a stack.
argument-hint: "[new <name> | adopt <parent> | show | restack]"
---

# Stacked Branches

A stack is a chain of branches where each one's PR targets the branch below it, not
`main`. This skill keeps one piece of state per branch, its parent:

```bash
git config branch.<branch>.dev-parent <parent-branch>
```

It is local to this clone. Open PRs carry the same fact in their base branch, which
wins when the two disagree. Other `dev-*` skills read both.

## `new <name>` — start the next branch on top

Use this at the point you find more work: the current branch works, and the new work
should be a separate PR on top of it.

1. **Check the current branch.** Uncommitted changes go with the current branch, not
   the new one. Offer `/dev-pr push` (or `/dev-pr draft`) to commit and push them
   first.
2. **Suggest a rethink.** This is the natural point for `/dev-rethink` on the current
   branch: it works, and its boundary is being decided right now. Offer it once; do
   not block on it.
3. **Create the branch.** Follow the repository's or Hive's branch naming. Ask for the
   name if none was given.

   ```bash
   git switch -c <name>
   git config branch.<name>.dev-parent <current-branch>
   ```

4. **Show the stack map** (see `show`) and note in one line what the new branch is
   for, so later reviews know what belongs where.

When the new work should start in a separate Hive session, the new session usually
starts on its own branch from `main`. Use `adopt` there instead.

## `adopt <parent>` — put the current branch on top of another

For a branch that already exists, such as a fresh Hive session's branch, that should
sit on `<parent>`.

- If the branch has no commits of its own yet (`git log main..HEAD` is empty), move it
  with `git reset --keep <parent>`. `--keep` refuses to discard uncommitted changes.
- If it has commits, replay them: `git rebase --onto <parent> main`. Show the commits
  first. If the branch was already pushed, this needs a force push; get approval.
- Then record `git config branch.<branch>.dev-parent <parent>`. If the branch has an
  open PR, show the `gh pr edit --base <parent>` command and run it after approval.

## `show` — print the stack map

Walk down from the current branch through `dev-parent` config and PR bases to `main`,
and up through branches and PRs that name it as their parent:

```bash
gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,url
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads
```

Print one line per branch, bottom to top, marking the current one:

```text
main
└─ #841 jalevin/catalog-health        open     (parent: main)
   └─ #855 jalevin/model-picker       draft    (parent: catalog-health)  ← you are here
      └─ jalevin/empty-catalogs       local    (parent: model-picker)
```

Flag inconsistencies: a recorded parent that differs from the PR base, a parent that
has merged, or a branch behind its parent's head.

## `restack` — rebase after a parent changed or merged

**Parent got new commits** (review fixes, for example): rebase each child onto its
parent, bottom-up.

```bash
git rebase <parent-branch> <child-branch>
```

**Parent merged into `main`:** replay only the child's own commits. With a squash
merge, a plain `git rebase origin/main` would replay the parent's original commits
and conflict, because the squash commit has a different SHA.

```bash
git fetch origin
old_base=$(gh pr view <parent-pr> --json headRefOid --jq .headRefOid)
git rebase --onto origin/main "$old_base" <child-branch>
git config branch.<child-branch>.dev-parent main
```

Then retarget the child's PR if GitHub did not (`gh pr edit <child> --base main`).
GitHub does this on its own only when the parent's branch was deleted on merge.

For either case, show the plan first: each branch, its old and new base, the commits
to replay, and the pushes. Get approval once for the whole restack. Push each
rewritten branch with `git push --force-with-lease=<branch>:<old-head>`, and continue
upward so every child lands on its parent's new head. Stop at the first conflict and
ask; do not guess at conflict resolutions in someone's stack.

After restacking, CI reruns on every pushed branch. If a PR body has a `Stacked on`
line, draft the updated line for approval.
