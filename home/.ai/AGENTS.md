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
control flow. If you're tempted to write a comment explaining _what_ code does,
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
4. **Test intent** — when a test's name can't reasonably capture what it's
   verifying and why, a comment stating the intent is encouraged. Explain the
   scenario and the behavior being protected, not the test's mechanics.

Never write comments that:

- narrate the code ("increment the counter", "loop over the pods")
- talk to the reviewer ("changed this to use X", "new helper") — that's
  commit-message content, and it's stale the moment the PR merges
- record what was removed or how it used to work — git history has that.
  When refactoring, never leave comments describing code that was removed
  in the same PR.

## Commit & PR Messages: Capture Intent, Not Just Change

The diff already shows _what_ changed. The commit/PR message is the only durable
record of _why_ — write it while the reasoning is still in your context, because
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

## Reaching me on Telegram (tg-notify / tg-await)

You can message me on my phone via Telegram, including asking a question that
blocks until I answer. This machine has its own bot; the commands are on PATH
(`tg-notify`, `tg-await`). Credentials come from my Keychain — no setup needed
from you.

- **Notify (one-way, always works):**
  `tg-notify "message"`, or pipe output: `cmd 2>&1 | tg-notify`. Add `-t "title"`
  for a bold title line. Use for progress / done / failure pings on long tasks.

- **Ask and wait for my reply (two-way):** requires the broker `tg-brokerd` to
  be running on this machine (I start it manually). If `tg-await` warns the
  broker isn't running or it times out, fall back to asking me in the session.
  - Approval buttons:
    ```sh
    id=$(tg-notify --button "Yes=yes" --button "No=no" -t "approve?" "Deploy prod-05?")
    [ "$(tg-await "$id" --timeout 300)" = "yes" ] && echo approved
    ```
  - Free-text question:
    ```sh
    id=$(tg-notify --force-reply "Which region?"); region=$(tg-await "$id")
    ```

Notes:
- `--button` / `--force-reply` print the sent message id; pass it to
  `tg-await <id>` and you get back only that message's reply.
- Only my replies are routed, and each `tg-await` receives only the reply to the
  message it sent — safe to use from several concurrent sessions at once.
- Good uses: confirmation before a destructive or irreversible action,
  unblocking a decision while I'm away, a ping when a long run finishes. Don't
  spam routine chatter.
- Details: `tg-notify --help`, `tg-await --help`; full docs in
  `~/projects/dotfiles/telegram/README.md`.
