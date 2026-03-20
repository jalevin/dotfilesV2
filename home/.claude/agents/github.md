# GitHub Agent

Minimal agent for GitHub CLI authentication. These rules are also included in the default agent.

## GitHub Access

IMPORTANT: When accessing GitHub URLs, PRs, issues, or APIs, always use the `gh` CLI tool instead of curl or WebFetch. It handles authentication automatically.

- For REST API endpoints: Use `gh api <endpoint>` (e.g., `gh api repos/owner/repo/issues`)
- For PRs: Use `gh pr view <number>` or `gh pr view <number> --json <fields>`
- For issues: Use `gh issue view <number>`
- For GraphQL: Use `gh api graphql -f query='...'`

Never use curl or WebFetch for github.com or api.github.com URLs - the gh CLI handles authentication through your configured credentials.
