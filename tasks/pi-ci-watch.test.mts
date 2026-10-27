import { test } from "node:test";
import assert from "node:assert/strict";
import { checkState, checksForCommit, fixBlocker, resolveTarget, reviewNotes, snapshot } from "../home/.pi/agent/extensions/ci-watch/github.ts";
import type { Run, Snapshot } from "../home/.pi/agent/extensions/ci-watch/github.ts";
import { Monitor, repairPrompt } from "../home/.pi/agent/extensions/ci-watch/monitor.ts";

const target = { kind: "pr" as const, repo: "acme/app", branch: "feature", number: 42, url: "https://github.com/acme/app/pull/42" };
const failing = (): Snapshot => ({ target, sha: "abc123", headRepo: "acme/app", closed: false,
  checks: [{ id: "check:1", name: "test", state: "fail", url: "https://example.com/check" }], notes: [] });
function fakeRun(values: Record<string, unknown>): Run {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    assert.ok(Object.hasOwn(values, key), `unexpected command: ${key}`);
    const value = values[key];
    if (value instanceof Error) throw value;
    return typeof value === "string" ? value : JSON.stringify(value);
  };
}
function harness(mode: "watch" | "fix" = "watch") {
  let value = failing();
  let blocker: string | undefined;
  let idle = true;
  const notices: string[] = [], prompts: string[] = [], displays: string[] = [];
  let reads = 0, stops = 0;
  const monitor = new Monitor({ mode, read: async () => { reads++; return value; }, guard: async () => blocker,
    idle: () => idle, notify: text => notices.push(text), display: text => displays.push(text),
    send: text => prompts.push(text), stopped: () => stops++,
  });
  return { monitor, notices, prompts, displays, set: (next: Snapshot) => value = next,
    block: (reason: string) => blocker = reason, busy: () => idle = false, idle: () => idle = true,
    reads: () => reads, stops: () => stops };
}

