---
name: meeting-notes
description: >
  File pasted meeting notes into today's Obsidian daily note under the `## Meetings`
  section. Use when the user pastes meeting notes and asks to add them, log them,
  drop them in, or file them — phrases like "add my meeting notes", "log these
  meetings", "drop these in my daily note", "file these notes".
allowed-tools: "Bash(date:*),Bash(echo:*),Bash(ls:*),Read,Edit"
---

# Meeting Notes

Append pasted meeting notes into today's daily note under `## Meetings`.

## 1. Resolve today's daily note path

```bash
echo "$OBSIDIAN_NOTEBOOK_DIR"
```

Stop if empty — tell the user to set `OBSIDIAN_NOTEBOOK_DIR`.

```bash
TODAY=$(date +"%Y-%m-%d")
TODAY_DAY=$(date +"%a")   # e.g. Tue
DAILY_FILE="$OBSIDIAN_NOTEBOOK_DIR/daily/${TODAY} - ${TODAY_DAY}.md"
ls "$DAILY_FILE"
```

If the file does not exist, **stop**. Tell the user:

> Today's daily note doesn't exist yet. Open Obsidian and create it via "Daily
> notes: Open today's daily note" (so Templater renders the recurring tasks +
> carryover). Then re-invoke me.

Do not scaffold a daily note manually — the Templater render only happens inside
Obsidian and the recurring/carryover sections need it.

## 2. Read the daily note and confirm structure

Read `$DAILY_FILE`. Verify it contains a `## Meetings` section (the template's
last section). If `## Meetings` is missing, stop and tell the user the note
doesn't match the expected template structure.

## 3. Check the pasted content

The user's pasted content should already include `### <heading>` lines for each
meeting (e.g., `### chat with jack gordley`, `### alexander sniffin`). If it
doesn't, ask the user how they want it labeled before writing — do **not** invent
headings.

## 4. Insert the content

`## Meetings` is the last section in the template, so appending is simple:

- Read the file; find the end of the `## Meetings` section (which is the end of
  the file, since nothing comes after it)
- Append the new content after any existing meetings, with one blank line
  separating sections
- If `## Meetings` is currently empty, the new content goes directly below the
  heading (with one blank line after the heading)

**Preserve the user's formatting verbatim** — don't reflow bullets, normalize
whitespace, or fix typos. The notes are theirs as written.

## 5. Report

Tell the user:

- File path written
- Names of the meetings added (the `### <heading>` text)
