import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const install = join(homedir(), ".pi/agent/install");
const version = readFileSync(join(install, "current-version"), "utf8").trim();
const modules = join(install, "releases", version, "node_modules");
const require = createRequire(join(modules, "package.json"));
const { createJiti } = require("jiti");
const tui = await import(join(modules, "@earendil-works/pi-tui/dist/index.js"));
const themeApi = await import(join(modules, "@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"));
const { validateThemeJson } = await import(join(modules, "@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme-schema.js"));
themeApi.setThemeJsonValidator(validateThemeJson);
const themePath = new URL("../home/.pi/agent/themes/codex.json", import.meta.url).pathname;
const codexTheme = themeApi.loadThemeFromPath(themePath, "truecolor");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-tui": join(modules, "@earendil-works/pi-tui/dist/index.js"),
} });
const { default: footer, renderFooter, directoryLabel, estimatedSessionCost } = await jiti.import(
  new URL("../home/.pi/agent/extensions/footer/index.ts", import.meta.url).pathname,
);
const theme = { colors: codexTheme.colors, fg: (_color: string, text: string) => text,
  style: (text: string) => text };
const details = { cwd: "/Users/jeff/projects/dotfiles", home: "/Users/jeff", branch: "main", model: "claude-opus-4-8",
  effort: "high", usage: { tokens: 24000, contextWindow: 200000, percent: 12 }, estimatedCost: 1.234 };

test("wide footer shows directory, branch, model, effort, and context on one line", () => {
  const line = renderFooter(140, details, theme);
  assert.equal(line.trim(), "claude-opus-4-8/high · ctx 24k/200k 12% · main · ~/projects/dotfiles · ~$1.234");
  assert.equal(/ {2,}/.test(line.trim()), false);
  assert.equal(line.includes("\n"), false);
  assert.ok(tui.visibleWidth(line) <= 140);
});
test("long Hive worktrees and Unicode remain within narrow pane widths", () => {
  const data = { ...details, cwd: "/Users/jeff/.local/share/hive/repos/ai-sdk-wt-abcdefghijkl",
    branch: "hive/feature-界界-very-long-branch-name" };
  for (const width of [0, 1, 2, 3, 10, 40, 70, 80, 100, 140]) {
    assert.ok(tui.visibleWidth(renderFooter(width, data, theme)) <= width, `overflow at ${width}`);
  }
  assert.match(renderFooter(80, data, theme), /claude-opus-4-8/);
});
test("unknown context after compaction is not shown as zero usage", () => {
  const line = renderFooter(140, { ...details, usage: { tokens: null, contextWindow: 200000, percent: null } }, theme);
  assert.match(line, /ctx \?\/200k/);
  assert.doesNotMatch(line, /0%/);
});
test("context thresholds and absent models render safely", () => {
  const colors: string[] = [];
  const colored = { ...theme, fg: (color: string, text: string) => { colors.push(color); return text; } };
  renderFooter(140, { ...details, usage: { ...details.usage, percent: 75 } }, colored);
  assert.ok(colors.includes("warning"));
  colors.length = 0;
  renderFooter(140, { ...details, usage: { ...details.usage, percent: 95 } }, colored);
  assert.ok(colors.includes("error"));
  const line = renderFooter(140, { ...details, model: "no model", usage: undefined, contextWindow: undefined }, theme);
  assert.match(line, /no model/); assert.match(line, /ctx \?\/\?/);
});
test("footer matches Codex's softened syntax accents and preserves trailing cost", () => {
  const fields = new Map<string, string>();
  const colored = { ...theme, style: (text: string, options: any) => { fields.set(text, tui.colorToHex(options.fg)); return text; } };
  renderFooter(140, details, colored);
  assert.equal(fields.get("claude-opus-4-8/high"), "#f6e2b7");
  assert.equal(fields.get("ctx 24k/200k 12%"), "#f2b590");
  assert.equal(fields.get("main"), "#8fb3ef");
  assert.equal(fields.get("~/projects/dotfiles"), "#abdfa7");
  assert.equal(fields.get("~$1.234"), fields.get("ctx 24k/200k 12%"));
  assert.match(renderFooter(70, details, theme), /~\$1\.234\s*$/);
});
test("dark and light themes validate and render with Pi's color handling", () => {
  for (const [name, appearance] of [["codex", "dark"], ["codex-light", "light"]]) {
    const file = new URL(`../home/.pi/agent/themes/${name}.json`, import.meta.url).pathname;
    for (const mode of ["truecolor", "256color"]) {
      const actual = themeApi.loadThemeFromPath(file, mode);
      assert.equal(actual.appearance, appearance);
      const line = renderFooter(140, details, actual);
      assert.ok(line.includes("\u001b["));
      assert.ok(tui.visibleWidth(line) <= 140);
      assert.match(tui.stripTerminalSequences(line), /claude-opus-4-8\/high.*~\$1\.234/);
    }
  }
});
test("estimated cost includes recorded model, tool, compaction, and detached usage", () => {
  const usage = (cost: number) => ({ cost: { total: cost } });
  assert.equal(estimatedSessionCost([
    { type: "message", message: { role: "assistant", usage: usage(1) } },
    { type: "message", message: { role: "toolResult", usage: usage(2) } },
    { type: "compaction", usage: usage(3) },
    { type: "branch_summary", usage: usage(4) },
    { type: "usage", usage: usage(5) },
    { type: "message", message: { role: "user" } },
    { type: "message", message: { role: "toolResult" } },
  ]), 15);
  assert.equal(estimatedSessionCost([]), 0);
});
test("home abbreviation respects directory boundaries and strips control sequences", () => {
  assert.equal(directoryLabel("/Users/jeffrey/project", "/Users/jeff"), "/Users/jeffrey/project");
  assert.equal(directoryLabel("/Users/jeff", "/Users/jeff"), "~");
  const line = renderFooter(140, { ...details, branch: "main\n\u001b[31mbad" }, theme);
  assert.equal(line.includes("\n"), false); assert.equal(line.includes("\u001b"), false);
});
test("footer reads current model and retains extension statuses; branch watcher is disposed", () => {
  let start: any, factory: any, disposed = false, rendered = false, branchChanged: any;
  footer({ on: (_event: string, callback: any) => start = callback, getThinkingLevel: () => "high" });
  const ctx: any = { mode: "tui", model: { id: "model-one", contextWindow: 200000 },
    sessionManager: { getCwd: () => details.cwd, getSessionId: () => "session", getLeafId: () => "leaf", getEntries: () => [] },
    getContextUsage: () => details.usage,
    ui: { theme, setFooter: (value: any) => factory = value } };
  start({}, ctx);
  const component = factory({ requestRender: () => rendered = true }, theme, {
    onBranchChange: (callback: any) => { branchChanged = callback; return () => disposed = true; },
    getGitBranch: () => "main", getExtensionStatuses: () => new Map([["hive", "Task hc-123"]]),
  });
  assert.match(component.render(140)[0], /model-one/);
  ctx.model.id = "model-two";
  assert.match(component.render(140)[0], /model-two/);
  assert.equal(component.render(140)[1], "Task hc-123");
  branchChanged(); assert.equal(rendered, true);
  component.dispose(); assert.equal(disposed, true);
});