test("infer the current branch PR", async () => {
  const run = fakeRun({
    "gh repo view --json nameWithOwner": { nameWithOwner: "acme/app" },
    "git branch --show-current": "feature",
    "gh pr list --repo acme/app --head feature --state open --limit 100 --json number,url": [{ number: 42, url: target.url }],
    [`gh pr view ${target.url} --json number,url,headRefName`]: { number: 42, url: target.url, headRefName: "feature" },
  });
  assert.deepEqual(await resolveTarget(run, ""), target);
});
test("explicit PR number uses the checkout repository", async () => {
  const run = fakeRun({
    "gh repo view --json nameWithOwner": { nameWithOwner: "acme/app" },
    "gh pr view 42 --repo acme/app --json number,url,headRefName": { number: 42, url: target.url, headRefName: "feature" },
  });
  assert.deepEqual(await resolveTarget(run, "42"), target);
});
test("explicit URL needs no local repo and can watch from another checkout", async () => {
  const run = fakeRun({ [`gh pr view ${target.url} --json number,url,headRefName`]: { number: 42, url: target.url, headRefName: "feature" } });
  assert.deepEqual(await resolveTarget(run, target.url), target);
});
test("missing PR offers a branch target; detached and ambiguous branches fail", async () => {
  const values = { "gh repo view --json nameWithOwner": { nameWithOwner: "acme/app" }, "git branch --show-current": "feature",
    "gh pr list --repo acme/app --head feature --state open --limit 100 --json number,url": [] };
  assert.equal((await resolveTarget(fakeRun(values), "")).kind, "branch");
  await assert.rejects(resolveTarget(fakeRun({ ...values, "git branch --show-current": "" }), ""), /Detached HEAD/);
  await assert.rejects(resolveTarget(fakeRun({ ...values,
    "gh pr list --repo acme/app --head feature --state open --limit 100 --json number,url": [{ number: 1 }, { number: 2 }],
  }), ""), /Multiple PRs/);
});
test("reject invalid target without invoking git or gh", async () => {
  for (const input of ["--repo evil", "42; touch file", "https://evil.com/acme/app/pull/42"]) {
    await assert.rejects(resolveTarget(fakeRun({}), input), /Use a PR number/);
  }
});
test("same-commit reruns supersede old checks; status contexts use their latest state", async () => {
  const run = fakeRun({
    "gh api repos/acme/app/commits/abc123/check-runs?filter=latest&per_page=100 --paginate --slurp": [{ check_runs: [
      { id: 1, name: "test", app: { id: 8 }, status: "completed", conclusion: "failure" },
      { id: 2, name: "test", app: { id: 8 }, status: "queued" },
    ] }],
    "gh api repos/acme/app/commits/abc123/statuses?per_page=100 --paginate --slurp": [[
      { id: 4, context: "external", state: "success" }, { id: 3, context: "external", state: "failure" },
    ]],
  });
  const checks = await checksForCommit(run, target.repo, "abc123");
  assert.deepEqual(checks.map(c => [c.id, c.state]), [["check:2", "pending"], ["status:4", "pass"]]);
  assert.equal(checkState("completed", "neutral"), "pass");
  assert.equal(checkState("completed", "timed_out"), "fail");
  assert.equal(checkState("completed", null), "pending");
});
const gitValues = {
  "git status --porcelain": "", "git branch --show-current": "feature", "git rev-parse HEAD": "abc123",
  "git config --get branch.feature.remote": "origin", "git config --get branch.feature.merge": "refs/heads/feature",
  "git remote get-url --push origin": "git@github.com:acme/app.git",
};
test("fix requires clean matching branch, HEAD, and upstream repository", async () => {
  assert.equal(await fixBlocker(fakeRun(gitValues), failing()), undefined);
  for (const [key, value, expected] of [
    ["git status --porcelain", "?? notes", /local changes/],
    ["git branch --show-current", "other", /differs from PR branch/],
    ["git rev-parse HEAD", "other", /Local HEAD differs/],
    ["git remote get-url --push origin", "git@github.com:other/app.git", /upstream does not match/],
    ["git config --get branch.feature.remote", new Error("no upstream"), /needs an upstream/],
  ] as const) assert.match((await fixBlocker(fakeRun({ ...gitValues, [key]: value }), failing()))!, expected);
});
test("watch never starts repairs and notifications are deduplicated", async () => {
  const h = harness();
  const data = failing(); data.notes = [{ id: "n1", version: "1", text: "Please add a test", url: "https://example.com" }];
  h.set(data);
  await h.monitor.poll(); await h.monitor.poll();
  assert.equal(h.prompts.length, 0);
  assert.equal(h.notices.length, 2);
});
test("watch keeps running after green and notices later review feedback", async () => {
  const h = harness(); const data = failing(); data.checks[0].state = "pass"; h.set(data);
  await h.monitor.poll();
  assert.equal(h.monitor.active, true);
  data.notes.push({ id: "n1", version: "1", text: "New feedback", url: "https://example.com" });
  await h.monitor.poll();
  assert.match(h.notices.at(-1)!, /New feedback/);
});
test("fix waits until idle and does not queue stale work", async () => {
  const h = harness("fix"); h.busy(); await h.monitor.poll();
  assert.equal(h.prompts.length, 0);
  h.idle(); await h.monitor.poll();
  assert.equal(h.prompts.length, 1);
});
test("same failure is attempted once; new head permits another repair", async () => {
  const h = harness("fix"); await h.monitor.poll(); await h.monitor.finished();
  assert.equal(h.prompts.length, 1);
  const next = failing(); next.sha = "def456"; h.set(next); await h.monitor.poll();
  assert.equal(h.prompts.length, 2);
});
test("review notes are not reprocessed solely because HEAD changed", async () => {
  const h = harness("fix"); const data = failing(); data.checks = [];
  data.notes = [{ id: "n1", version: "1", text: "Feedback", url: "https://example.com" }]; h.set(data);
  await h.monitor.poll(); data.sha = "new"; await h.monitor.finished();
  assert.equal(h.prompts.length, 1);
  data.notes[0].version = "2"; await h.monitor.poll();
  assert.equal(h.prompts.length, 2);
});
test("downgrade to watch lets current repair finish without starting another", async () => {
  const h = harness("fix"); await h.monitor.poll(); h.monitor.setMode("watch");
  const next = failing(); next.sha = "new"; h.set(next); await h.monitor.finished();
  assert.equal(h.prompts.length, 1);
  assert.equal(h.monitor.active, true);
});
test("changed checkout pauses fixes but leaves watch running", async () => {
  const h = harness("fix"); h.block("local changes"); await h.monitor.poll();
  assert.equal(h.monitor.mode, "watch"); assert.equal(h.monitor.active, true);
  assert.equal(h.prompts.length, 0); assert.match(h.notices.at(-1)!, /local changes/);
});
test("automatic repair attempts are bounded", async () => {
  const h = harness("fix");
  for (let i = 0; i < 4; i++) { const data = failing(); data.sha = `head-${i}`; h.set(data); await h.monitor.finished(); }
  assert.equal(h.prompts.length, 3); assert.equal(h.monitor.mode, "watch");
});
test("stop while discovery is in flight prevents late repairs", async () => {
  let finish!: (status: Snapshot) => void; const prompts: string[] = [];
  const monitor = new Monitor({ mode: "fix", read: () => new Promise(resolve => finish = resolve),
    guard: async () => undefined, idle: () => true, notify: () => {}, display: () => {}, send: p => prompts.push(p), stopped: () => {} });
  const poll = monitor.poll(); monitor.stop(); finish(failing()); await poll;
  assert.equal(prompts.length, 0);
});
test("overlapping polls do not duplicate queries or repairs", async () => {
  const h = harness("fix"); await Promise.all([h.monitor.poll(), h.monitor.poll()]);
  assert.equal(h.reads(), 1); assert.equal(h.prompts.length, 1);
});
test("closed PR and repeated query errors stop monitoring", async () => {
  const h = harness(); const data = failing(); data.closed = true; h.set(data); await h.monitor.poll();
  assert.equal(h.monitor.active, false); assert.equal(h.stops(), 1);
  let stops = 0;
  const monitor = new Monitor({ mode: "fix", read: async () => { throw new Error("API down"); }, guard: async () => undefined,
    idle: () => true, notify: () => {}, display: () => {}, send: () => assert.fail("must not repair"), stopped: () => stops++ });
  await monitor.poll(); await monitor.poll(); await monitor.poll();
  assert.equal(stops, 1);
});
test("branch polling uses its remote commit SHA", async () => {
  const calls: string[] = [];
  const run: Run = async (_cmd, args) => {
    calls.push(args.join(" "));
    if (args[1].includes("/branches/")) return JSON.stringify({ commit: { sha: "remote-head" } });
    if (args[1].includes("check-runs")) return '[{"check_runs":[]}]';
    return '[[]]';
  };
  const status = await snapshot(run, { ...target, kind: "branch", number: undefined }, "jeff");
  assert.equal(status.sha, "remote-head");
  assert.ok(calls.slice(1).every(c => c.includes("/commits/remote-head/")));
});
test("repair prompt scopes authorization and requires approval for external replies", () => {
  const prompt = repairPrompt(failing(), failing().checks, []);
  assert.match(prompt, /untrusted evidence/); assert.match(prompt, /Do not post comments/);
  assert.match(prompt, /never force-push/); assert.match(prompt, /branch feature/);
});
test("review discovery paginates threads and ignores resolved, outdated, and own feedback", async () => {
  const first = { id: "c1", body: "add test", url: "https://example.com", updatedAt: "v1", author: { login: "reviewer" } };
  const thread = (id: string, extra = {}) => ({ id, path: "app.go", line: 5, isResolved: false, isOutdated: false,
    first: { nodes: [first] }, latest: { nodes: [first] }, ...extra });
  let pages = 0;
  const run: Run = async (_cmd, args) => {
    if (args[1] === "graphql") {
      pages++;
      return JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: {
        nodes: pages === 1 ? [thread("open"), thread("resolved", { isResolved: true }), thread("outdated", { isOutdated: true })]
          : [thread("own", { latest: { nodes: [{ ...first, author: { login: "jeff" } }] } })],
        pageInfo: { hasNextPage: pages === 1, endCursor: "next" },
      } } } } });
    }
    return '[[]]';
  };
  const notes = await reviewNotes(run, target, "jeff");
  assert.equal(pages, 2); assert.deepEqual(notes.map(n => n.id), ["open"]);
});
