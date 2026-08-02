/**
 * message-timestamps
 *
 * Appends a compact local timestamp and elapsed prompt time to every assistant message.
 * Uses ANSI dim escape codes for visual parity with thinking blocks.
 * Strips at `context` so the LLM never sees them.
 */

import type { AssistantMessage, Message as PiAiMessage, TextContent } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
// Build regex from constants to avoid control chars in regex literal
const TIMESTAMP_SUFFIX_REGEX = new RegExp(
  ` {2}${DIM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\d{2}:\\d{2} \\d{2}\\.\\d{2}\\.\\d{4}|\\d{2}\\.\\d{2}\\.\\d{4} \\d{2}:\\d{2}|\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:Z|[+-]\\d{2}:\\d{2}))(?: \\((?:\\d+ч \\d{2}м|\\d+м)\\))?${RESET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
);

export function formatLocalTimestamp(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// Keep the upstream helper export compatible.
export function fmtUtc(ts: number): string {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function formatElapsed(elapsedMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}ч ${String(minutes).padStart(2, '0')}м` : `${minutes}м`;
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
  let lastUserTimestamp: number | undefined;

  // biome-ignore lint/suspicious/noExplicitAny: pi event context is opaque
  pi.on('session_start', async (_event: unknown, ctx: any) => {
    lastUserTimestamp = undefined;
    for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
      if (entry.type === 'message' && entry.message.role === 'user') {
        lastUserTimestamp = entry.message.timestamp;
        break;
      }
    }
  });

  // biome-ignore lint/suspicious/noExplicitAny: pi event types are opaque
  pi.on('message_end' as any, async (event: MessageEndEvent, _ctx: any) => {
    const msg = event.message;

    if (msg.role === 'user') {
      lastUserTimestamp = msg.timestamp ?? Date.now();
      return;
    }
    if (msg.role !== 'assistant') {
      return;
    }

    const ts = getTimestamp(msg as AssistantMessage);
    const elapsed =
      lastUserTimestamp === undefined ? undefined : formatElapsed(ts - lastUserTimestamp);
    const suffix = `${formatLocalTimestamp(ts)}${elapsed === undefined ? '' : ` (${elapsed})`}`;

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
      if (m.content == null) {
        return m;
      }
      return {
        ...m,
        // biome-ignore lint/suspicious/noExplicitAny: message content is opaque
        content: stripTimestamp((m as any).content),
      };
    });
    return { messages: cleanMessages };
  });
}
