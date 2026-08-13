# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-08-13

<!-- USER-EDITABLE SECTION START -->
v0.2 — timestamps moved out of message content into **TUI-only data-less custom entries**.

**What's new:**
- Timestamps render as custom session entries (`registerEntryRenderer`) — message content is never touched, so `/export`, `/share`, `/copy`, `pi -p` and `--mode json` output stays clean (no ANSI escapes, no stamp text)
- User messages get timestamps too (previously assistant-only), placed below the prompt
- Timestamps survive `/import` and `/resume`; old v0.1.4 sessions keep rendering their inline stamps, and a legacy strip keeps them out of the LLM context
- **Requires pi ≥ 0.80.4** (`registerEntryRenderer`)

Install with `pi install npm:@cad0p/pi-timestamps`.
<!-- USER-EDITABLE SECTION END -->

### 🚀 Features

- Add AGENTS.md with mandatory pre-answer checklist ([#13](https://github.com/cad0p/pi-timestamps/pull/13))
- V0.2 custom-entry timestamps (data-less markers) ([#20](https://github.com/cad0p/pi-timestamps/pull/20))

### ⚙️ Miscellaneous Tasks

- *(release)* V0.1.1 ([#7](https://github.com/cad0p/pi-timestamps/pull/7))


## [0.1.1] - 2026-06-06

<!-- USER-EDITABLE SECTION START -->
First public release of `pi-timestamps`.

**Features:**
- Inline UTC ISO timestamps on every assistant message (dim-styled, matches thinking blocks)
- LLM-safe — timestamps are stripped at the `context` event so the model never sees them
- Only processes messages with a `content` field — no crashes on tool/bash messages
- Zero config, no runtime dependencies

Install with `pi install npm:@cad0p/pi-timestamps`.
<!-- USER-EDITABLE SECTION END -->


### 🚀 Features

- Only add timestamps to assistant messages ([#6](https://github.com/cad0p/pi-timestamps/pull/6))


### 🐛 Bug Fixes

- Context event crash on tool messages — only strip timestamps from user/assistant messages ([#4](https://github.com/cad0p/pi-timestamps/pull/4))

- Biome formatting ([#5](https://github.com/cad0p/pi-timestamps/pull/5))

- Remove unused UserMessage import, add trailing newline ([#8](https://github.com/cad0p/pi-timestamps/pull/8))


