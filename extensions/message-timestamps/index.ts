/**
 * message-timestamps
 *
 * Data-less custom session entries (customType 'pi-timestamps') rendered only
 * in the TUI via `registerEntryRenderer`. Message content is never touched, so
 * exports, copies, print and JSON modes stay clean.
 *
 * - `context`: appends a stamp after a persisted user message leaf; also strips
 *   legacy v0.1.4 inline stamps from a deep copy so the LLM never sees them.
 * - `turn_end`: appends a stamp after every assistant/tool turn.
 * - Renderer: reconstructs the timestamp from the parent message's
 *   `message.timestamp` via the session manager; falls back to the marker's
 *   own append time when the parent is unresolvable.
 */

import type { Message } from '@earendil-works/pi-ai';
import type {
  ContextEvent,
  EntryRenderer,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
  SessionStartEvent,
  TurnEndEvent,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

export const DIM = '\x1b[2m';
export const RESET = '\x1b[0m';

export const CUSTOM_TYPE = 'pi-timestamps';

/**
 * Structural subset of pi's `ReadonlySessionManager`, which is not part of the
 * public API surface. `ctx.sessionManager` satisfies this shape.
 */
interface ReadonlySessionManager {
  getEntry(id: string): SessionEntry | undefined;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches a legacy v0.1.4 inline dim-ISO stamp at the very end of a message. */
export const LEGACY_STAMP_REGEX = new RegExp(
  `\\s*${escapeRegex(DIM)}\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z${escapeRegex(RESET)}$`,
);

/**
 * Strips a legacy inline stamp from message content.
 * - string content: regex replace (kills the #18 trailing-space wart via `\s*`).
 * - array content: only the last text block is examined; when the block is
 *   entirely a stamp it is dropped, otherwise the dim-ISO suffix is trimmed
 *   from it (partial-block removal — never drop assistant text that merely
 *   ends with a matching pattern).
 */
export function stripLegacyTimestamp<T extends Message['content']>(content: T): T {
  if (typeof content === 'string') {
    return content.replace(LEGACY_STAMP_REGEX, '') as T;
  }
  if (content.length > 0) {
    const last = content[content.length - 1];
    if (last.type === 'text' && LEGACY_STAMP_REGEX.test(last.text)) {
      const rest = last.text.replace(LEGACY_STAMP_REGEX, '');
      if (rest.trim() === '') {
        return content.slice(0, -1) as T;
      }
      return [...content.slice(0, -1), { ...last, text: rest }] as T;
    }
  }
  return content;
}

export function fmtUtc(ts: number): string {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

let sessionManager: ReadonlySessionManager | undefined;

/** Test hook: clears module state captured from `session_start`. */
export function _reset(): void {
  sessionManager = undefined;
}

export default function (pi: ExtensionAPI) {
  pi.on('session_start', (_event: SessionStartEvent, ctx: ExtensionContext) => {
    sessionManager = ctx.sessionManager;
  });

  pi.on('context', (event: ContextEvent, ctx: ExtensionContext) => {
    const leaf = ctx.sessionManager.getLeafEntry();
    // Guard via the real entry type: custom entries (and undefined) never
    // carry `.message`, so this never throws and only matches user messages.
    if (leaf?.type === 'message' && leaf.message.role === 'user') {
      pi.appendEntry(CUSTOM_TYPE);
    }

    // Legacy strip for old v0.1.4 sessions (both user and assistant roles;
    // pre-#6 sessions carry inline stamps in user content). Works on copies —
    // the stored session is untouched; no-op for new sessions.
    let changed = false;
    const messages = event.messages.map((m) => {
      if ((m.role === 'user' || m.role === 'assistant') && m.content != null) {
        const content = stripLegacyTimestamp(m.content);
        if (content !== m.content) {
          changed = true;
          // `as typeof m`: the spread-override of the role union's content
          // widens the property type; the narrowed message type is preserved.
          return { ...m, content } as typeof m;
        }
      }
      return m;
    });
    return changed ? { messages } : undefined;
  });

  pi.on('turn_end', (_event: TurnEndEvent, _ctx: ExtensionContext) => {
    pi.appendEntry(CUSTOM_TYPE);
  });

  const renderer: EntryRenderer = (entry) => {
    const parent = entry.parentId ? sessionManager?.getEntry(entry.parentId) : undefined;
    // The parent message's timestamp is authoritative (user send time, tool
    // completion time, LLM completion time).
    let ts: number | undefined = parent?.type === 'message' ? parent.message.timestamp : undefined;
    // Fallback: the marker's own append time. Only reachable when the parent
    // is unresolvable (retry-replaced message, rewind).
    if (typeof ts !== 'number') {
      ts = Date.parse(entry.timestamp);
    }
    if (Number.isNaN(ts)) {
      return undefined; // hide
    }
    return new Text(`${DIM}${fmtUtc(ts)}${RESET}`, 1, 0);
  };
  pi.registerEntryRenderer(CUSTOM_TYPE, renderer);
}
