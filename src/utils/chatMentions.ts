/**
 * Chat mention helpers — shared between AIChatMentionInput (Draft.js editor)
 * and AIChatInterface (submit flow).
 */

import { EditorState } from 'draft-js';
import { SLASH_COMMAND_TAG } from '../types/note';

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

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'note-mention'; noteId: string; noteTitle: string };

export interface NoteForExpansion {
  title: string;
  content: string;
  tags: string[];
}

/**
 * Rules (see spec §Client-side mention expansion):
 * 1. If the message consists solely of a single slash-command note mention
 *    (ignoring surrounding whitespace), replace the whole message with the
 *    note's content.
 * 2. Otherwise, render each note mention as its title inline; append one
 *    context block per mention at the end:
 *      [Referenced command: <content>]  when SlashCommand
 *      [Referenced note: <content>]     otherwise
 *    Titles are omitted from the block on purpose — the transcript shows a
 *    chip UI with the title, and stripping it from the payload prevents the
 *    LLM from referencing the command by name in its reply.
 * 3. Unknown noteIds render as their title with no context block.
 */
export function expandMentionsForSend(
  segments: MessageSegment[],
  notesById: Map<string, NoteForExpansion>
): string {
  const nonWhitespace = segments.filter(s =>
    s.type === 'note-mention' || (s.type === 'text' && s.value.trim() !== '')
  );

  if (nonWhitespace.length === 1 && nonWhitespace[0].type === 'note-mention') {
    const note = notesById.get(nonWhitespace[0].noteId);
    if (note && note.tags.includes(SLASH_COMMAND_TAG)) {
      return note.content;
    }
  }

  const inline = segments
    .map(s => (s.type === 'text' ? s.value : s.noteTitle))
    .join('');

  const contextBlocks: string[] = [];
  for (const seg of segments) {
    if (seg.type !== 'note-mention') continue;
    const note = notesById.get(seg.noteId);
    if (!note) continue;
    const label = note.tags.includes(SLASH_COMMAND_TAG)
      ? 'Referenced command'
      : 'Referenced note';
    contextBlocks.push(`[${label}:\n${note.content}\n]`);
  }

  if (contextBlocks.length === 0) return inline;
  return `${inline}\n\n${contextBlocks.join('\n\n')}`;
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
