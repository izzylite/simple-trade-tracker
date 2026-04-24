/**
 * Chat mention helpers — shared between AIChatMentionInput (Draft.js editor)
 * and AIChatInterface (submit flow).
 */

export type MentionKind = 'slash' | 'at';

export interface MentionTrigger {
  kind: MentionKind;
  term: string;
  start: number;
}

/**
 * Scan a text block for an active mention trigger at the given cursor offset.
 * A trigger is valid when the char is `/` or `@`, sits at position 0 or is
 * preceded by whitespace, and the term (trigger+1 .. offset) contains only
 * allowed mention chars. Returns the most recent valid trigger, or null.
 */
export function detectMentionTrigger(
  text: string,
  offset: number
): MentionTrigger | null {
  const prefix = text.slice(0, offset);
  const slashAt = prefix.lastIndexOf('/');
  const atAt = prefix.lastIndexOf('@');
  const pos = Math.max(slashAt, atAt);
  if (pos === -1) return null;

  if (pos > 0 && /[^\s]/.test(prefix[pos - 1])) return null;

  const term = prefix.slice(pos + 1);
  if (/[^A-Za-z0-9:_.-]/.test(term)) return null;

  const kind: MentionKind = prefix[pos] === '/' ? 'slash' : 'at';
  return { kind, term, start: pos };
}
