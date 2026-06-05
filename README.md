# pi-timestamps

Inline UTC timestamps for every message in [pi](https://pi.dev) coding agent.

```
user message  2026-06-05T21:44:02Z
assistant response  2026-06-05T21:44:02Z
```

## Features

- **Inline** — timestamps appended directly to each message
- **UTC ISO format** — `2026-06-05T21:44:02Z`
- **Dim-styled** — uses ANSI dim (`\x1b[2m`) for visual parity with thinking blocks; works with any theme
- **LLM-safe** — timestamps are stripped at the `context` event, so the model never sees them
- **Zero config** — install and it works
- **No dependencies** — pure TypeScript, no runtime deps

## Install

```bash
pi install npm:@cad0p/pi-timestamps
```

Or try without installing:

```bash
pi -e npm:@cad0p/pi-timestamps
```

## How it works

1. At `message_end`, appends `  2026-06-05T21:44:02Z` (dimmed) to user/assistant messages
2. At `context` event (before LLM call), strips the timestamp from a deep copy — the session retains timestamps for history/replay; the LLM sees clean messages

## Visual style

Timestamps render with terminal's native "dim" attribute (SGR 2), matching pi's thinking block style. No hardcoded colors — works with light/dark themes automatically.

## License

MIT