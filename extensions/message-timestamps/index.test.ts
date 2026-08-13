/**
 * message-timestamps tests
 */

import { beforeEach, describe, expect, it } from 'bun:test';

import type { TextContent } from '@earendil-works/pi-ai';
import type {
  CustomEntry,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

import extension, {
  _reset,
  CUSTOM_TYPE,
  DIM,
  fmtUtc,
  LEGACY_STAMP_REGEX,
  RESET,
  stripLegacyTimestamp,
} from './index';

interface AppendedEntry {
  customType: string;
  data?: unknown;
}

interface FakeSessionManager {
  getEntry(id: string): SessionEntry | undefined;
  getLeafEntry(): SessionEntry | undefined;
}

const makeSessionManager = (
  entries: Record<string, SessionEntry>,
  getLeaf: () => SessionEntry | undefined,
): FakeSessionManager => ({
  getEntry: (id: string) => entries[id],
  getLeafEntry: getLeaf,
});

const makeCtx = (sessionManager: FakeSessionManager): ExtensionContext =>
  ({ sessionManager }) as unknown as ExtensionContext;

/**
 * Fake ExtensionAPI: captures `on()` handlers into a map, records
 * `appendEntry` calls and captures the `registerEntryRenderer` renderer.
 * The captured `session_start` handler must be fired with a fake ctx so the
 * module-level sessionManager state is set (renderer + context depend on it).
 */
const createHandlers = () => {
  const handlers = new Map<string, unknown>();
  const appended: AppendedEntry[] = [];
  let renderer: unknown;

  const pi = {
    on(event: string, handler: unknown) {
      handlers.set(event, handler);
    },
    appendEntry(customType: string, data?: unknown) {
      appended.push({ customType, data });
    },
    registerEntryRenderer(_customType: string, entryRenderer: unknown) {
      renderer = entryRenderer;
    },
  } as unknown as ExtensionAPI;

  const fire = (event: string, payload: unknown, ctx: unknown): unknown => {
    const handler = handlers.get(event);
    if (!handler) {
      throw new Error(`no handler registered for '${event}'`);
    }
    return (handler as (event: unknown, ctx: unknown) => unknown)(payload, ctx);
  };

  const getRenderer = (): ((entry: CustomEntry) => unknown) =>
    renderer as (entry: CustomEntry) => unknown;

  return { pi, appended, fire, getRenderer };
};

type Handlers = ReturnType<typeof createHandlers>;

const userEntry = (id: string, content: string): SessionEntry =>
  ({
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-05T21:44:00.000Z',
    message: { role: 'user', content, timestamp: 1 },
  }) as unknown as SessionEntry;

const assistantEntry = (id: string): SessionEntry =>
  ({
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-05T21:44:00.000Z',
    message: { role: 'assistant', content: [], timestamp: 2 },
  }) as unknown as SessionEntry;

const toolResultEntry = (id: string): SessionEntry =>
  ({
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-05T21:44:00.000Z',
    message: { role: 'toolResult', content: [], timestamp: 3 },
  }) as unknown as SessionEntry;

const customEntry = (id: string, parentId: string | null): SessionEntry =>
  ({
    type: 'custom',
    customType: CUSTOM_TYPE,
    id,
    parentId,
    timestamp: '2026-06-05T21:44:00.000Z',
  }) as unknown as SessionEntry;

describe('message-timestamps', () => {
  describe('fmtUtc', () => {
    it('formats UTC timestamp without milliseconds', () => {
      const ts = new Date('2026-06-05T21:44:02.123Z').getTime();
      expect(fmtUtc(ts)).toBe('2026-06-05T21:44:02Z');
    });
  });

  describe('LEGACY_STAMP_REGEX', () => {
    it('matches dim-styled ISO timestamp at end', () => {
      expect(LEGACY_STAMP_REGEX.test(`hello  ${DIM}2026-06-05T21:44:02Z${RESET}`)).toBe(true);
      expect(LEGACY_STAMP_REGEX.test(`hello  ${DIM}2026-06-05T21:44:02.123Z${RESET}`)).toBe(true);
      expect(LEGACY_STAMP_REGEX.test(`hello  ${DIM}2026-06-05T21:44:02Z${RESET} extra`)).toBe(
        false,
      );
    });
  });

  describe('stripLegacyTimestamp', () => {
    it('strips stamp from string content and removes the trailing-space wart (#18)', () => {
      const content: string = `hello world  ${DIM}2026-06-05T21:44:02Z${RESET}`;
      expect(stripLegacyTimestamp(content)).toBe('hello world');
    });

    it('drops a last text block that is entirely a stamp', () => {
      const content: TextContent[] = [
        { type: 'text', text: 'hello' },
        { type: 'text', text: `  ${DIM}2026-06-05T21:44:02Z${RESET}` },
      ];
      expect(stripLegacyTimestamp(content)).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('trims a partial block whose dim-ISO suffix is not a stamp', () => {
      const content: TextContent[] = [
        { type: 'text', text: `as of ${DIM}2026-06-05T21:44:02Z${RESET}` },
      ];
      expect(stripLegacyTimestamp(content)).toEqual([{ type: 'text', text: 'as of' }]);
    });

    it('is a no-op on clean content (same reference for arrays)', () => {
      expect(stripLegacyTimestamp('plain text')).toBe('plain text');
      const content: TextContent[] = [{ type: 'text', text: 'clean' }];
      expect(stripLegacyTimestamp(content)).toBe(content);
    });
  });

  describe('handlers', () => {
    let h: Handlers;
    let entries: Record<string, SessionEntry>;
    let leaf: SessionEntry | undefined;
    let ctx: ExtensionContext;

    beforeEach(() => {
      _reset();
      h = createHandlers();
      extension(h.pi);
      entries = {};
      leaf = undefined;
      ctx = makeCtx(makeSessionManager(entries, () => leaf));
      h.fire('session_start', { type: 'session_start', reason: 'startup' }, ctx);
    });

    const fireContext = (messages: unknown[]): unknown =>
      h.fire('context', { type: 'context', messages }, ctx);

    const fireTurnEnd = (): unknown =>
      h.fire('turn_end', { type: 'turn_end', turnIndex: 0, message: {}, toolResults: [] }, ctx);

    const stamped = (prefix: string): string => `${prefix}  ${DIM}2026-06-05T21:44:02Z${RESET}`;

    it('appends a stamp only when the leaf entry is a user message', () => {
      leaf = userEntry('m1', 'hi');
      fireContext([]);
      expect(h.appended).toEqual([{ customType: CUSTOM_TYPE }]);
    });

    it('does not stamp when the leaf is an assistant message', () => {
      leaf = assistantEntry('m1');
      fireContext([]);
      expect(h.appended).toEqual([]);
    });

    it('does not double-stamp across multi-call turns', () => {
      // leaf = user message → stamp appended, marker becomes the new leaf
      leaf = userEntry('m1', 'hi');
      fireContext([]);
      // leaf = the marker entry (or a toolResult) → no stamp on later calls
      leaf = customEntry('c1', 'm1');
      fireContext([]);
      leaf = toolResultEntry('t1');
      fireContext([]);
      expect(h.appended).toEqual([{ customType: CUSTOM_TYPE }]);
    });

    it('does not throw when getLeafEntry() is undefined or a custom entry', () => {
      leaf = undefined;
      expect(() => fireContext([])).not.toThrow();
      leaf = customEntry('c1', 'm1');
      expect(() => fireContext([])).not.toThrow();
      expect(h.appended).toEqual([]);
    });

    it('appends a stamp on turn_end regardless of the leaf (incl. toolResult)', () => {
      leaf = toolResultEntry('t1');
      fireTurnEnd();
      fireTurnEnd();
      expect(h.appended).toEqual([{ customType: CUSTOM_TYPE }, { customType: CUSTOM_TYPE }]);
    });

    it('strips legacy stamps from BOTH user and assistant messages', () => {
      const result = fireContext([
        { role: 'user', content: stamped('hello world'), timestamp: 1 },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'text', text: stamped('') },
          ],
        },
      ]);
      const messages = (result as { messages: unknown[] }).messages;
      expect(messages[0]).toEqual({ role: 'user', content: 'hello world', timestamp: 1 });
      expect(messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    });

    it('returns undefined when no message changed (new sessions stay untouched)', () => {
      const result = fireContext([
        { role: 'user', content: 'clean', timestamp: 1 },
        { role: 'assistant', content: [{ type: 'text', text: 'clean' }] },
      ]);
      expect(result).toBeUndefined();
    });
  });

  describe('renderer', () => {
    let h: Handlers;
    let entries: Record<string, SessionEntry>;
    let leaf: SessionEntry | undefined;
    let ctx: ExtensionContext;

    beforeEach(() => {
      _reset();
      h = createHandlers();
      extension(h.pi);
      entries = {};
      leaf = undefined;
      ctx = makeCtx(makeSessionManager(entries, () => leaf));
      h.fire('session_start', { type: 'session_start', reason: 'startup' }, ctx);
    });

    const entry = (parentId: string | null): CustomEntry => ({
      type: 'custom',
      customType: CUSTOM_TYPE,
      id: 'c1',
      parentId,
      timestamp: '2026-06-05T21:44:03.000Z',
    });

    const render = (e: CustomEntry): unknown => h.getRenderer()(e);

    it('renders the parent message timestamp dimmed at paddingX=1, paddingY=0', () => {
      const ts = new Date('2026-06-05T21:44:02.123Z').getTime();
      entries.p1 = {
        type: 'message',
        id: 'p1',
        parentId: null,
        timestamp: '2026-06-05T21:44:00.000Z',
        message: { role: 'assistant', content: [], timestamp: ts },
      } as unknown as SessionEntry;

      const result = render(entry('p1'));
      expect(result).toBeInstanceOf(Text);
      const props = result as { text: string; paddingX: number; paddingY: number };
      expect(props.text).toBe(`${DIM}2026-06-05T21:44:02Z${RESET}`);
      expect(props.paddingX).toBe(1);
      expect(props.paddingY).toBe(0);
    });

    it('falls back to Date.parse(entry.timestamp) when the parent is unresolvable', () => {
      // Fallback = marker-append time, NOT authoritative — only reachable on
      // retry-replaced messages/rewind where the parent no longer exists.
      const result = render(entry('missing'));
      const props = result as { text: string };
      expect(props.text).toBe(`${DIM}2026-06-05T21:44:03Z${RESET}`);
    });

    it('hides (undefined) when the timestamp is unresolvable', () => {
      const e = { ...entry('missing'), timestamp: 'not-a-date' };
      expect(render(e)).toBeUndefined();
    });
  });
});
