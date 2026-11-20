---
name: dev-plan
description: >
  Create an implementation plan before building. Full mode works from a /dev-research
  doc: align with the user on design, have an independent oracle challenge the approach
  for large or risky plans, then write vertical slices to .hive/plans/. Small mode
  (`small`, or a clearly scoped change of about 5 files or fewer) investigates and writes
  a short plan in one pass. Use when the user wants to plan a feature, task, bug fix,
  or ticket before implementing.
argument-hint: "[small] [research doc path or task]"
allowed-tools: "Bash(git status:*),Bash(git log:*),Bash(git diff:*),Bash(git rev-parse:*),Bash(hive:*),Bash(~/.claude/skills/dev-research/scripts/doc-meta.sh),AskUserQuestion,Read,Write,Task(*),subagent"
---

# Implementation Plan

Turn a research doc into a plan an implementation agent can execute without guessing.
You write the plan yourself -- you already hold the research and every decision, so
handing drafting to a sub-agent only costs a re-read. Most of the value comes from
aligning with the user in Steps 2-3, before the plan exists.

`.hive` must be a symlink. If it is missing, run `hive ctx init` -- never `mkdir`.

## Choose the mode

- **Small** -- the argument includes `small`, or the change touches about 5 files or
  fewer, its scope is already clear, and there is no design choice with real
  alternatives. Skip to [Small mode](#small-mode). No research doc is needed.
- **Full** -- everything else: cross-cutting changes, new patterns, shared contracts,
  or architectural decisions. Continue with Step 1.

Say which mode you chose and why in one line. If small mode turns out bigger than
expected, stop and switch to full mode, suggesting `/dev-research` first if there is
no research doc.

## Step 1: Read the Research

Read the research doc in full. If none was given, run `hive ctx ls` and ask which to
use. If there is none at all, suggest `/dev-research` first.

If the doc's `commit` differs from HEAD, run `git diff --stat <commit>..HEAD` and
re-read any changed files the plan will touch.

Read the files the plan will change. The research tells you where to look; confirm
the details before you rely on them.

## Step 2: Design Discussion

Post a short design summary in chat:

- **Current state** -- what exists, with `file:line` references
- **Desired end state** -- what is true when this is done, and how to observe it
- **Patterns to follow** -- existing code this change should match, with references
- **Decisions** -- choices you made from the research, one line of rationale each
- **Open questions** -- anything you would otherwise have to guess

Ask the open questions with the question tool (AskUserQuestion / ask_user_question).
Only ask what the research and code cannot answer: design alternatives, scope
boundaries, business rules, compatibility needs. Skip anything the user already
decided earlier in this session.

Ask in rounds. Each round holds every question whose prerequisites are already
settled, so no question depends on an answer you have not heard yet. The next round
builds on those answers. Stop when no assumption is left unstated.

While answers come in:

- **Push back.** Point out an answer that contradicts an earlier one, adds more
  than the stated scope needs, or leaves an edge case open. If the user disagrees,
  ask one or two follow-up questions to test the choice, then accept it and record
  both views under Decisions.
- **Block on security.** Unaddressed handling of sensitive data, an
  authentication or authorization gap, injection risk, plaintext secrets, or an
  unbounded public endpoint: do not write the plan until the user addresses each
  one or explicitly accepts the risk. Record it in the plan either way.
- **Prototype what talk cannot settle.** Some questions need something to react
  to, such as how an interaction should feel or which of two layouts reads better.
  Do not keep rephrasing them. Suggest a throwaway prototype, then come back and
  record the answer.
- **Treat "I don't know" as a real answer.** Record it as an open risk or a
  prototype candidate. Do not fill it in with your own guess.

Before moving on, check: what would an implementer, reading only the plan, have to
guess? Resolve each answer with the user now.

## Step 3: Structure Outline

Propose the phases as **vertical slices**. Each slice cuts through the layers it needs
and leaves something that runs and can be tested. Avoid horizontal plans (all schema,
then all services, then all API) -- they defer every failure to the end.

For each phase, give its name, what works at the end of it, and how that is verified.
Include the new or changed signatures and types -- the plan's header file.

Each phase is a candidate PR. When the plan will likely become a stack of PRs, say
which phases you expect to ship together, so `/dev-stack` and `/dev-rethink` can
check the boundaries later.

Get explicit approval before writing the plan. If the user has already agreed to the
design and there were no open questions, you can post Steps 2 and 3 together.

## Step 3b: Approach Challenge (conditional)

Once the user has agreed to the decisions and structure, and before writing the plan,
have an independent oracle challenge the approach. This is the cheapest point to
change direction: rejecting an approach now costs minutes, not a rewrite.

Run it when the plan has 4+ phases, changes a shared contract (public API, schema,
migration, auth), chose between real alternatives, or the user asks. Otherwise skip
it and say so. The post-build check is `/dev-rethink`; this step does not replace it.

Use a read-only agent with fresh context (pi: `oracle` with `context: "fresh"`;
Claude Code: `general-purpose`). Pi's `oracle` defaults to forked context and treats
the inherited conversation as a contract to protect, so without `fresh` it defends
the decisions instead of testing them. Give it the research doc path, the agreed
design summary, decisions, and phase outline. Do not give it your reasoning for
rejecting alternatives; a seeded oracle confirms your choice instead of testing it.

```
Challenge the proposed approach below before it is written into a plan. The research
is at [research path]; read the relevant code yourself.

[design summary, decisions, phase outline]

Answer, with evidence from the research or code:
- Is this solving the right problem, given the stated end state?
- Is there a simpler approach that meets the same requirements? Name it concretely.
- What tradeoffs or risks does this approach accept that the decisions do not state?
- Does the approach fit how the codebase already works, or fight it?
- Would the phases make sensible, independently mergeable PRs?

Returning "approach is sound" with no findings is a successful outcome. Do not
manufacture objections. Do not write the plan.
```

Bring each finding that holds up to the user as a decision, with the oracle's case and
yours. Change decisions only with the user's agreement. Record a rejected alternative
the user chose not to take in the plan's Decisions section, with the reason.

## Step 4: Write the Plan

Run `~/.claude/skills/dev-research/scripts/doc-meta.sh` for frontmatter values. Never
write placeholders.

Write to `.hive/plans/YYYY-MM-DD-description.md` using the template below.

- Keep it as short as the change allows. A reviewer should read it in about ten
  minutes. Do not repeat the research doc -- link it.
- Code blocks show contracts: interfaces, types, struct fields, and signatures in
  full, with function bodies elided as `...`.
- Every verification item is a runnable command or a specific observable step.
- Each phase names the tests it adds. Unit tests alone don't prove a slice works --
  include integration or e2e tests where the repo has them.
- Leave out template sections that don't apply.
- The plan contains no open questions. Anything unresolved goes back to the user.

## Step 5: Independent Review (conditional)

Run one fresh-context review when the plan has 4+ phases, changes a shared contract
(public API, schema, migration, auth), or the user asks for it. Otherwise skip it.

Use a read-only reviewer (Claude Code: `general-purpose`; pi: `reviewer`):

```
Review the implementation plan at [plan path], based on the research at [research path].
Check its claims against the actual code. Report every issue you find, with the
plan section and a file:line or reason:

- Wrong assumptions about existing code
- Duplicates code or patterns that already exist
- Phases that don't leave something runnable and verifiable
- Verification steps that can't be run as written, and missing edge cases
- Over-engineering for the stated scope

Do not rewrite the plan.
```

Fix the issues that hold up. If a fix changes a decision the user made, ask first.

## Step 6: Present

```bash
hive todo add \
  --title "Review plan: <description>" \
  --uri "review://.hive/plans/<filename>"
```

Give the user the plan path, the phase list, what the approach challenge and review
changed (if they ran), and that `/dev-build` implements it. Iterate on feedback in the
same file and add an entry to `updates`.

## Plan Template

````markdown
---
type: plan
date: YYYY-MM-DD
repository: owner/repo
branch: branch-name
commit: abc1234
tags: [component, topic]
research: .hive/research/[source-filename.md]
updates:
  - YYYY-MM-DD: Initial plan
---

# [Feature/Task Name] Implementation Plan

## Overview

[What we're building and why, in 2-4 sentences]

## Current State

[What exists and the constraints that matter, with file:line refs. Link the research
doc for the rest.]

## Desired End State

[What is true when done, and how to observe it]

## Decisions

- [Decision] -- [rationale]

## What We're NOT Doing

- [Out-of-scope item]

## Phase 1: [Name]

[What works at the end of this phase]

### Changes

**`path/to/file.ext`** -- [summary]

```go
type Store interface {
    Get(ctx context.Context, id string) (*User, error)
}

func (s *SQLStore) Get(ctx context.Context, id string) (*User, error) {
    ...
}
```

### Verification

- [ ] `make test-X` -- [what it proves]
- [ ] Manual: [specific step and expected result]

**Checkpoint:** stop for human confirmation before Phase 2.

---

## Phase 2: [Name]

...

## Migration and Rollout

[Only if persisted data, deploy order, or feature flags are involved]

## References

- Research: `.hive/research/[filename]`
- Similar implementation: `path/to/file.ext:line`
````

## Small mode

Research and plan a small change in one pass, in your own context. No sub-agents, no
approach challenge, and no interview loop: proceed on reasonable assumptions and flag
gaps inline.

### Investigate

Read any files, tickets, or docs the user mentions in full. Then find and read:

- The files and functions that need to change
- Related types, interfaces, or schema
- An existing example of the same kind of change, if there is one
- The tests that cover the affected code

Note constraints visible in the code: generated files, migrations, caches, flags.

### Write the short plan

Run `~/.claude/skills/dev-research/scripts/doc-meta.sh` for frontmatter values.

Write to `.hive/plans/YYYY-MM-DD-short-description.md`. Keep it short. Every file in
the Files table has a line reference. Where something is unknown, write
`[GAP: description]` rather than guessing. Code blocks show contracts only
(signatures and types, bodies elided as `...`).

```markdown
---
type: plan
date: YYYY-MM-DD
repository: owner/repo
branch: branch-name
commit: abc1234
tags: [relevant tags]
---

# [Task Name]

## What We're Changing

[2-3 sentences: what changes and why]

## Files

| File | Change |
|------|--------|
| `path/to/file.ext:line` | What changes and why |

## What We're NOT Changing

[Adjacent things that look in scope but aren't]

## Implementation Steps

1. [Concrete step -- name the function/type/query to add or modify]
2. ...

## Success Criteria

- [ ] `make test` / `go test ./...` -- [what it proves]
- [ ] Linting passes
- [ ] Manual: [specific observable outcome]

## Risks & Gotchas

[Migrations, generated code, caches to invalidate. "None" if none.]
```

### Finish

```bash
hive todo add \
  --title "Review plan: <short-description>" \
  --uri "review://.hive/plans/<filename>"
```

Give the user the plan path, a 2-4 bullet summary of the files and steps, and any
`[GAP:]` items. Ask a question only if the answer would change the approach.
