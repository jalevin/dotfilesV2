---
name: design-review
description: >
  Explain and critically review a plan, RFC, architecture proposal, or the design of
  an existing PR. Uses independent reviewers, before/after Mermaid diagrams, a jargon
  glossary, and concrete examples; saves verified findings and draft comments in a
  review file displayed in Hive canvas. Use for design decisions, assumptions,
  tradeoffs, migration, and deployment readiness. For implementation correctness use
  review; for opening a document for human annotations use doc-review.
---

# Design Review

Help a reader new to the project understand the proposal and decide whether its
approach is sound. Review decisions and evidence; inspect implementation only where
needed to substantiate them. Do not turn this into a full code review or implementation
task. A sound design with no findings is a valid outcome.

## 1. Establish the scope and evidence

Accept a PR URL, a plan/document path or URL, or the proposal explicitly identified in
the conversation. If the target is ambiguous, ask which proposal to review while
gathering any unambiguous context. Do not pick an unrelated recent plan.

- Read the complete proposal and its linked design/specification documents. Use `gh`
  for GitHub. For PRs, resolve the actual base and head revisions and inspect the diff;
  stacked PRs must be compared with their own base, not assumed to target `main`.
- Record the source, revision/date, intended outcome, constraints, non-goals, and
  whether this is a proposal, implemented design, or deployed system. A PR description
  claiming tests passed is reported evidence until independently checked.
- Read applicable repository instructions and relevant existing contracts. Inspect
  enough of the current system to ground the Before view. Consult authoritative
  documentation for external platform assumptions; distinguish documented guarantees
  from inference and unverified deployment behavior.
- Separate existing limitations, newly introduced risks, and explicitly deferred work.
  A dependency outside the repository is not automatically a defect: identify what
  decision or acceptance evidence depends on it.

Do not run expensive suites by default. Use focused read-only checks or tests when
they can resolve a concrete uncertainty, and report what was actually checked.

## 2. Dispatch independent design reviewers

Dispatch at least one fresh-context sub-agent. Batch related concerns for small
proposals; use parallel reviewers for distinct areas of larger or riskier designs,
within available concurrency limits. If delegation is unavailable, report that limit
instead of claiming an independent review occurred.

Give reviewers the proposal, relevant source excerpts or paths/revisions, the stated
intent and constraints, and their assigned concern. Allow read-only investigation.
Do not give them your conclusions or another reviewer's findings. Use general-purpose
reviewers with these instructions; the code-focused `diff-reviewer` agent's hunk-only
contract does not fit plan review.

Route only relevant concerns:

| Concern | Questions to resolve |
|---------|----------------------|
| Requirements and alternatives | Does the approach meet the stated use cases? What tradeoffs or credible simpler alternatives affect the decision? |
| Architecture and contracts | Are responsibilities, boundaries, data flow, ownership, and failure semantics coherent? |
| Identity and data safety | Who authenticates whom? Which identities and credentials cross each trust boundary? What authorizes access? |
| Operations and reliability | What happens under deadlines, cancellation, overload, partial failure, restart, and shutdown? Who owns observability and capacity? |
| Compatibility and migration | Which callers or deployments break? Is rollout, coexistence, and recovery or rollback feasible where required? |
| Validation and dependencies | Which assumptions are demonstrated, which need experiments, and which depend on another team or platform? |

Each reviewer returns `no_findings` or items with: category (confirmed issue, open
question, or evidence gap), decision affected, severity, confidence, source location,
concrete scenario, consequence, and a proposed change or validation step. Record each
reviewer's scope and result. Avoid generic checklists, speculative risks, and taste.

## 3. Verify and synthesize

Re-read supporting sources and actively seek counterevidence for every candidate.
For each potential blocking issue, ask a fresh skeptic to independently confirm or
refute the claim from the source and concrete scenario. Give it the claim and evidence
locations, not the original reviewer's reasoning. Drop refuted findings and briefly
record why. Merge duplicates.

Keep these categories distinct:

- **Confirmed issue:** evidence demonstrates a contradiction, unmet requirement, or
  failure. State its impact and a concrete remedy.
- **Open question:** a decision is unspecified or ambiguous. Explain which outcome
  depends on the answer; do not present a question as a discovered defect.
- **Evidence gap:** a consequential assumption has not been demonstrated. Specify the
  smallest useful experiment, deployment check, or external confirmation.

