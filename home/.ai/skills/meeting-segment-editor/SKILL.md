---
name: meeting-segment-editor
description: Use this skill whenever the user wants to cut, split, segment, or edit a meeting recording or any video into parts based on its content. Trigger when the user mentions a video file (.mp4, .mov, .mkv, .webm, etc.) alongside words like "segment", "cut", "split", "chop", "clip", "extract sections", "break into parts", or "edit". Also trigger when they mention a "meeting recording", "call recording", "interview recording", or "webinar" and want to do anything that involves dividing it. Don't wait for the user to say "segment" — if they have a video and want to divide it by topic, speaker, or content, this skill is for them.
---

# Meeting Segment Editor

Cut a video recording into topic-based clips. The user makes one request and comes back to a clean synopsis — no interruptions during processing.

**Design principle**: Run the full pipeline silently. No questions, no approvals, no gates. When done, show the synopsis and open the output folder.

---

## Start immediately

Don't ask the user for anything up front. Extract what you can from their message:
- **Video path** — required; if missing or nonexistent, say so in one sentence and stop
- **Speaker names** — use if mentioned; otherwise infer from context or label as "Speaker A/B/C"
- **Output location** — default: a subfolder named after the video file, in the same directory as the input

Silently check for `whisper-cli` and `ffmpeg`. If either is missing, stop with a one-liner:
```
Missing: whisper-cli — install with: brew install whisper-cpp
```

---

## Step 1: Extract audio

Tell the user one line: `"Processing your recording — I'll have a summary ready shortly."`

Then run silently:
```bash
mkdir -p /tmp/meeting-segments
ffmpeg -i "<input_video>" -vn -ar 16000 -ac 1 -c:a pcm_s16le /tmp/meeting-segments/<slug>.wav -y 2>/dev/null
```

`<slug>` = lowercase filename, spaces → hyphens, max 40 chars.

---

## Step 2: Transcribe

```bash
whisper-cli \
  -m ~/.local/share/whisper-cpp/models/ggml-large-v3-q5_0.bin \
  -f /tmp/meeting-segments/<slug>.wav \
  -oj -otxt \
  --prompt "<speaker names and any known terms, comma-separated>" \
  --no-context \
  -of /tmp/meeting-segments/<slug> \
  2>/dev/null
```

For videos over 60 minutes, split the audio first:
```bash
ffmpeg -i /tmp/meeting-segments/<slug>.wav -f segment -segment_time 1800 -c copy /tmp/meeting-segments/<slug>_chunk_%03d.wav 2>/dev/null
```
Transcribe each chunk separately, then concatenate segments and adjust each `offsets.from/to` by the chunk's starting offset.

Whisper JSON structure:
```json
{
  "transcription": [
    {"offsets": {"from": 0, "to": 5200}, "text": "..."}
  ]
}
```
`offsets` values are milliseconds.

---

## Step 3: Identify segments

Build a readable timestamped transcript from the JSON:
```
[00:00:00] Hi everyone, welcome to the Q3 planning sync...
[00:00:18] Thanks Alice. On the budget side, we came in at...
```

Analyze it yourself. Look for:
- **Topic shifts**: new agenda item, "let's move on", "next up", summary phrases that close a topic
- **Speaker-driven shifts**: when a new voice takes sustained ownership of the conversation
- **Natural breaks**: pauses visible as gaps in timestamp continuity, "any questions?" closing a section

**Don't over-segment.** Aim for 3–10 meaningful segments for a typical 60-minute meeting. A segment should be something a viewer could watch standalone. Brief exchanges should fold into the surrounding topic.

For each segment, produce:
- `segment_number`, `start_time` (seconds), `end_time` (seconds)
- `speakers` (infer from names given + context clues; use "Speaker A/B/C" if unknown)
- `topic_title` (3–6 words)
- `summary` (2–3 sentences covering what was discussed and any key decisions or numbers)

Pad `start_time` 1–2 seconds before the first word to avoid clipping speech.

---

## Step 4: Render all segments

```bash
mkdir -p "<output_dir>"
```

Render every segment with stream copy (fast, no re-encode):
```bash
ffmpeg -ss <start_time> -i "<input_video>" -t <duration> -c copy "<output_dir>/<N>_<topic-slug>.mp4" -y 2>/dev/null
```

Naming convention: `01_welcome-and-agenda.mp4`, `02_q3-budget-review.mp4`, etc.

Run all cuts silently. Don't narrate each one.

If a user reports choppy playback or sync issues at the start of a clip later, re-run that cut with `-c:v libx264 -preset fast -crf 18 -c:a aac` instead of `-c copy`.

---

## Step 5: Show synopsis and open folder

Present a clean table followed by one paragraph per segment:

```
Done — found N segments in your Xh Xm recording:

┌───┬────────────────────────────────┬───────────────┬──────────┬────────────────┐
│ # │ Topic                          │ Speakers      │ Duration │ Timestamps     │
├───┼────────────────────────────────┼───────────────┼──────────┼────────────────┤
│ 1 │ Welcome and Agenda             │ Alice, Bob    │  5m 12s  │  0:00 →  5:12  │
│ 2 │ Q3 Budget Review               │ Alice, Carol  │ 18m 04s  │  5:12 → 23:16  │
│ 3 │ Roadmap Priorities             │ Bob, Dan      │ 14m 38s  │ 23:16 → 37:54  │
│ 4 │ Hiring Discussion              │ All           │ 12m 22s  │ 37:54 → 50:16  │
│ 5 │ Action Items                   │ Alice         │  5m 30s  │ 50:16 → 55:46  │
│ 6 │ Wrap-up                        │ Alice         │  2m 14s  │ 55:46 → 58:00  │
└───┴────────────────────────────────┴───────────────┴──────────┴────────────────┘

**1 · Welcome and Agenda**
Alice opens the meeting, introduces the team, and outlines today's three agenda items.

**2 · Q3 Budget Review**
Carol walks through Q3 actuals: 92% of plan overall, cloud costs ran 15% over due to August load testing. Recommends a 10% Q4 buffer.

... (one paragraph per segment)

Clips are in: ~/meetings/q3-sync/
```

Then open the folder:
```bash
open "<output_dir>"
```

That's it. The user browses the clips in Finder from there.

---

## Edge cases

**File doesn't exist** — one-sentence error, stop immediately.

**Missing dependencies** — one-line install instruction per missing tool, stop.

**No audio track** — ffmpeg will error on extraction. Say so in one sentence.

**Non-English** — add `-l <lang_code>` to whisper-cli if the user mentioned a language.

**Short video (<3 min)** — proceed normally; there may only be 1–2 segments.

**Poor transcript quality** — add "⚠️ Audio quality was low — transcript may have errors" to the synopsis header, then proceed.

**Corrupted/unreadable file** — ffmpeg will error. Suggest: `ffmpeg -i input.mov -c copy output.mp4` to remux first.
