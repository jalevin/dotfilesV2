# Telegram agent notifications

Let local agents (and any script) message my phone via Telegram.

## Model

- **One bot per machine.** Create a separate bot per computer so the sender I
  see on my phone tells me which machine is talking. The scripts here are
  byte-identical on every machine; only the local Keychain contents differ.
- **Creds live in the macOS login Keychain**, never in this repo:
  - `telegram-bot-token` — the bot token (secret, per-machine)
  - `telegram-chat-id` — my Telegram numeric user id (same on every machine)
  Generic Keychain items aren't iCloud-synced, so a machine's token never
  leaves that machine.
- **Agents get it for free.** Agents run as my user, so they can call
  `tg-notify` directly — no Vault re-auth, no 1Password unlock, works while
  I'm AFK.

## Layout

```
telegram/                        <- this package (top-level repo dir, NOT stowed)
├── tg-setup                     <- one-time per-machine credential setup
├── tg-notify                    <- send a message (agents/scripts -> my phone)
├── tg-listen                    <- receive messages (my phone -> agents/scripts)
├── tg-brokerd                   <- single poller that ROUTES replies per session
├── tg-await                     <- block for the reply to a specific message
├── bot-profile-640x640.png      <- bot avatar   (BotFather /setuserpic)
├── bot-description-640x360.png  <- intro banner  (BotFather description photo)
└── README.md
home/.local/bin/tg-{setup,notify,listen,brokerd,await} -> ../../../telegram/tg-*
```

Only the two commands are deployed into `$HOME`: stow links them onto PATH from
`~/.local/bin`; the scripts, docs, and assets stay in the repo.

## Per-machine setup

1. In Telegram, `@BotFather` → `/newbot`. Pick a unique, non-descriptive
   username ending in `bot` (e.g. `jl_relay_bot`). Optional hardening:
   `/setjoingroups` → Disable, keep `/setprivacy` on. Set the avatar with
   `/setuserpic` (upload `bot-profile-640x640.png`).
2. Get my numeric user id from `@userinfobot`.
3. Message the new bot once — a bot can't DM you until you've talked to it.
4. Store the creds: `tg-setup` (prompts for token + chat_id, validates the
   token, sends a test message).

## Usage

```sh
tg-notify "build finished"           # message from args
long-running-cmd 2>&1 | tg-notify    # message from stdin
tg-notify -t "deploy" "prod is green" # optional bold title line
```

Every message is prefixed with `[ComputerName]`. Body text is HTML-escaped, so
arbitrary log output is safe to pipe in.

## Rotating a token

Reissue via `@BotFather` (`/revoke`), then re-run `tg-setup` on that machine
(the Keychain items are updated in place with `-U`).

## Listening for replies (`tg-listen`)

`tg-listen` receives messages sent *to* the bot via long polling (pull-based —
works behind NAT, no public endpoint). It delivers **only** messages from my own
user id (the stored `telegram-chat-id`) and drops everything else — anyone can
message a bot, so this allowlist, not the bot's name, is the boundary.

```sh
tg-listen                              # stream my replies to stdout
reply=$(tg-listen --once --from-now)   # block for a single reply (approvals)
tg-listen -- ~/bin/handle-msg          # dispatch each message to a handler on stdin
```

Approval flow from an agent:

```sh
tg-notify -t "approve?" "Deploy prod-05? reply yes/no"
if [ "$(tg-listen --once --from-now)" = "yes" ]; then
  echo "approved"
fi
```

Notes:
- **One listener per bot.** A second `getUpdates` consumer on the same token
  gets HTTP 409 and they steal each other's updates.
- `--from-now` skips any backlog so a stale "yes" from earlier can't be consumed.
- The ack offset persists to `~/.local/state/telegram/offset`, so a restart
  doesn't replay old messages (Telegram retains undelivered updates ~24h).

`tg-listen` is the simple case: one consumer, every allowed message. When you
have **multiple sessions** that each need only their own replies, use the broker
below instead (don't run both — both poll the same bot).

## Request/response across multiple sessions (`tg-brokerd` + `tg-await`)

A bot allows only one `getUpdates` consumer, so concurrent sessions can't each
poll. Instead, one **`tg-brokerd`** owns polling and routes each reply to the
session that sent the original message, keyed by the id of the message being
replied to:

- **Buttons** — `tg-notify --button` attaches an inline keyboard; a tap yields a
  `callback_query` routed by `callback_query.message.message_id` (payload =
  `callback_data`). Broker auto-acks so the phone's spinner clears.
- **Force-reply** — `tg-notify --force-reply` makes your typed reply link back
  via `message.reply_to_message.message_id` (payload = the text).

Both print the sent `message_id`; the session then `tg-await <id>` for *its*
reply. A session can only ever receive a reply to a message it sent.

```
one bot ── tg-brokerd (single poller, allowlisted to my user id)
                │ routes by replied-to message_id
   ┌────────────┼─────────────┐
 replies/17   replies/42   replies/99      (~/.local/state/telegram/replies/)
   │            │             │
 session A    session B    session C   ── each blocks on tg-await <its id>
```

Start the broker once per machine (background it or use a launchd agent):

```sh
tg-brokerd &     # single poller; do NOT also run tg-listen
```

Then each session, independently:

```sh
# button approval
id=$(tg-notify --button "Yes=yes" --button "No=no" -t "approve?" "Deploy prod-05?")
[ "$(tg-await "$id" --timeout 300)" = "yes" ] && echo approved

# open-ended question
id=$(tg-notify --force-reply "Which region? reply below")
region=$(tg-await "$id")
```

Notes:
- Run **one broker per bot**; it replaces `tg-listen` for this use (both poll).
- Replies are dropped into `~/.local/state/telegram/replies/<message_id>` and
  consumed by `tg-await`; `--timeout 0` (default) waits forever.
- `callback_data` is capped at 64 bytes by Telegram — keep button payloads short.
- Only messages/callbacks from my own user id are routed; the broker fails closed
  if that id is missing or non-numeric.
