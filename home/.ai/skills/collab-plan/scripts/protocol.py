#!/usr/bin/env python3
"""collab-plan protocol helper.

Formats and parses the machine-readable `collab-plan` blocks that ride inside
Slack messages. Using one implementation everywhere keeps the block shape
identical across independent Claude sessions, which is what lets them
interoperate. See ../references/protocol.md for the spec.

Usage:
  # Build a message (prose + fenced block) ready to pass to slack_send_message:
  python protocol.py format --type INVITE --session 1721490000.000100 \
      --from patrick --to alice,bob \
      --canvas https://acme.slack.com/docs/T1/F123 \
      --text "Auth refactor design" \
      --prose "Kicking off the auth-refactor design. Canvas + scope inside."

  # Parse raw thread text (as returned by slack_read_thread) on stdin.
  # Emits one JSON object per line for every collab-plan block found:
  slack_thread_dump.txt | python protocol.py parse
"""
import argparse
import json
import re
import sys

VERSION = "1"
TYPES = {"INVITE", "JOIN", "NOTE", "QUESTION", "REPLY", "REPORT", "SYNTHESIS", "CLOSE"}

# Matches a fenced block whose info string is exactly `collab-plan`.
BLOCK_RE = re.compile(r"```collab-plan\s*\n(.*?)\n```", re.DOTALL)


def build_block(fields: dict) -> str:
    """Return a single fenced collab-plan block (compact, one-line JSON)."""
    payload = {k: v for k, v in fields.items() if v not in (None, "", [], {})}
    payload.setdefault("v", VERSION)
    line = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return "```collab-plan\n" + line + "\n```"


def cmd_format(args) -> int:
    if args.type not in TYPES:
        sys.stderr.write(f"error: --type must be one of {sorted(TYPES)}\n")
        return 2
    to = [t.strip() for t in args.to.split(",") if t.strip()] if args.to else []
    fields = {
        "v": VERSION,
        "type": args.type,
        "session": args.session,
        "from": getattr(args, "from"),
        "to": to,
        "canvas": args.canvas,
        "ref": args.ref,
        "text": args.text,
    }
    block = build_block(fields)
    out = (args.prose.rstrip() + "\n\n" + block) if args.prose else block
    print(out)
    return 0


def parse_blocks(text: str) -> list:
    """Extract and JSON-decode every collab-plan block in `text`."""
    results = []
    for m in BLOCK_RE.finditer(text):
        raw = m.group(1).strip()
        try:
            results.append(json.loads(raw))
        except json.JSONDecodeError as e:
            results.append({"_parse_error": str(e), "_raw": raw})
    return results


def cmd_parse(args) -> int:
    text = sys.stdin.read()
    for obj in parse_blocks(text):
        print(json.dumps(obj, ensure_ascii=False))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="collab-plan protocol helper")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("format", help="build a message with a collab-plan block")
    f.add_argument("--type", required=True)
    f.add_argument("--session", required=True)
    f.add_argument("--from", required=True, dest="from")
    f.add_argument("--to", default="", help="comma-separated handles")
    f.add_argument("--canvas", default="")
    f.add_argument("--ref", default="")
    f.add_argument("--text", default="")
    f.add_argument("--prose", default="", help="human-readable text above block")
    f.set_defaults(func=cmd_format)

    pr = sub.add_parser("parse", help="parse collab-plan blocks from stdin")
    pr.set_defaults(func=cmd_parse)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
