import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider, SlashCommand } from "@earendil-works/pi-tui";

type Skill = Pick<SlashCommand, "name" | "description">;
export function expandDollarSkill(text: string, skills: Skill[]): string | undefined {
  const match = text.match(/^\$([a-z0-9-]+)(\s[\s\S]*)?$/i);
  if (!match || !skills.some(skill => skill.name === match[1])) return;
  const args = match[2]?.trimStart();
  return `/skill:${match[1]}${args ? ` ${args}` : ""}`;
}
export function skillAutocomplete(current: AutocompleteProvider, getSkills: () => Skill[]): AutocompleteProvider {
  return {
    triggerCharacters: [...new Set([...(current.triggerCharacters ?? []), "$"])],
    async getSuggestions(lines, row, col, options) {
      const prefix = row === 0 ? lines[0].slice(0, col) : "";
      const match = prefix.match(/^\$([a-z0-9-]*)$/i);
      if (!match) return current.getSuggestions(lines, row, col, options);
      const query = match[1].toLowerCase();
      const items = getSkills().filter(skill => skill.name.toLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(skill => ({ value: `$${skill.name}`, label: `$${skill.name}`, description: skill.description }));
      return items.length ? { items, prefix } : null;
    },
    applyCompletion(lines, row, col, item, prefix) {
      if (row !== 0 || !prefix.startsWith("$") || !item.value.startsWith("$")) {
        return current.applyCompletion(lines, row, col, item, prefix);
      }
      const tail = lines[0].slice(col);
      const insert = item.value + (tail.startsWith(" ") ? "" : " ");
      return { lines: [insert + tail, ...lines.slice(1)], cursorLine: 0, cursorCol: insert.length };
    },
    shouldTriggerFileCompletion: (lines, row, col) => current.shouldTriggerFileCompletion?.(lines, row, col) ?? false,
  };
}
export default function (pi: ExtensionAPI) {
  const skills = () => pi.getCommands().filter(command => command.source === "skill")
    .map(command => ({ name: command.name.replace(/^skill:/, ""), description: command.description }));
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode === "tui") ctx.ui.addAutocompleteProvider(current => skillAutocomplete(current, skills));
  });
  pi.on("input", event => {
    const text = expandDollarSkill(event.text, skills());
    return text ? { action: "transform" as const, text } : { action: "continue" as const };
  });
}
