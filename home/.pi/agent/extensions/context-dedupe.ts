import { realpathSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Pi skips a context file only when its path string repeats. ~/.pi/agent/AGENTS.md
// (global, for sessions outside $HOME) and ~/AGENTS.md (for Cursor and Amp) both
// link to home/.ai/AGENTS.md, so sessions under $HOME would load it twice.
export function dedupeContextFiles<T extends { path: string }>(files: T[]): T[] {
  const seen = new Set<string>();
  return files.filter(file => {
    let key = file.path;
    try { key = realpathSync(file.path); } catch { /* keep unresolvable paths */ }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", event => {
    const files = event.systemPromptOptions.contextFiles;
    if (!files) return;
    const unique = dedupeContextFiles(files);
    // Pi builds the run's prompt from this array, so edit it in place.
    if (unique.length !== files.length) files.splice(0, files.length, ...unique);
  });
}
