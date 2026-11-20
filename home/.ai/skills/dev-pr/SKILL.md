---
name: dev-pr
description: >
  Commit, check, push, and open a PR for the current branch, then start babysitting.
  Groups changes into logical commits, runs the repository's checks, checks for
  secrets, pushes, and writes the PR body from the repository template and the commit
  messages. Modes: default opens a PR; `draft` opens a draft PR so CI runs while work
  continues; `push` only commits and pushes. Stacked branches target their parent.
  Use when the user says "commit and open a PR", "PR this up", "push this", or
  "open a draft".
argument-hint: "[push | draft] [issue refs]"
---

# Commit, Push, and Open a PR

Adapted from hay-kot/dotfiles `wrap` and `pr-create-auto`. Message style comes from the
"Commits and PRs" and "Communication" sections of the user's AGENTS.md; this skill
adds only the mechanics. Where they conflict, AGENTS.md wins on wording and the
repository's PR template wins on structure.

| Mode | Commits and pushes | Opens | Then |
|------|--------------------|-------|------|
| default | yes | a PR | `/dev-babysit` |
| `draft` | yes | a draft PR | `/dev-babysit` for CI; review feedback once it is marked ready |
| `push` | yes | nothing | `/dev-babysit` if the branch already has an open PR, otherwise stop |

The rule behind the last column: if the branch has a PR after the push, babysitting
starts, unless the user said not to babysit.

## Step 1 — Assess

```bash
git status
git branch --show-current
git log --oneline <base>..HEAD
gh pr view --json number,url,state,isDraft,baseRefName 2>/dev/null
```

- On `main`, ask for a branch name and create it before continuing.
- Resolve the base: the open PR's base, else `git config branch.<branch>.dev-parent`
  (set by `/dev-stack`), else `main`. A stacked branch's PR targets its parent, not
  `main`.
- If a PR already exists, this run pushes to it; do not open another.

## Step 2 — Commit

If there are uncommitted changes:

1. Review `git diff`, `git diff --cached`, and untracked files.
2. Skip files that do not belong to this work: scratch files, debug logs, local
   notes. Report each skipped file and why.
3. Group changes into logical commits, one concern each. Stage specific files with
   `git add <files>`; never `git add -A` or `git add .`.
4. Write each message per AGENTS.md "Commits and PRs": imperative subject of at most
   72 characters, using the domain terms someone would search `git log` for, and a
   body that explains the problem, the behavior change, and why this approach.
   Include dead ends explored during the session if they explain the choice. Follow
   the repository's commit convention, such as Conventional Commits.

Before each commit, inspect the staged diff for secrets per the organization rules:
API keys, tokens, passwords, private keys, and credentials in connection strings or
headers. Check `.env` and credential files are not staged. If something looks like a
secret, stop, report its location and type without showing the value, and help
remove it before continuing.

## Step 3 — Run checks

Find the repository's checks: its AGENTS.md or CLAUDE.md, then `mi --ls` (tasks
across Taskfile, Makefile, and mise; look for `check`, `lint`, `test`, `fmt`), then
language defaults such as `go test ./...`. Run what applies. Fix failures and commit
the fixes before pushing; do not push code that fails its checks. Skip this step when
only documentation changed, and say so.

## Step 4 — Update Honeycomb tasks

Only for `hive hc` tasks explicitly worked on in this session: mark finished ones
`hive hc update <id> --status done`, comment progress on unfinished ones, and create
follow-up tasks for work left over. Skip when no `hc` tasks were involved.

## Step 5 — Push

```bash
git rev-parse --abbrev-ref @{upstream} 2>/dev/null   # has upstream?
git push -u origin <branch>                           # first push
git push                                              # later pushes
```

Use a normal push. Use `--force-with-lease` only when the branch was rebased in this
session, such as a `/dev-stack` restack the user approved. Never use `--force`.

If the push is rejected and no rebase happened in this session, do not rebase on your
own. Present the options (rebase onto the remote and push with lease, merge the remote
changes, or stop and investigate) and wait.

Confirm the push: `git status` shows the branch up to date with its remote.

In `push` mode, skip to Step 8.

## Step 6 — Write the PR

**Title:** imperative, at most 72 characters, matching the repository's convention
(`gh pr list --state merged --limit 10` shows whether it uses prefixes).

**Template:** look for one before writing anything:

```bash
root=$(git rev-parse --show-toplevel)
find "$root" "$root/.github" "$root/docs" -maxdepth 1 -iname 'pull_request_template*' 2>/dev/null
```

A `PULL_REQUEST_TEMPLATE/` directory holds several templates; pick the one matching
the change and say which. When a template exists:

- Keep its headings exactly. Do not add, remove, rename, or reorder sections, and do
  not add a summary or test plan section it did not ask for.
- Answer only what each section asks. Write `N/A — <reason>` where a section does
  not apply, unless the template says to delete unused sections.
- Follow `<!-- HTML comment -->` instructions, then remove the comments.
- Tick only checkboxes for things done and verified in this session.

**Without a template:** plain prose, leading with why the change exists. A mechanical
change gets a title and no body. A single concern gets one short paragraph. A larger
or subtle change gets up to three short paragraphs.

**Sources, in order:** the branch's commit messages (the reasoning is already there),
then the linked issue, plan in `.hive/plans/`, or this session's context, then
`git diff --stat` only to confirm scope. Do not write the body from the full diff;
that produces diff narration.

**Rendering:**

- Write each paragraph as one unwrapped line. GitHub renders newlines inside a
  paragraph as hard line breaks, so text wrapped at 72 columns shows as a ragged
  column. Reflow wrapped commit bodies before reusing their reasoning.
- Use code fences for code and logs, backticks for identifiers, and `#123` for issue
  and PR references.

**Stacked branch:** set the PR base to the parent branch and start the body with a
`Stacked on #<parent> → #<grandparent> → main` line, so reviewers diff against the
right base.

**The cut pass:** before showing the PR, delete every sentence a reviewer would learn
from the diff: per-file bullets, restated function behavior, test claims for tests
not run. If nothing survives, the title alone is the PR.

Issue refs from the arguments go on the last line (`Closes #12`).

## Step 7 — Open the PR

Show the exact title, base, and body, and wait for approval before creating it. The
PR is published under the user's identity, so it follows the AGENTS.md rule on
approving external text.

```bash
gh pr create --title "<title>" --base <base> --body-file <tmpfile>          # default
gh pr create --draft --title "<title>" --base <base> --body-file <tmpfile>  # draft
```

Report the PR URL.

## Step 8 — Hand off

Report the branch and remote, commits pushed, skipped files, Honeycomb updates, and
the PR URL if one exists. Omit empty sections.

Then, if the branch has an open PR (just created or already there), start
`/dev-babysit` in this session unless the user said not to babysit. For a draft PR,
babysit CI only until it is marked ready.
