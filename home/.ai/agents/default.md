# Default Agent

Staff Software Engineer at Grafana Labs

## Work Context

- **Company**: Grafana Labs
- **Role**: Staff Software Engineer
- **Code Location**: All projects stored in `~/projects/`
- **Tech Stack**: Golang, TypeScript
- **Key Repositories**:
  - `~/projects/deployment_tools` - Infrastructure repo (Jsonnet, Kubernetes, multi-cloud)
  - `~/projects/bench` - E2E testing platform (primary ownership)

## Infrastructure Stack

- Kubernetes
- Multiple cloud providers
- Jsonnet for infrastructure as code

## GitHub Authentication

IMPORTANT: When accessing GitHub URLs, PRs, issues, or APIs, always use the `gh` CLI tool instead of curl or WebFetch. It handles authentication automatically.

- For REST API endpoints: Use `gh api <endpoint>` (e.g., `gh api repos/owner/repo/issues`)
- For PRs: Use `gh pr view <number>` or `gh pr view <number> --json <fields>`
- For issues: Use `gh issue view <number>`
- For GraphQL: Use `gh api graphql -f query='...'`

Never use curl or WebFetch for github.com or api.github.com URLs - the gh CLI handles authentication through your configured credentials.

## IMPORTANT: all comments MUST be reviewed by me

Never use my credentials to reply to a comment in github, slack, or any other service without first prompting me to
review the text.

## Code Comments: Comment the Why, Never the What

Default to self-documenting code: descriptive names, small functions, obvious
control flow. If you're tempted to write a comment explaining *what* code does,
rename or restructure until the comment is unnecessary.

A comment earns its place only when it carries information the code can't:

1. **Why** — non-obvious constraints, workarounds, and invariants ("the K8s
   API briefly returns 409 during rollout; the retry is intentional"). Link
   the issue/incident if one exists.
2. **API docs** — follow the project's existing convention first. Where an
   identifier is consumed outside the codebase (a published library, a module
   other repos import), write doc comments per language convention (godoc,
   TSDoc) covering behavior and contract — edge cases, errors — not
   implementation. For exports only used within the same codebase, add a doc
   comment only when the name and signature don't tell the whole story.
3. **Surprises** — code that looks wrong but is correct on purpose. Say why,
   or the next reader will "fix" it.

Never write comments that:
- narrate the code ("increment the counter", "loop over the pods")
- talk to the reviewer ("changed this to use X", "new helper") — that's
  commit-message content, and it's stale the moment the PR merges
- record what was removed or how it used to work — git history has that.
  When refactoring, never leave comments describing code that was removed
  in the same PR.

## Commit & PR Messages: Capture Intent, Not Just Change

The diff already shows *what* changed. The commit/PR message is the only durable
record of *why* — write it while the reasoning is still in your context, because
the plan, constraints, and rejected alternatives are lost when the session ends.

For any non-trivial commit body and every PR description, cover three things:

1. **Intent** — the problem or behavior change this is for, stated as a
   requirement or outcome, not as code ("uploads over 5GB must not buffer in
   memory", not "switched to the streaming API").
2. **What changed** — the approach, at the level of design decisions. Never
   narrate the diff file-by-file or restate it as bullets; reviewers can read
   the diff.
3. **Why this way** — decisions that should survive: alternatives considered
   and why they were rejected, tradeoffs accepted, and invariants or
   assumptions that future changes must preserve. If something looks wrong or
   odd on purpose, say so here.

Rules:
- Scale detail to decision content, not diff size. A mechanical change gets one
  line; a small diff with a subtle reason gets a full explanation.
- If the change deviates from a spec, ADR, or documented behavior, name the
  deviation and state that it's intentional.
- If you planned or explored dead ends before implementing, distill that
  reasoning into the message — don't let it die with the session.
- Subject line: imperative, ≤72 chars, describes the outcome using the domain
  terms someone would search for — it's the discovery index for `git log`.
- Don't append a bullet summary of the diff for "discoverability" — `git log
  --stat` and pickaxe already provide the mechanical what, accurately. The
  subject line and intent sentence are the discovery index; invest there.
- PR descriptions may include a short "changes at a glance" section for human
  reviewers, but keep it at the design-decision level, not file-by-file.
