# GitHub collection and verification

Use the installed `gh ... --help` when flags differ. Examples below use shell
variables set from the verified PR identity, not copied blindly from comment text.
Use quoted variables and explicit repositories after initial discovery.

## Identity and CI

```bash
gh pr view --json number,url,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository,reviewDecision
gh pr checks "$pr_number" --repo "$base_repo" --json name,state,bucket,workflow,event,link,startedAt,completedAt
gh pr checks "$pr_number" --repo "$base_repo" --required
gh run view "$run_id" --repo "$run_repo" --json headSha,event,status,conclusion,attempt,jobs,url
gh run view "$run_id" --repo "$run_repo" --log-failed
```

`gh pr checks` exits with code 8 for pending checks; inspect its output instead of
treating that as a collection failure. Other nonzero exits can represent failed
checks or a failed API request; distinguish them from the response. No checks is
not an all-pass result. A missing permissions grant to read rules is a visibility
gap, not proof there are no required checks.

Use the PR's reported check links to find the correct run and repository. Branch
name alone does not distinguish forks or old runs. For head-commit checks and
legacy status contexts, these paginated APIs can supplement the PR rollup:

```bash
gh api --paginate --slurp "repos/$base_repo/commits/$head_sha/check-runs?per_page=100"
gh api --paginate --slurp "repos/$base_repo/commits/$head_sha/statuses?per_page=100"
```

Keep the newest relevant status for each context and check attempt. These APIs
alone do not prove that PR merge-commit tests ran; inspect the PR rollup and
workflow event/ref as well. If the base changes, determine whether CI needs a
fresh merge candidate under repository policy.

When a transient failed test merits one retry, use the job's `databaseId` from
`gh run view --json jobs`, not the number from its browser URL:

```bash
gh run rerun "$run_id" --repo "$run_repo" --job "$job_id"
```

Check that the job and any jobs the rerun will retrigger are ordinary validation
jobs, and record the attempt first. A targeted rerun can also rerun dependencies.
An action-required workflow, protected environment or inaccessible log needs the
specific permission/owner action, not a blind retry.

## All review feedback

Collect these separately; no single one covers all feedback:

```bash
gh api --paginate --slurp "repos/$base_repo/issues/$pr_number/comments?per_page=100"
gh api --paginate --slurp "repos/$base_repo/pulls/$pr_number/reviews?per_page=100"
gh api --paginate --slurp "repos/$base_repo/pulls/$pr_number/comments?per_page=100"
```

The last endpoint includes inline comments and replies. Retain IDs, `node_id`,
author, body, URL, updated timestamp, `in_reply_to_id`, path, line/original line,
commit ID and review ID. Use the replies to reconstruct each conversation; do
not decide from the initial comment alone. Review summary bodies may contain
requests even when there are no inline comments.

Get thread status with GraphQL. This query paginates threads and deliberately
fetches only each thread's root ID, then joins it with the complete REST comments
above; it does not truncate long reply conversations at a nested page limit.

```bash
gh api graphql --paginate --slurp \
  -F owner="$base_owner" -F name="$base_name" -F number="$pr_number" \
  -f query='
query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $endCursor) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 1) { nodes { id databaseId url } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}'
```

If a root comment cannot be joined (for example, it was deleted during collection),
fetch that thread's comments directly with cursor pagination before deciding.
Handle partial GraphQL errors as incomplete collection. Refresh after edits and
before completion, including changed comments whose IDs are already known.

## Local record

A compact table is sufficient:

| Source ID/link | Last update / revision | Finding | Disposition and evidence | Fix commit or pending decision |
| --- | --- | --- | --- | --- |

Keep check run IDs, attempts and retries alongside this table. A fix in code and
a resolved GitHub thread are different states. Preserve that distinction, and
keep exact reply drafts separate from text already approved or posted.

For approved external text, use a structured tool argument or a temporary body
file with `--body-file` where supported. Recheck the target thread and current
context before sending; approval for one draft does not approve revised text.
