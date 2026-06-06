/**
 * message-timestamps
 *
 * Appends a dim-styled UTC ISO timestamp to every assistant message.
 * Uses ANSI dim escape codes for visual parity with thinking blocks.
 * Strips at `context` so the LLM never sees them.
 */

import type { AssistantMessage, Message as PiAiMessage, TextContent } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
// Build regex from constants to avoid control chars in regex literal
const TIMESTAMP_SUFFIX_REGEX = new RegExp(
  ` ${DIM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z${RESET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
);

export function fmtUtc(ts: number): string {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// biome-ignore lint/suspicious/noExplicitAny: content type varies by role
export function appendTimestamp(content: PiAiMessage['content'], suffix: string): any {
  const styled = `${DIM}${suffix}${RESET}`;
  if (typeof content === 'string') {
    return `${content}  ${styled}`;
  }
  return [...content, { type: 'text', text: `  ${styled}` }];
}

// biome-ignore lint/suspicious/noExplicitAny: content type varies by role
export function stripTimestamp(content: PiAiMessage['content']): any {
  if (typeof content === 'string') {
    return content.replace(TIMESTAMP_SUFFIX_REGEX, '');
  }
  const arr = content as TextContent[];
  if (arr.length > 0 && arr[arr.length - 1].type === 'text') {
    const text = arr[arr.length - 1].text;
    if (TIMESTAMP_SUFFIX_REGEX.test(text)) {
      return arr.slice(0, -1) as PiAiMessage['content'];
    }
  }
  return content;
}

function getTimestamp(msg: AssistantMessage): number {
  return msg.timestamp ?? Date.now();
}

// biome-ignore lint/suspicious/noExplicitAny: pi event types are opaque
type MessageEndEvent = { message: any };

export { DIM, RESET, TIMESTAMP_SUFFIX_REGEX };

export default function (pi: ExtensionAPI) {
  // biome-ignore lint/suspicious/noExplicitAny: pi event types are opaque
  pi.on('message_end' as any, async (event: MessageEndEvent, _ctx: any) => {
    const msg = event.message;

    // Only add timestamps to assistant messages
    if (msg.role !== 'assistant') {
      return;
    }

    const ts = getTimestamp(msg as AssistantMessage);
    const suffix = fmtUtc(ts);

    return {
      message: {
        ...msg,
        // biome-ignore lint/suspicious/noExplicitAny: msg content is opaque
        content: appendTimestamp((msg as any).content, suffix),
      },
    };
  });

  // biome-ignore lint/suspicious/noExplicitAny: pi event types are opaque
  pi.on('context' as any, async (event: { messages: any[] }, _ctx: any) => {
    const cleanMessages = event.messages.map((m) => {
      // Only strip timestamps from assistant messages that have content
      if (m.role === 'assistant' && m.content != null) {
        return {
          ...m,
          // biome-ignore lint/suspicious/noExplicitAny: message content is opaque
          content: stripTimestamp((m as any).content),
        };
      }
      return m;
    });
    return { messages: cleanMessages };
  });
}
