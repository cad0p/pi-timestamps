/**
 * message-timestamps
 *
 * Appends a dim-styled UTC ISO timestamp to every user/assistant message.
 * Uses ANSI dim escape codes for visual parity with thinking blocks.
 * Strips at `context` so the LLM never sees them.
 */

import type { ExtensionAPI, Message } from "@earendil-works/pi-coding-agent";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
// Match: "  \x1b[2m2026-06-05T21:29:27Z\x1b[0m" at end of string
const TIMESTAMP_SUFFIX_REGEX = / \x1b\[2m\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\x1b\[0m$/;

function fmtUtc(ts: number): string {
	return new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function appendTimestamp(content: Message["content"], suffix: string): Message["content"] {
	const styled = `${DIM}${suffix}${RESET}`;
	if (typeof content === "string") {
		return `${content}  ${styled}`;
	}
	return [...content, { type: "text", text: `  ${styled}` }];
}

function stripTimestamp(content: Message["content"]): Message["content"] {
	if (typeof content === "string") {
		return content.replace(TIMESTAMP_SUFFIX_REGEX, "");
	}
	if (content.length > 0 && content[content.length - 1].type === "text") {
		const text = content[content.length - 1].text;
		if (TIMESTAMP_SUFFIX_REGEX.test(text)) {
			return content.slice(0, -1);
		}
	}
	return content;
}

export default function (pi: ExtensionAPI) {
	pi.on("message_end", async (event, _ctx) => {
		const msg = event.message;

		if (msg.role !== "user" && msg.role !== "assistant") {
			return;
		}

		const ts = (msg as any).timestamp ?? Date.now();
		const suffix = fmtUtc(ts);

		return {
			message: {
				...msg,
				content: appendTimestamp(msg.content, suffix),
			},
		};
	});

	pi.on("context", async (event, _ctx) => {
		const cleanMessages = event.messages.map((m) => ({
			...m,
			content: stripTimestamp(m.content),
		}));
		return { messages: cleanMessages };
	});
}