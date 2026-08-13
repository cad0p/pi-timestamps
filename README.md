# pi-timestamps

UTC timestamps for every message in [pi](https://pi.dev) coding agent — rendered as dim-styled lines below each message, directly in the TUI, without touching message content.

```
user message
2026-06-05T21:44:02Z
assistant response
2026-06-05T21:44:02Z
```

## Features

- **User + assistant stamps** — a timestamp line renders below every user message and below every assistant/tool turn
- **TUI-only** — timestamps are data-less custom session entries rendered via `registerEntryRenderer`; nothing is written into message content
- **Clean export/copy/print** — `/export`, `/share`, `/copy`, `pi -p` and `--mode json` output contains no ANSI escapes and no timestamp text
- **Survives export/import** — markers and their parent timestamps round-trip through `/import` and `/resume` without duplication
- **UTC ISO format** — `2026-06-05T21:44:02Z`
- **Dim-styled** — uses ANSI dim (`\x1b[2m`) for visual parity with thinking blocks; works with any theme
- **LLM-safe** — the model only ever sees clean messages
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

1. When a user message is persisted, a `pi-timestamps` custom entry is appended (`context` event); when an assistant/tool turn ends, another is appended (`turn_end` event)
2. Custom entries carry no data — the TUI renderer reconstructs the timestamp from the parent message's `timestamp` via the session manager
3. At the `context` event, legacy v0.1.4 inline stamps are stripped from a deep copy — old sessions stay clean for the LLM

## Migration from v0.1.4

Sessions stamped by v0.1.4 keep rendering their inline dim timestamps; the legacy strip keeps them out of the LLM context. New stamps are data-less markers, so exported content stays clean.

## Visual style

Timestamps render with terminal's native "dim" attribute (SGR 2), matching pi's thinking block style. No hardcoded colors — works with light/dark themes automatically.

## License

MIT
