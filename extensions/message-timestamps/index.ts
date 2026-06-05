/**
 * message-timestamps
 *
 * Appends a dim-styled UTC ISO timestamp to every user/assistant message.
 * Uses ANSI dim escape codes for visual parity with thinking blocks.
 * Strips at `context` so the LLM never sees them.
 */

import type { ExtensionAPI, Message, UserMessage, AssistantMessage } from "@earendil-works/pi-coding-agent";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
// Build regex from constants to avoid control chars in regex literal
const TIMESTAMP_SUFFIX_REGEX = new RegExp(` ${DIM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z${RESET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

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

function getTimestamp(msg: UserMessage | AssistantMessage): number {
	return msg.timestamp ?? Date.now();
}

export default function (pi: ExtensionAPI) {
	pi.on("message_end", async (event, _ctx) => {
		const msg = event.message;

		if (msg.role !== "user" && msg.role !== "assistant") {
			return;
		}

		const ts = getTimestamp(msg as UserMessage | AssistantMessage);
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