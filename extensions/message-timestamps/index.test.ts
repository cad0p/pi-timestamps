/**
 * message-timestamps tests
 */

import { describe, expect, it } from 'bun:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import messageTimestamps, {
  appendTimestamp,
  DIM,
  fmtUtc,
  formatElapsed,
  formatLocalTimestamp,
  RESET,
  stripTimestamp,
  TIMESTAMP_SUFFIX_REGEX,
} from './index';

type Handler = (event: unknown, ctx?: unknown) => Promise<unknown>;
type MessageEndResult = { message: { content: Array<{ type: string; text: string }> } };
type ContextResult = { messages: Array<{ role: string; content: unknown }> };

function createHandlers() {
  const handlers = new Map<string, Handler>();
  messageTimestamps({
    on(event: string, handler: Handler) {
      handlers.set(event, handler);
    },
  } as unknown as ExtensionAPI);
  return handlers;
}

describe('message-timestamps', () => {
  it('formats a compact timestamp in the local timezone', () => {
    const ts = new Date(2026, 5, 5, 21, 44, 2, 123).getTime();
    expect(formatLocalTimestamp(ts)).toBe('21:44 05.06.2026');
  });

  it('keeps the upstream UTC formatter compatible', () => {
    const ts = new Date('2026-06-05T21:44:02.123Z').getTime();
    expect(fmtUtc(ts)).toBe('2026-06-05T21:44:02Z');
  });

  it('formats elapsed minutes and hours', () => {
    expect(formatElapsed(59_999)).toBe('0м');
    expect(formatElapsed(180_000)).toBe('3м');
    expect(formatElapsed(7_560_000)).toBe('2ч 06м');
  });

  it('appends timestamp to string content', () => {
    const content = 'hello world';
    const result = appendTimestamp(content, '21:44 05.06.2026 (3м)');
    expect(result).toBe(`hello world  ${DIM}21:44 05.06.2026 (3м)${RESET}`);
  });

  it('appends timestamp to array content', () => {
    const content = [{ type: 'text', text: 'hello' }];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const result = appendTimestamp(content as any, '21:44 05.06.2026 (3м)');
    expect(result).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: `  ${DIM}21:44 05.06.2026 (3м)${RESET}` },
    ]);
  });

  it('strips timestamp from string content', () => {
    const content = `hello world  ${DIM}21:44 05.06.2026 (3м)${RESET}`;
    expect(stripTimestamp(content)).toBe('hello world');
  });

  it('strips timestamp from array content', () => {
    const content = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: `  ${DIM}21:44 05.06.2026 (3м)${RESET}` },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    expect(stripTimestamp(content as any)).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('strips timestamps written by earlier releases and local patches', () => {
    expect(stripTimestamp(`hello  ${DIM}2026-06-05T21:44:02Z${RESET}`)).toBe('hello');
    expect(stripTimestamp(`hello  ${DIM}2026-06-05T21:44:02+03:00${RESET}`)).toBe('hello');
    expect(stripTimestamp(`hello  ${DIM}05.06.2026 21:44${RESET}`)).toBe('hello');
  });

  it('only matches a timestamp suffix', () => {
    expect(TIMESTAMP_SUFFIX_REGEX.test(`hello  ${DIM}21:44 05.06.2026 (3м)${RESET}`)).toBe(true);
    expect(TIMESTAMP_SUFFIX_REGEX.test(`hello  ${DIM}21:44 05.06.2026 (3м)${RESET} extra`)).toBe(
      false,
    );
  });

  it('strips generated timestamps from assistant and legacy user context', async () => {
    const handlers = createHandlers();
    const result = (await handlers.get('context')?.({
      messages: [
        { role: 'user', content: `prompt  ${DIM}2026-06-05T21:44:02Z${RESET}` },
        { role: 'assistant', content: `answer  ${DIM}21:44 05.06.2026 (3м)${RESET}` },
        { role: 'toolResult', content: null },
      ],
    })) as ContextResult;

    expect(result.messages).toEqual([
      { role: 'user', content: 'prompt' },
      { role: 'assistant', content: 'answer' },
      { role: 'toolResult', content: null },
    ]);
  });

  it('adds elapsed time from the latest user message', async () => {
    const handlers = createHandlers();
    await handlers.get('session_start')?.(
      {},
      {
        sessionManager: {
          getBranch: () => [
            { type: 'message', message: { role: 'user', content: 'prompt', timestamp: 1_000 } },
          ],
        },
      },
    );

    const result = (await handlers.get('message_end')?.({
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'answer' }],
        timestamp: 181_000,
      },
    })) as MessageEndResult;

    expect(result.message.content.at(-1)?.text).toEndWith(`(3м)${RESET}`);
  });

  it('tracks a new user message in the current session', async () => {
    const handlers = createHandlers();
    await handlers.get('session_start')?.({}, { sessionManager: { getBranch: () => [] } });
    await handlers.get('message_end')?.({
      message: { role: 'user', content: 'prompt', timestamp: 60_000 },
    });

    const result = (await handlers.get('message_end')?.({
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'answer' }],
        timestamp: 7_620_000,
      },
    })) as MessageEndResult;

    expect(result.message.content.at(-1)?.text).toEndWith(`(2ч 06м)${RESET}`);
  });
});
