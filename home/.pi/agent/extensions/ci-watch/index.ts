import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { fixBlocker, json, resolveTarget, runner, snapshot } from "./github.ts";
import type { Target } from "./github.ts";
import { clean, Monitor } from "./monitor.ts";
import type { Mode } from "./monitor.ts";

export default function (pi: ExtensionAPI) {
  let monitor: Monitor | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let context: ExtensionContext | undefined;
  let starting = false;
  let epoch = 0;

  function stop() {
    epoch++;
    monitor?.stop();
    monitor = undefined;
    controller?.abort();
    controller = undefined;
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  async function start(mode: Mode, input: string, ctx: ExtensionCommandContext) {
    context = ctx;
    const arg = input.trim();
    if (arg === "stop") {
      const repairing = monitor?.repairing;
      stop();
      ctx.ui.setWidget("ci-watch", undefined);
      ctx.ui.notify(`CI monitoring stopped.${repairing ? " The active repair may finish; no further repairs will start." : ""}`, "info");
      return;
    }
    if (arg === "status") {
      ctx.ui.notify(monitor?.active
        ? `${monitor.mode.toUpperCase()} ${monitor.latest?.target.url || "loading"}; repairs ${monitor.attempts}/3${monitor.repairing ? "; repair in progress" : ""}`
        : "CI monitoring is stopped.", "info");
      return;
    }
    if (arg === "help") {
      ctx.ui.notify("/ci-watch [PR number or URL] · /ci-fix [PR number or URL] · either command: status / stop. No argument infers the PR from this branch.", "info");
      return;
    }
    if (starting) {
      ctx.ui.notify("A CI monitor is already being started.", "warning");
      return;
    }
    starting = true;
    const requestEpoch = epoch;
    const setupController = new AbortController();
    const run = runner(ctx.cwd, setupController.signal);
    try {
      let target = await resolveTarget(run, arg);
      if (requestEpoch !== epoch) return;
      const sameTarget = monitor?.active && monitor.latest?.target.url === target.url;
      if (sameTarget && mode === "watch") {
        monitor!.setMode("watch");
        ctx.ui.notify("WATCH mode enabled. Any active repair may finish; no new repairs will start.", "info");
        return;
      }
      if (monitor?.repairing) {
        ctx.ui.notify("A repair is in progress. Switch to watch mode or wait for it to finish before changing targets.", "warning");
        return;
      }
      if (target.kind === "branch") {
        if (mode === "fix") throw new Error(`No open PR for ${target.branch}. Use /ci-watch for branch runs, or supply a PR URL.`);
        if (!ctx.hasUI || await ctx.ui.select(`No PR for ${target.branch}`, ["Watch this branch's CI runs", "Cancel"]) !== "Watch this branch's CI runs") return;
      }
      const viewer = (await json<{ login: string }>(run, ["api", "user"])).login;
      let initial = await snapshot(run, target, viewer);
      if (initial.closed) throw new Error("That PR is closed or merged.");
      if (mode === "fix") {
        const blocker = await fixBlocker(run, initial);
        if (blocker) {
          const choice = ctx.hasUI ? await ctx.ui.select(blocker, [
            "Switch to the PR branch here", "Create an isolated Hive session", "Watch only", "Cancel",
          ]) : undefined;
          if (requestEpoch !== epoch) return;
          if (choice === "Watch only") mode = "watch";
          else if (choice === "Create an isolated Hive session") {
            if (!ctx.isIdle() || ctx.hasPendingMessages()) throw new Error("Wait until Pi is idle before creating a Hive session.");
            pi.sendUserMessage(`Create an isolated Hive code session for ${target.url}, using the Hive CLI and its help. Do not disturb local changes in this checkout. Prepare the PR head branch and its upstream in the new checkout, then tell me how to open it and run /ci-fix there. Do not start repairs or post GitHub comments in this session.`);
            return;
          } else if (choice === "Switch to the PR branch here") {
            if (!ctx.isIdle() || ctx.hasPendingMessages()) throw new Error("Wait until Pi is idle before switching branches.");
            if (await run("git", ["status", "--porcelain"])) throw new Error("Commit or stash local changes before switching branches, or use an isolated Hive session.");
            const localRepo = (await json<{ nameWithOwner: string }>(run, ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
            if (![target.repo.toLowerCase(), initial.headRepo.toLowerCase()].includes(localRepo.toLowerCase())) throw new Error("This checkout belongs to a different repository. Use an isolated Hive session.");
            if (requestEpoch !== epoch) return;
            await run("gh", ["pr", "checkout", target.url]);
            initial = await snapshot(run, target, viewer);
            const remaining = await fixBlocker(run, initial);
            if (remaining) throw new Error(remaining);
          } else return;
        }
      }
      if (requestEpoch !== epoch) return;
      // Preserve deduplication when changing the mode of the existing monitor.
      if (sameTarget && monitor?.active) {
        monitor.setMode(mode);
        ctx.ui.notify(`${mode.toUpperCase()} ${target.url} · branch ${target.branch}`, "info");
        await monitor.poll();
        return;
      }
      stop();
      controller = setupController;
      target = initial.target;
      let first = true;
      const current = new Monitor({
        mode,
        read: async () => {
          if (first) { first = false; return initial; }
          return snapshot(run, target, viewer);
        },
        guard: status => fixBlocker(run, status),
        idle: () => !!context?.isIdle() && !context?.hasPendingMessages(),
        notify: (text, warning) => context?.ui.notify(text, warning ? "warning" : "info"),
        display: text => context?.ui.setWidget("ci-watch", [clean(text)]),
        send: prompt => pi.sendUserMessage(prompt),
        stopped: () => { if (timer) clearInterval(timer); timer = undefined; },
      });
      monitor = current;
      ctx.ui.notify(`${mode.toUpperCase()} ${target.repo}${target.number ? `#${target.number}` : ""} · branch ${target.branch}\n${target.url}\nPolls every five minutes; continues after green.`, "info");
      timer = setInterval(() => void current.poll(), 5 * 60_000);
      timer.unref();
      await current.poll();
    } catch (error) {
      if (requestEpoch === epoch) ctx.ui.notify(clean(String(error)), "error");
    } finally {
      if (controller !== setupController) setupController.abort();
      starting = false;
    }
  }

  pi.registerCommand("ci-watch", {
    description: "Watch CI and review feedback: [PR number | URL | status | stop]; default: current branch",
    handler: (args, ctx) => start("watch", args, ctx),
  });
  pi.registerCommand("ci-fix", {
    description: "Watch and fix CI/review feedback, committing and pushing verified fixes: [PR number | URL | status | stop]",
    handler: (args, ctx) => start("fix", args, ctx),
  });
  pi.on("session_start", (_event, ctx) => { stop(); context = ctx; ctx.ui.setWidget("ci-watch", undefined); });
  pi.on("session_shutdown", () => stop());
  pi.on("agent_end", () => {
    if (monitor?.repairing) {
      const current = monitor;
      setTimeout(() => { if (monitor === current && current.active) void current.finished(); }, 0);
    }
  });
}
