import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export function reviewFeedback(output: string): { decision: string; content: string } {
  const result = JSON.parse(output);
  if (!result || typeof result !== "object" || typeof result.decision !== "string") throw new Error("Plannotator returned no structured decision.");
  return { decision: result.decision, content: JSON.stringify(result, null, 2) };
}

export async function recentDocuments(cwd: string): Promise<string[]> {
  const seen = new Set<string>();
  const files: { path: string; time: number }[] = [];
  async function walk(dir: string) {
    let real: string;
    try { real = await fs.realpath(dir); } catch { return; }
    if (seen.has(real)) return;
    seen.add(real);
    for (const entry of await fs.readdir(real, { withFileTypes: true })) {
      const file = path.join(real, entry.name);
      const stat = await fs.stat(file).catch(() => undefined);
      if (stat?.isDirectory()) await walk(file);
      else if (stat?.isFile() && file.endsWith(".md")) files.push({ path: file, time: stat.mtimeMs });
    }
  }
  for (const dir of ["plans", "research", "reviews"]) await walk(path.join(cwd, ".hive", dir));
  return files.sort((a, b) => b.time - a.time).slice(0, 5).map(file => file.path);
}

export default function (pi: ExtensionAPI) {
  let active: AbortController | undefined;
  let epoch = 0;
  const reset = () => { epoch++; active?.abort(); active = undefined; };
  pi.on("session_start", reset);
  pi.on("session_shutdown", reset);

  async function review(kind: "code" | "doc", input: string, ctx: ExtensionCommandContext) {
    if (active) { ctx.ui.notify("A Plannotator review is running. Use /review:cancel first.", "warning"); return; }
    const generation = epoch;
    let target = input.trim();
    if (kind === "doc") {
      if (!target) {
        if (!ctx.hasUI) { ctx.ui.notify("Supply a document path for non-interactive review.", "error"); return; }
        const docs = await recentDocuments(ctx.cwd);
        if (!docs.length) { ctx.ui.notify("No plans, research, or reviews found under .hive/.", "warning"); return; }
        target = await ctx.ui.select("Document to review", docs) ?? "";
        if (!target) return;
      }
      if (!/^https?:\/\//.test(target)) {
        const paths = [path.resolve(ctx.cwd, target), path.resolve(ctx.cwd, ".hive", target)];
        const found = await Promise.all(paths.map(async file => (await fs.stat(file).catch(() => undefined))?.isFile() ? file : undefined));
        const file = found.find(Boolean);
        if (!file) { ctx.ui.notify(`Document not found: ${target}`, "error"); return; }
        target = file;
      }
    } else if (target && !/^https:\/\/(github\.com|gitlab\.com)\/.+\/(pull|merge_requests)\/\d+\/?$/.test(target)) {
      ctx.ui.notify("Use a GitHub/GitLab PR/MR URL, or no argument for the local diff.", "error"); return;
    }
    if (epoch !== generation || active) return;
    const controller = new AbortController();
    active = controller;
    const label = target || "local diff";
    ctx.ui.setStatus("plannotator", `Review: ${label}`);
    const args = kind === "code" ? ["review", ...(target ? [target] : []), "--json"] : ["annotate", target, "--gate", "--json"];
    ctx.ui.notify(`Opening Plannotator for ${label}.`, "info");
    void (async () => {
      try {
        const result = await pi.exec("plannotator", args, { cwd: ctx.cwd, signal: controller.signal });
        if (controller.signal.aborted || generation !== epoch || result.killed) return;
        if (result.code !== 0) throw new Error(result.stderr.trim() || `Plannotator exited ${result.code}`);
        const feedback = reviewFeedback(result.stdout);
        if (["dismissed", "cancelled"].includes(feedback.decision)) { ctx.ui.notify("Review closed without a decision.", "info"); return; }
        const prompt = [
          `My Plannotator ${kind} review of ${JSON.stringify(label)} returned:`, feedback.content,
          "Act on actionable annotations in this session. Read the referenced source first. Approval with notes is guidance; approval alone needs no changes. A denial without actionable feedback needs clarification. Do not commit, push, post GitHub comments, or merge unless separately authorized.",
        ].join("\n\n");
        pi.sendUserMessage(prompt, ctx.isIdle() ? undefined : { deliverAs: "followUp" });
      } catch (error) {
        if (!controller.signal.aborted && generation === epoch) ctx.ui.notify(`Plannotator failed: ${error}`, "error");
      } finally {
        if (generation === epoch && active === controller) { active = undefined; ctx.ui.setStatus("plannotator", undefined); }
      }
    })();
  }
  pi.registerCommand("review:code", { description: "Open Plannotator for the current diff or a PR/MR URL", handler: (args, ctx) => review("code", args, ctx) });
  pi.registerCommand("review:doc", { description: "Open a document in Plannotator, or pick a recent .hive document", handler: (args, ctx) => review("doc", args, ctx) });
  pi.registerCommand("review:cancel", { description: "Cancel the active Plannotator session", handler: async (_args, ctx) => {
    reset(); ctx.ui.setStatus("plannotator", undefined); ctx.ui.notify("Review cancelled.", "info");
  } });
}
