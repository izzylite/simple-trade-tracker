/**
 * Chat mention helpers — shared between AIChatMentionInput (Draft.js editor)
 * and AIChatInterface (submit flow).
 */

import { EditorState } from 'draft-js';
import { SLASH_COMMAND_TAG } from '../types/note';

// =============================================================================
// Referenced-block format — single source of truth.
//
// The chat client wraps each note mention in a `[Referenced …:\n<body>\n]`
// block. The label distinguishes a SlashCommand (executable) from a regular
// note (supporting context).
//
// Two consumers parse these blocks:
//   1. stripReferencedBlocks (this file) — used to clean a previously-sent
//      message before re-populating the editor on Edit.
//   2. frameBareSlashCommand (supabase/functions/ai-trading-agent/index.ts)
//      — used to detect bare slash-command messages and prepend an execute
//      directive before sending to Gemini.
//
// The Deno edge function CANNOT import from src/, so the regex literal is
// duplicated there. If you change BLOCK_OPEN, BLOCK_CLOSE, BLOCK_LABEL_*
// or BLOCK_SEPARATOR, you MUST update the matching regex in
// supabase/functions/ai-trading-agent/index.ts (frameBareSlashCommand)
// and the Mixed/Bare examples in
// supabase/functions/ai-trading-agent/systemPrompt.ts.
// =============================================================================
export const BLOCK_OPEN_PREFIX = '[Referenced ';
export const BLOCK_OPEN_SUFFIX = ':\n';
export const BLOCK_CLOSE = '\n]';
export const BLOCK_LABEL_COMMAND = 'command';
export const BLOCK_LABEL_NOTE = 'note';
export const BLOCK_SEPARATOR = '\n\n';

const buildBlock = (label: string, body: string) =>
  `${BLOCK_OPEN_PREFIX}${label}${BLOCK_OPEN_SUFFIX}${body}${BLOCK_CLOSE}`;

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
 *
 * Spaces are allowed inside the term so users can filter multi-word slash
 * commands like "/Daily Review". The popup closes on a newline, on any
 * other disallowed char, or on Escape — and the autocomplete's
 * `title.includes(term)` matcher is what consumes the spaces. To avoid the
 * popup hanging open on stale "/" residue, the term itself is capped at 40
 * chars; past that it's almost certainly not a real mention.
 */
const MENTION_TERM_RE = /^[A-Za-z0-9:_.\- ]{0,40}$/;

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
  if (!MENTION_TERM_RE.test(term)) return null;
  // A term of pure trailing spaces means the user typed " " after a stale
  // trigger char — don't keep the popup open in that case.
  if (term.length > 0 && term.trim() === '') return null;

  const kind: MentionKind = prefix[pos] === '/' ? 'slash' : 'at';
  return { kind, term, start: pos };
}

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'note-mention'; noteId: string; noteTitle: string };

export interface NoteForExpansion {
  title: string;
  content: string;
  tags: string[];
}

/**
 * Uniform format for outgoing note mentions:
 *  1. Each note mention renders as its title inline (where the chip was).
 *  2. For every mention, a context block is appended:
 *       [Referenced command:\n<content>\n]   when SlashCommand
 *       [Referenced note:\n<content>\n]      otherwise
 *     Titles are intentionally omitted from the block — the transcript shows
 *     a chip UI with the title, and stripping it from the payload prevents
 *     the LLM from quoting the command's name in its reply.
 *  3. Unknown noteIds render as their title with no context block.
 *
 * "Bare slash-command" emission: when the user has typed nothing else and
 * every mention is a SlashCommand, we drop the inline titles and emit
 * blocks-only joined by BLOCK_SEPARATOR. The edge function recognises this
 * shape and prepends an execute directive. Mixed shapes (any user text, or
 * any non-SlashCommand mention) keep the inline titles + trailing blocks
 * form, which the system prompt teaches Orion to interpret as supporting
 * context.
 */
// Soft cap on note content injected into a single message. Huge slash
// commands (templates, JSON dumps) can blow Gemini's context window — at
// this size we truncate and append a marker so the LLM knows.
const MAX_REFERENCED_NOTE_CHARS = 8000;

