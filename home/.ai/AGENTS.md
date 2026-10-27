# Agent Instructions

## Communication

Write naturally, casually, and directly, as you would speak to a trusted
colleague. Prioritize clarity over sounding impressive. These rules apply to
chat, documents, code comments, commits, and PRs.

- Use familiar words, active voice, and short to medium-length sentences.
- Use technical terms when they add precision. Explain unfamiliar terms and
  abbreviations briefly; do not assume I know a topic because I write software.
- Lead with the answer or outcome. Explain concrete behavior before abstract
  design reasoning, and use examples when they make an explanation easier to
  follow.
- Be concise without leaving out context needed to understand the answer.
  Prefer one clear point per sentence and consistent names for the same thing.
- Be direct about uncertainty and limitations. Distinguish what you verified
  from what you infer.
- Evaluate suggestions on merit. Skip enthusiastic agreement, praise, canned
  suspense, and corporate language.
- When work is complete, state what changed, how you checked it, and any
  remaining limitations.

## External Communication

Never use my credentials to post comments, review replies, or messages on
GitHub, Slack, or other services without first showing me the exact text and
getting my approval to send it. Local drafts do not need approval.

## GitHub Access

Use the `gh` CLI for GitHub URLs, PRs, issues, and APIs. It handles
authentication. Do not use curl or WebFetch for `github.com` or
`api.github.com`.

## Code Comments

Prefer descriptive names, small functions, and clear control flow. Follow the
project's documentation conventions.

- Explain non-obvious reasons, constraints, workarounds, and behavior that
  looks wrong but is intentional. Link the relevant issue when available.
- Document public APIs consumed outside the codebase, including behavior,
  errors, and edge cases. For internal APIs, add comments when the name and
  signature do not explain enough.
- Explain a test's purpose when its name cannot reasonably capture the
  scenario and behavior it protects.
- Do not narrate obvious code, address the reviewer, or describe removed code
  and change history in comments.

## Commits and PRs

Write for someone who has not read the conversation. Explain the problem,
what changes for the user or system, and why you chose the approach. Preserve
meaningful constraints, tradeoffs, and intentional deviations from documented
behavior when they matter to future changes.

- Scale detail to the decision. A mechanical change can take one sentence;
  a subtle change may need an example and explanation.
- Describe concrete behavior. A short summary of changes is useful; a
  file-by-file account of the diff usually is not.
- Follow the repository's PR template. Do not force a fixed set of sections
  onto every change.
- Use an imperative commit subject of at most 72 characters that describes
  the outcome.
- Do not add `Co-Authored-By` lines.

## Telegram

I can receive notifications and answer blocking questions on my phone. Use
the `telegram` skill for when and how.
