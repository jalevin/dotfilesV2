import { execFile } from "node:child_process";

export type Run = (command: string, args: string[]) => Promise<string>;
export function runner(cwd: string, signal?: AbortSignal): Run {
  return (command, args) => new Promise((resolve, reject) => {
    execFile(command, args, { cwd, signal, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => error
        ? reject(new Error(`${command}: ${stderr.trim() || error.message}`))
        : resolve(stdout.trim()));
  });
}
export type Target = {
  kind: "pr" | "branch";
  repo: string;
  branch: string;
  number?: number;
  url: string;
};
export type Note = { id: string; version: string; text: string; url: string };
export type Check = { id: string; name: string; state: "pass" | "pending" | "fail"; url: string };
export type Snapshot = {
  target: Target;
  sha: string;
  headRepo: string;
  closed: boolean;
  checks: Check[];
  notes: Note[];
};
export async function json<T>(run: Run, args: string[]): Promise<T> {
  const data = JSON.parse(await run("gh", args));
  if (data.errors?.length) throw new Error(data.errors.map((e: { message: string }) => e.message).join("; "));
  return data;
}

export async function resolveTarget(run: Run, input: string): Promise<Target> {
  if (input && !/^\d+$/.test(input) && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(input)) {
    throw new Error("Use a PR number, a github.com PR URL, or no argument for the current branch.");
  }
  let repo = "";
  let branch = "";
  if (!input || /^\d+$/.test(input)) {
    repo = (await json<{ nameWithOwner: string }>(run, ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  }
  if (!input) {
    branch = await run("git", ["branch", "--show-current"]);
    if (!branch) throw new Error("Detached HEAD: supply a PR URL or check out a branch.");
    const prs = await json<{ number: number; url: string }[]>(run,
      ["pr", "list", "--repo", repo, "--head", branch, "--state", "open", "--limit", "100", "--json", "number,url"]);
    if (prs.length > 1) throw new Error(`Multiple PRs match ${branch}; supply a PR number or URL.`);
    if (!prs.length) return { kind: "branch", repo, branch, url: `https://github.com/${repo}/actions` };
    input = prs[0].url;
  }
  const pr = await json<{ number: number; url: string; headRefName: string }>(run,
    ["pr", "view", input, ...(repo && /^\d+$/.test(input) ? ["--repo", repo] : []), "--json", "number,url,headRefName"]);
  const url = new URL(pr.url);
  return { kind: "pr", repo: url.pathname.split("/").slice(1, 3).join("/"), branch: pr.headRefName, number: pr.number, url: pr.url };
}

const failures = new Set(["failure", "error", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
export function checkState(status: string, conclusion?: string | null): Check["state"] {
  if (failures.has(conclusion || status)) return "fail";
  if (status === "completed") return ["success", "neutral", "skipped"].includes(conclusion || "") ? "pass" : "pending";
  return status === "success" ? "pass" : "pending";
}

export async function checksForCommit(run: Run, repo: string, sha: string): Promise<Check[]> {
  const [checkPages, statusPages] = await Promise.all([
    json<{ check_runs: any[] }[]>(run, ["api", `repos/${repo}/commits/${sha}/check-runs?filter=latest&per_page=100`, "--paginate", "--slurp"]),
    json<any[][]>(run, ["api", `repos/${repo}/commits/${sha}/statuses?per_page=100`, "--paginate", "--slurp"]),
  ]);
  const latest = new Map<string, any>();
  for (const check of checkPages.flatMap(page => page.check_runs)) {
    const key = `${check.app?.id}:${check.name}`;
    if (!latest.has(key) || latest.get(key).id < check.id) latest.set(key, check);
  }
  const checks: Check[] = [...latest.values()].map(c => ({
    id: `check:${c.id}`, name: c.name, state: checkState(c.status, c.conclusion), url: c.html_url,
  }));
  const contexts = new Set<string>();
  for (const status of statusPages.flat()) {
    if (contexts.has(status.context)) continue;
    contexts.add(status.context);
    checks.push({ id: `status:${status.id}`, name: status.context, state: checkState(status.state), url: status.target_url || "" });
  }
  return checks;
}

const threadQuery = `query($owner:String!,$repo:String!,$number:Int!,$after:String) {
  repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
    reviewThreads(first:100,after:$after) {
      pageInfo { hasNextPage endCursor }
      nodes { id isResolved isOutdated path line
        first:comments(first:1) { nodes { id body url updatedAt author { login } } }
        latest:comments(last:1) { nodes { id body url updatedAt author { login } } }
      }
    }
  } }
}`;
export async function reviewNotes(run: Run, target: Target, viewer: string): Promise<Note[]> {
  const [owner, repo] = target.repo.split("/");
  const notes: Note[] = [];
  let cursor: string | undefined;
  do {
    const result: any = await json(run, ["api", "graphql", "-f", `query=${threadQuery}`,
      "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `number=${target.number}`,
      ...(cursor ? ["-f", `after=${cursor}`] : [])]);
    const threads = result.data.repository.pullRequest.reviewThreads;
    for (const thread of threads.nodes) {
      const first = thread.first.nodes[0];
      const last = thread.latest.nodes[0];
      if (thread.isResolved || thread.isOutdated || !first || !last || last.author?.login === viewer) continue;
      notes.push({ id: thread.id, version: `${last.id}:${last.updatedAt}`, url: last.url,
        text: `${thread.path}:${thread.line ?? "diff"}\n${first.body}${last.id !== first.id ? `\nLatest reply: ${last.body}` : ""}` });
    }
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : undefined;
  } while (cursor);
  const [reviewPages, commentPages] = await Promise.all([
    json<any[][]>(run, ["api", `repos/${target.repo}/pulls/${target.number}/reviews?per_page=100`, "--paginate", "--slurp"]),
    json<any[][]>(run, ["api", `repos/${target.repo}/issues/${target.number}/comments?per_page=100`, "--paginate", "--slurp"]),
  ]);
  const latestReviews = new Map<string, any>();
  for (const review of reviewPages.flat()) {
    if (review.state !== "PENDING") latestReviews.set(review.user.login, review);
  }
  for (const review of latestReviews.values()) {
    if (!review.body?.trim() || review.user.login === viewer || !["COMMENTED", "CHANGES_REQUESTED"].includes(review.state)) continue;
    notes.push({ id: `review:${review.id}`, version: `${review.submitted_at}:${review.body}`, text: review.body, url: review.html_url });
  }
  for (const comment of commentPages.flat()) {
    if (!comment.body?.trim() || comment.user.login === viewer) continue;
    notes.push({ id: `comment:${comment.id}`, version: comment.updated_at, text: comment.body, url: comment.html_url });
  }
  return notes;
}

export async function snapshot(run: Run, target: Target, viewer: string): Promise<Snapshot> {
  if (target.kind === "branch") {
    const branch = await json<{ commit: { sha: string } }>(run,
      ["api", `repos/${target.repo}/branches/${encodeURIComponent(target.branch)}`]);
    return { target, sha: branch.commit.sha, headRepo: target.repo, closed: false, notes: [],
      checks: await checksForCommit(run, target.repo, branch.commit.sha) };
  }
  const pr: any = await json(run, ["pr", "view", target.url, "--json", "state,headRefOid,headRefName,headRepository,headRepositoryOwner"]);
  const current = { ...target, branch: pr.headRefName };
  if (pr.state !== "OPEN") return { target: current, sha: pr.headRefOid, headRepo: "", closed: true, checks: [], notes: [] };
  const [checks, notes] = await Promise.all([
    checksForCommit(run, target.repo, pr.headRefOid), reviewNotes(run, target, viewer),
  ]);
  return { target: current, sha: pr.headRefOid, headRepo: pr.headRepository ? `${pr.headRepositoryOwner.login}/${pr.headRepository.name}` : "",
    closed: false, checks, notes };
}

export function remoteRepo(url: string): string {
  return url.trim().replace(/\.git$/, "").replace(/\/$/, "")
    .replace(/^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)/, "").toLowerCase();
}
export async function fixBlocker(run: Run, status: Snapshot): Promise<string | undefined> {
  if (status.target.kind !== "pr") return "Fix mode requires a PR; use watch mode for branch runs.";
  if (status.closed) return "The PR is no longer open.";
  if (await run("git", ["status", "--porcelain"])) return "The checkout has local changes. Commit or stash them before enabling fixes.";
  const branch = await run("git", ["branch", "--show-current"]);
  if (branch !== status.target.branch) return `Checkout branch ${branch || "(detached)"} differs from PR branch ${status.target.branch}.`;
  if (await run("git", ["rev-parse", "HEAD"]) !== status.sha) return "Local HEAD differs from the PR head. Synchronize it before enabling fixes.";
  try {
    const remote = await run("git", ["config", "--get", `branch.${branch}.remote`]);
    const merge = await run("git", ["config", "--get", `branch.${branch}.merge`]);
    const pushRemote = await run("git", ["remote", "get-url", "--push", remote]);
    if (!status.headRepo || remoteRepo(pushRemote) !== status.headRepo.toLowerCase() || merge !== `refs/heads/${branch}`) {
      return "The branch upstream does not match the PR head repository and branch.";
    }
  } catch {
    return "The PR branch needs an upstream pointing to its head repository before fixes can be pushed.";
  }
  return undefined;
}
