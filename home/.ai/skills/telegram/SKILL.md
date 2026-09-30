---
name: telegram
description: >
  Message Jeff on his phone via Telegram, including asking a question that
  blocks until he answers. Use when he says "ping me", "notify me when this is
  done", "text me", "let me know when it finishes", "ask me on my phone", or
  when a long-running task completes and he is not at the terminal. Also use to
  get approval before a destructive or irreversible action, or to unblock a
  decision while he is away.
allowed-tools: "Bash(tg-notify:*),Bash(tg-await:*),Bash(tg-brokerd:*)"
---

# Telegram

This machine has its own Telegram bot and the commands are on PATH. Credentials
come from Jeff's login Keychain, so there is no setup to do — just run them.

Every message is prefixed with `[ComputerName]`, and body text is HTML-escaped,
so piping raw log output is safe.

## When to use it

Good reasons:

- a long run finished, failed, or needs attention while he is away
- confirmation before something destructive or irreversible
- a decision is blocking progress and he is not at the terminal

Don't send routine chatter. A ping is an interruption on his phone — if the
answer can wait for him to look at the session, let it wait.

## Notify — one-way, always works

```bash
tg-notify "migration finished: 412 rows"
some-long-command 2>&1 | tg-notify        # body from stdin
tg-notify -t "deploy" "prod-05 is green"  # bold title line
```

This needs nothing running and never blocks. Prefer it.

## Ask and wait — two-way

Requires the broker `tg-brokerd` to be running on this machine, which Jeff
starts manually. **If `tg-await` warns the broker isn't running, or it times
out, stop waiting and ask him in the session instead** — don't retry and don't
start the broker yourself.

Approval buttons:

```bash
id=$(tg-notify --button "Yes=yes" --button "No=no" -t "approve?" "Deploy prod-05?")
[ "$(tg-await "$id" --timeout 300)" = "yes" ] && echo approved
```

Free-text question:

```bash
id=$(tg-notify --force-reply "Which region?")
region=$(tg-await "$id" --timeout 300)
```

**Always pass `--timeout`.** The default is `0`, which waits forever and will
hang the session until he happens to reply.

`--button` and `--force-reply` print the sent message id; pass that to
`tg-await <id>` and you get back only that message's reply. Each `tg-await`
receives only the reply to the message it sent, so several concurrent sessions
can use this at once without crossing wires. Only Jeff's own replies are
routed. Keep button payloads short — Telegram caps `callback_data` at 64 bytes.

## Notes

- `tg-listen` also exists, but it and `tg-brokerd` both poll the same bot and a
  bot allows only one consumer. Don't start `tg-listen` if the broker is up.
- Full details: `tg-notify --help`, `tg-await --help`, and
  `~/projects/dotfiles/telegram/README.md`.
