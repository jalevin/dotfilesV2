import { homedir } from "node:os";
import { basename, relative, sep } from "node:path";
import type { ContextUsage, ExtensionAPI, SessionEntry, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { colorToRgb, rgbColor, stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const plain = (text: string) => stripTerminalSequences(text).replace(/\p{Cc}/gu, " ");

export function formatTokens(tokens: number): string {
  if (tokens < 1_000) return String(Math.round(tokens));
  if (tokens < 1_000_000) return `${Number((tokens / 1_000).toFixed(1))}k`;
  return `${Number((tokens / 1_000_000).toFixed(1))}M`;
}

export function directoryLabel(cwd: string, home: string): string {
  const withinHome = relative(home, cwd);
  if (withinHome === "") return "~";
  return withinHome !== ".." && !withinHome.startsWith(`..${sep}`) && !withinHome.startsWith(sep)
    ? `~${sep}${withinHome}` : cwd;
}

type FooterDetails = {
  cwd: string;
  home: string;
  branch: string | null;
  model: string;
  effort: string;
  usage?: ContextUsage;
  contextWindow?: number;
  estimatedCost?: number;
};

export function estimatedSessionCost(entries: readonly SessionEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    const usage = entry.type === "usage" || entry.type === "compaction" || entry.type === "branch_summary"
      ? entry.usage
      : entry.type === "message" && (entry.message.role === "assistant" || entry.message.role === "toolResult")
        ? entry.message.usage : undefined;
    const cost = usage?.cost.total;
    if (cost !== undefined && Number.isFinite(cost)) total += cost;
  }
  return total;
}

type FooterTheme = Pick<Theme, "fg" | "style" | "colors">;

function accent(theme: FooterTheme, token: ThemeColor, text: string): string {
  const { r, g, b } = colorToRgb(theme.colors[token]);
  // Codex softens syntax-derived status colors to 85% saturation, without dimming.
  const luma = Math.floor((77 * r + 150 * g + 29 * b) / 256);
  const soften = (channel: number) => Math.floor((channel * 85 + luma * 15 + 50) / 100);
  return theme.style(text, { fg: rgbColor(soften(r), soften(g), soften(b)) });
}

export function renderFooter(width: number, data: FooterDetails, theme: FooterTheme): string {
  if (width < 1) return "";
  const padding = width > 3 ? 1 : 0;
  const available = width - padding * 2;
  const window = data.usage?.contextWindow ?? data.contextWindow;
  const percent = data.usage?.percent;
  const known = percent !== undefined && percent !== null;
  const used = data.usage?.tokens ?? (known && window ? Math.round(window * percent / 100) : undefined);
  const context = `ctx ${used === undefined || used === null ? "?" : formatTokens(used)}/${window ? formatTokens(window) : "?"}${known ? ` ${Math.round(percent)}%` : ""}`;
  const contextColor = known && percent >= 90 ? "error" : known && percent >= 70 ? "warning" : undefined;
  const joiner = theme.fg("dim", " · ");
  const leading = [
    accent(theme, "syntaxType", `${plain(data.model)}/${plain(data.effort)}`),
    contextColor ? theme.fg(contextColor, context) : accent(theme, "syntaxNumber", context),
    data.branch ? accent(theme, "syntaxFunction", plain(data.branch)) : theme.fg("muted", "no branch"),
  ].join(joiner);
  const cost = accent(theme, "syntaxNumber", `~$${data.estimatedCost === undefined ? "?" : data.estimatedCost.toFixed(3)}`);
  let directory = plain(directoryLabel(data.cwd, data.home));
  const fixedWidth = visibleWidth(leading + joiner + joiner + cost);
  if (fixedWidth + visibleWidth(directory) > available) directory = plain(basename(data.cwd) || data.cwd);
  const directoryBudget = available - fixedWidth;
  let line = directoryBudget > 0
    ? [leading, accent(theme, "syntaxString", truncateToWidth(directory, directoryBudget)), cost].join(joiner)
    : leading + joiner + cost;
  // On very narrow panes preserve the trailing estimate when it fits.
  if (visibleWidth(line) > available && available > visibleWidth(cost + joiner) + 4) {
    line = truncateToWidth(leading, available - visibleWidth(cost + joiner)) + joiner + cost;
  }
  return " ".repeat(padding) + truncateToWidth(line, available) + " ".repeat(padding);
}

export default function footer(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    ctx.ui.setFooter((tui, _theme, footerData) => {
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
      let costKey: string | undefined;
      let estimatedCost = 0;
      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width: number): string[] {
          const key = `${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getLeafId()}`;
          if (key !== costKey) {
            estimatedCost = estimatedSessionCost(ctx.sessionManager.getEntries());
            costKey = key;
          }
          const line = renderFooter(width, {
            cwd: ctx.sessionManager.getCwd(), home: homedir(), branch: footerData.getGitBranch(),
            model: ctx.model?.id ?? "no model", effort: pi.getThinkingLevel(),
            usage: ctx.getContextUsage(), contextWindow: ctx.model?.contextWindow,
            estimatedCost,
          }, ctx.ui.theme);
          const statuses = [...footerData.getExtensionStatuses()].sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => truncateToWidth(ctx.ui.theme.fg("dim", plain(text)), Math.max(0, width)));
          return [line, ...statuses, ""];
        },
      };
    });
  });
}
