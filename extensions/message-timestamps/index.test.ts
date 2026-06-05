/**
 * message-timestamps tests
 */

import { describe, expect, it } from 'bun:test';

import {
  appendTimestamp,
  DIM,
  fmtUtc,
  RESET,
  stripTimestamp,
  TIMESTAMP_SUFFIX_REGEX,
} from './index';

describe('message-timestamps', () => {
  it('formats UTC timestamp without milliseconds', () => {
    const ts = new Date('2026-06-05T21:44:02.123Z').getTime();
    expect(fmtUtc(ts)).toBe('2026-06-05T21:44:02Z');
  });

  it('appends timestamp to string content', () => {
    const content = 'hello world';
    const result = appendTimestamp(content, '2026-06-05T21:44:02Z');
    expect(result).toBe(`hello world  ${DIM}2026-06-05T21:44:02Z${RESET}`);
  });

  it('appends timestamp to array content', () => {
    const content = [{ type: 'text', text: 'hello' }];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const result = appendTimestamp(content as any, '2026-06-05T21:44:02Z');
    expect(result).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: `  ${DIM}2026-06-05T21:44:02Z${RESET}` },
    ]);
  });

  it('strips timestamp from string content', () => {
    const content = `hello world  ${DIM}2026-06-05T21:44:02Z${RESET}`;
    const result = stripTimestamp(content);
    expect(result).toBe('hello world ');
  });

  it('strips timestamp from array content', () => {
    const content = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: `  ${DIM}2026-06-05T21:44:02Z${RESET}` },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const typedContent = content as any;
    const result = stripTimestamp(typedContent);
    expect(result).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('regex matches dim-styled ISO timestamp at end', () => {
    expect(TIMESTAMP_SUFFIX_REGEX.test(`hello  ${DIM}2026-06-05T21:44:02Z${RESET}`)).toBe(true);
    expect(TIMESTAMP_SUFFIX_REGEX.test(`hello  ${DIM}2026-06-05T21:44:02Z${RESET} extra`)).toBe(
      false,
    );
  });
});