export function expandMentionsForSend(
  segments: MessageSegment[],
  notesById: Map<string, NoteForExpansion>
): string {
  const mentions = segments.filter(
    (s): s is Extract<MessageSegment, { type: 'note-mention' }> =>
      s.type === 'note-mention'
  );
  const hasUserText = segments.some(
    s => s.type === 'text' && s.value.trim() !== ''
  );

  type ExpandedBlock = { label: string; body: string };
  const expanded: ExpandedBlock[] = [];
  for (const seg of mentions) {
    const note = notesById.get(seg.noteId);
    if (!note) continue;
    const label = note.tags.includes(SLASH_COMMAND_TAG)
      ? BLOCK_LABEL_COMMAND
      : BLOCK_LABEL_NOTE;
    const body = note.content.length > MAX_REFERENCED_NOTE_CHARS
      ? note.content.slice(0, MAX_REFERENCED_NOTE_CHARS) +
        `\n…[truncated: ${note.content.length - MAX_REFERENCED_NOTE_CHARS} more chars]`
      : note.content;
    expanded.push({ label, body });
  }

  const contextBlocks = expanded.map(b => buildBlock(b.label, b.body));

  // Bare = no user-typed text AND every resolved mention is a SlashCommand.
  // Emit blocks-only so frameBareSlashCommand() in the edge function can
  // apply the execute directive. Note: if the user references a deleted
  // note alongside live ones the deleted one is dropped from `expanded`;
  // we still treat the rest as bare. AIChatInterface blocks send when any
  // referenced note is missing, so this branch normally only sees a
  // consistent set.
  const isBare =
    !hasUserText &&
    expanded.length > 0 &&
    expanded.every(b => b.label === BLOCK_LABEL_COMMAND);
  if (isBare) {
    return contextBlocks.join(BLOCK_SEPARATOR);
  }

  const inline = segments
    .map(s => (s.type === 'text' ? s.value : s.noteTitle))
    .join('');

  if (contextBlocks.length === 0) return inline;
  return `${inline}${BLOCK_SEPARATOR}${contextBlocks.join(BLOCK_SEPARATOR)}`;
}

/**
 * Remove `[Referenced command:\n...\n]` / `[Referenced note:\n...\n]` blocks
 * (and the blank line separating them from preceding text) from a string.
 *
 * Used when populating the chat editor from a previously-sent message for
 * edit. The persisted message has the blocks expanded for the LLM, but
 * dropping them back into the input would expose the raw syntax to the
 * user. After stripping, what remains is the typed-text portion plus any
 * inline note titles — the user can re-trigger a slash command via "/" if
 * they want to restore one.
 *
 * The closing `\n]` is anchored with a lookahead requiring end-of-string or
 * the start of the next block separator, so a note whose content contains
 * `\n]` mid-body doesn't terminate the strip prematurely. The regex is
 * derived from the BLOCK_* constants above so producer/stripper stay in
 * sync (the Deno duplicate in frameBareSlashCommand still has to be kept
 * aligned manually).
 */
const STRIP_BLOCK_REGEX = (() => {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = escape(BLOCK_OPEN_PREFIX) +
    `(?:${escape(BLOCK_LABEL_COMMAND)}|${escape(BLOCK_LABEL_NOTE)})` +
    escape(BLOCK_OPEN_SUFFIX);
  const close = escape(BLOCK_CLOSE);
  const sepLookahead = escape(BLOCK_SEPARATOR) + escape(BLOCK_OPEN_PREFIX);
  return new RegExp(
    `\\n*${open}[\\s\\S]*?${close}(?=${sepLookahead}|\\s*$)`,
    'g'
  );
})();

export function stripReferencedBlocks(text: string): string {
  return text
    .replace(STRIP_BLOCK_REGEX, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Walk the editor's ContentState and produce flat segments.
 * NOTE_MENTION entities become `note-mention` segments; TAG_MENTION entities
 * and plain text become `text` segments (tags are already the tag string in
 * the block's text, so they fall through as text naturally).
 * Blocks are joined with '\n'.
 */
export function extractSegments(editorState: EditorState): MessageSegment[] {
  const content = editorState.getCurrentContent();
  const blocks = content.getBlocksAsArray();
  const segs: MessageSegment[] = [];

  const pushText = (value: string) => {
    if (!value) return;
    const last = segs[segs.length - 1];
    if (last && last.type === 'text') {
      last.value += value;
    } else {
      segs.push({ type: 'text', value });
    }
  };

  blocks.forEach((block, blockIdx) => {
    if (blockIdx > 0) pushText('\n');
    const text = block.getText();
    let i = 0;
    while (i < text.length) {
      const entityKey = block.getEntityAt(i);
      if (!entityKey) {
        pushText(text[i]);
        i += 1;
        continue;
      }
      let j = i;
      while (j < text.length && block.getEntityAt(j) === entityKey) j += 1;
      const entity = content.getEntity(entityKey);
      if (entity.getType() === 'NOTE_MENTION') {
        const data = entity.getData() as { noteTitle: string; noteId: string };
        segs.push({ type: 'note-mention', noteId: data.noteId, noteTitle: data.noteTitle });
      } else {
        pushText(text.slice(i, j));
      }
      i = j;
    }
  });

  return segs;
}