Use severity `blocking` only when the unresolved issue prevents a named next step
such as implementation, merge, or deployment. Otherwise use `non-blocking`. Separate
design readiness from deployment readiness: a sound proposal may still need rollout
evidence. Do not require every external follow-up before a design can proceed.

## 4. Write one beginner-friendly review

Save to `.hive/reviews/YYYY-MM-DD-design-<slug>.md`, following repository conventions.
Use `hive ctx init` if the context symlink needs initialization; never create `.hive`
as a plain directory. Include frontmatter with `type: design-review`, date, source,
and repository/base/head revisions when applicable.

Keep this order:

1. **Overall design.** Explain the problem, proposed approach, major responsibilities,
   and boundaries in plain English. Include separate Before and After Mermaid
   flowcharts, grounded in the current system and proposal respectively. For an
   implemented PR, use the reviewed base and head. Mark proposed behavior as proposed;
   do not imply it is deployed. If current behavior cannot be established, label that
   uncertainty rather than inventing it.
2. **Jargon.** A table of terms/acronyms, plain-English definitions, and their role in
   this proposal. Briefly explain unavoidable terms on first use in the opening too.
3. **Concrete walkthroughs.** Trace representative inputs through the design. Include
   relevant caller/deployment variants and at least one meaningful failure scenario.
   Show credentials, decisions, and ownership where they affect understanding.
4. **Design assessment.** Explain important choices, alternatives, accepted tradeoffs,
   compatibility/migration, operational limits, and external dependencies. Link claims
   to sources. Do not invent the author's rationale; label your inference.
5. **Verified findings and unresolved decisions.** Separate confirmed issues, open
   questions, and evidence gaps. Include severity, confidence, location, consequence,
   and proposed resolution. List reviewers, checks/results, validation limits, and
   findings dropped during verification.
6. **Readiness.** State whether the design can proceed, needs decisions, or needs
   revision, with reasons. Identify remaining deployment gates separately.
7. **Proposed comments — not posted.** Draft exact, concise, collegial comments for
   actionable items. Include source anchors and GitHub suggestion blocks for precise,
   safe document replacements. Do not invent implementation patches merely to provide
   an accept-ready suggestion. If there is no PR, use document section/line anchors.

### Diagram conventions

Keep node IDs, direction, scope, and relative ordering consistent between views.
Use gray for unchanged elements, amber for modified elements in both views, green
for additions in After, and red/dashed borders for removals in Before. Add status
words to changed labels and a legend so color is not the only signal. Label changed
relationships as well. Use the styles below inside each standalone flowchart as needed:

```text
classDef unchanged fill:#F3F4F6,stroke:#6B7280,color:#111827
classDef modified fill:#FEF3C7,stroke:#B45309,color:#78350F,stroke-width:2px
classDef added fill:#DCFCE7,stroke:#15803D,color:#14532D,stroke-width:2px
classDef removed fill:#FEE2E2,stroke:#B91C1C,color:#7F1D1D,stroke-width:2px,stroke-dasharray:5 5
```

Apply classes with `class` or `:::`, and retain fenced `mermaid` blocks in the review.
Show the absence of a capability honestly for new designs. Do not invent architectural
changes for documentation-only proposals. Add a sequence diagram only when ordering
or identity exchange needs more explanation than the two flowcharts provide.

## 5. Display the review and handle feedback

The Markdown review is the source of truth. Discover the available Hive Drive
`put_blocks` and `open_canvas` tools and their schemas. Use `HIVE_AGENT_SESSION` for a
Hive chat or the absolute working directory for a Hive code session, per the tools'
session rules; never borrow another workspace's identifier.

Read the saved review and mirror its full body into ordered Markdown canvas blocks
with stable IDs, preserving diagrams and comment drafts. Name the canvas from the
date/slug, identify the source file, and request `open_canvas` pinned to that name.
Update the file first on revisions, then refresh the canvas and remove obsolete blocks.
If Hive tools or a session pane are unavailable, still save/link the review and report
that opening it was unavailable. An open request is not confirmation it is visible.

Show proposed comments before posting anything. Wait for explicit approval of their
text before submitting comments or a GitHub review, and post only approved items.
Recheck anchors against the latest source revision before posting; show materially
revised drafts again. Reviewing a design does not authorize editing the proposal,
implementing changes, or approving/merging a PR. Apply further changes only within
the user's requested scope.
