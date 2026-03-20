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
