# Changelog

All notable changes to this project will be documented in this file.

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


