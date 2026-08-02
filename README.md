# pi-timestamps

Compact local timestamps for assistant messages in the [pi](https://pi.dev) coding agent.

```text
assistant response  21:44 05.06.2026 (3м)
assistant response  23:50 05.06.2026 (2ч 06м)
```

Forked from [`cad0p/pi-timestamps`](https://github.com/cad0p/pi-timestamps).

## Features

- **Local time** — uses the machine's timezone
- **Readable format** — `HH:mm DD.MM.YYYY`
- **Elapsed prompt time** — whole minutes since the latest user message, formatted as `3м` or `2ч 06м`
- **Dim-styled** — uses ANSI dim (`\x1b[2m`) and works with any theme
- **LLM-safe** — strips generated metadata before each model request
- **Reload-safe** — restores the latest user timestamp from session history
- **No runtime dependencies**

## Install

```bash
pi install git:github.com/krajcik/pi-timestamps
```

Or try without installing:

```bash
pi -e git:github.com/krajcik/pi-timestamps
```

Run `/reload` after replacing another timestamp extension in an active session.

## How it works

1. Tracks the timestamp of the latest user message.
2. At `message_end`, appends local time and elapsed prompt time to each assistant message.
3. At `context`, removes generated metadata from a deep copy. Session history keeps the display value; the model receives clean messages.

Elapsed time uses the assistant message timestamp, rounds down to whole minutes, and remains cumulative across tool turns until the next user message.

## License

MIT
