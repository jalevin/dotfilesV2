import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { rgbColor, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { EditorTheme, TUI, TuiMouseEvent } from "@earendil-works/pi-tui";

export class PromptEditor extends CustomEditor {
  private palette: () => Theme;
  private above = 0;
  private below = 0;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, palette: () => Theme) {
    super(tui, theme, keybindings, { paddingX: 0 });
    this.palette = palette;
  }

  override setPaddingX(_padding: number) {
    // The prompt gutter supplies padding; native wrap/cursor layout uses the rest.
    super.setPaddingX(0);
  }
  protected override renderTopBorder(_width: number, hidden: number): string {
    this.above = hidden;
    return "";
  }
  protected override renderBottomBorder(_width: number, hidden: number): string {
    this.below = hidden;
    return "";
  }

  override render(width: number): string[] {
    if (width < 1) return [];
    const theme = this.palette();
    const gutter = Math.min(2, Math.max(0, width - 1));
    // Native wrapping needs room for a wide character plus its cursor column.
    const rows = super.render(Math.max(3, width - gutter));
    // Native borders are empty sentinel rows; autocomplete is rendered after them.
    const bottom = rows.lastIndexOf("");
    return rows.map((row, index) => {
      let line: string;
      if (index > bottom) return " ".repeat(gutter) + truncateToWidth(row, width - gutter);
      if (index === 0) line = this.above ? theme.fg("muted", ` ↑ ${this.above} more`) : "";
      else if (index === bottom) line = this.below ? theme.fg("muted", ` ↓ ${this.below} more`) : "";
      else {
        const prefix = index === 1 ? theme.fg("accent", "> ".slice(0, gutter)) : " ".repeat(gutter);
        line = prefix + row;
      }
      line = truncateToWidth(line, width);
      const gray = theme.appearance === "light" ? 217 : 59;
      return theme.style(line + " ".repeat(Math.max(0, width - visibleWidth(line))), { fg: "text", bg: rgbColor(gray, gray, gray) });
    });
  }

  override handleMouse(event: TuiMouseEvent) {
    const gutter = Math.min(2, Math.max(0, event.width - 1));
    return super.handleMouse({ ...event, x: Math.max(0, event.x - gutter), width: Math.max(3, event.width - gutter) });
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    ctx.ui.setEditorComponent((tui, theme, keys) => new PromptEditor(tui, theme, keys, () => ctx.ui.theme));
  });
  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") ctx.ui.setEditorComponent(undefined);
  });
}
