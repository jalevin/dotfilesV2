---
name: dev-build
description: >
  Implement an approved plan from .hive/plans/ one phase at a time: build each
  vertical slice, run its verification, commit it, and stop at the plan's
  checkpoints. Records deviations in the plan instead of silently drifting. Use when
  the user says to build, implement, or execute a plan, or "start on phase N".
argument-hint: "[plan path] [phase]"
---

# Build the Plan

Turn an approved plan into working, committed code, one slice at a time. The plan is
the contract: follow it, verify each phase the way the plan says, and when reality
disagrees with the plan, stop and say so rather than improvising around it.

`.hive` must be a symlink. If it is missing, run `hive ctx init` -- never `mkdir`.

## Step 1 — Load the plan

Use the given plan path, or the newest plan in `.hive/plans/` for this branch
(`hive ctx ls`). If several could apply, ask which.

Read the plan in full, then the research doc it links, then every file the first
phase changes. If the plan's `commit` differs from `HEAD`, run
`git diff --stat <commit>..HEAD` and re-read changed files the plan touches. Code that
moved since planning is the most common source of a wrong implementation.

Pick up where work stopped: a phase whose verification items are ticked and whose
work is committed is done. Confirm with the user which phase to start if it is not
obvious.

## Step 2 — Build one phase

For the current phase:

1. Make the changes the phase lists, matching the signatures and types in its code
   blocks and the patterns the plan names.
2. Add the tests the phase names, at the layers it names. Unit tests alone do not
   prove a vertical slice works.
3. Run every verification item. Each one is a command or an observable step; run it
   and record the result. Do not tick an item you did not run.
4. Commit the phase in logical commits, per AGENTS.md "Commits and PRs". Stage
   specific files only, and check staged changes for secrets before committing.
5. Tick the phase's verification items in the plan.

Work in this session by default. Delegating is worthwhile only for a large phase with
independent parts: give each worker the plan path, its part, and the files it owns,
then review its diff yourself before committing. For many tasks meant to run
unattended, suggest `/plan-to-hc` and `/hc-loop` instead.

## Step 3 — Handle deviations

Stop and bring a decision to the user when:

- The plan's assumption about existing code is wrong.
- A planned signature or approach cannot work as written.
- Verification fails for a reason the phase did not anticipate.
- The work needs something the plan lists under "What We're NOT Doing".

Present what you found, the options, and a recommendation. Do not redesign silently.
After the user decides, record the deviation in the plan: update the affected phase
and add an `updates` entry (`YYYY-MM-DD: <what changed and why>`). The plan should
describe what was built, so `/dev-rethink` and `/dev-review` judge the code against the
right intent.

Small fixes that change nothing the plan specifies, such as a missed import or an
extra test case, need no stop.

## Step 4 — Checkpoint

At each `**Checkpoint:**` in the plan, stop and report: what works now, verification
results, commits made, and any deviations recorded. Wait for the user before starting
the next phase.

## Step 5 — Finish

When the last phase is verified and committed, report the phases completed, the
commits, and the deviations. Then point to the next lifecycle step:

- `/dev-rethink`, now that the feature works and is committed.
- If building turned up more work that belongs in a separate PR, `/dev-stack new`
  before starting it, so this branch's boundary stays clean.
- Otherwise `/dev-review`, then `/dev-pr`.
