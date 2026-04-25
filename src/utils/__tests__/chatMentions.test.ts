import { detectMentionTrigger } from '../chatMentions';

describe('detectMentionTrigger', () => {
  it('returns null when text has no trigger char', () => {
    expect(detectMentionTrigger('hello world', 11)).toBeNull();
  });

  it('detects slash at start of line', () => {
    expect(detectMentionTrigger('/dail', 5)).toEqual({
      kind: 'slash', term: 'dail', start: 0
    });
  });

  it('detects slash after whitespace', () => {
    expect(detectMentionTrigger('hello /dail', 11)).toEqual({
      kind: 'slash', term: 'dail', start: 6
    });
  });

  it('detects at-sign at start of line', () => {
    expect(detectMentionTrigger('@stra', 5)).toEqual({
      kind: 'at', term: 'stra', start: 0
    });
  });

  it('detects at-sign after whitespace', () => {
    expect(detectMentionTrigger('note @stra', 10)).toEqual({
      kind: 'at', term: 'stra', start: 5
    });
  });

  it('returns null when trigger has non-whitespace before it', () => {
    expect(detectMentionTrigger('a/foo', 5)).toBeNull();
    expect(detectMentionTrigger('a@foo', 5)).toBeNull();
  });

  it('returns null when term contains invalid chars', () => {
    expect(detectMentionTrigger('/foo!', 5)).toBeNull();
    expect(detectMentionTrigger('/foo?', 5)).toBeNull();
  });

  it('allows spaces inside term to filter multi-word slash commands', () => {
    expect(detectMentionTrigger('/Daily Review', 13)).toEqual({
      kind: 'slash', term: 'Daily Review', start: 0,
    });
    expect(detectMentionTrigger('/Daily ', 7)).toEqual({
      kind: 'slash', term: 'Daily ', start: 0,
    });
  });

  it('closes the popup on pure-trailing-space (stale "/" residue)', () => {
    expect(detectMentionTrigger('/ ', 2)).toBeNull();
    expect(detectMentionTrigger('/   ', 4)).toBeNull();
  });

  it('closes the popup once the term is unreasonably long', () => {
    const longish = '/' + 'a'.repeat(50);
    expect(detectMentionTrigger(longish, longish.length)).toBeNull();
  });

  it('prefers the most recent trigger char', () => {
    expect(detectMentionTrigger('/cmd @tag', 9)).toEqual({
      kind: 'at', term: 'tag', start: 5
    });
  });

  it('allows empty term (just typed the trigger)', () => {
    expect(detectMentionTrigger('/', 1)).toEqual({
      kind: 'slash', term: '', start: 0
    });
    expect(detectMentionTrigger('@', 1)).toEqual({
      kind: 'at', term: '', start: 0
    });
  });
});

import { expandMentionsForSend, MessageSegment } from '../chatMentions';
import { SLASH_COMMAND_TAG } from '../../types/note';

const notesMap = new Map<string, { title: string; content: string; tags: string[] }>([
  ['n1', { title: 'Daily Review', content: "Summarize yesterday's trades and flag rule violations.", tags: [SLASH_COMMAND_TAG] }],
  ['n2', { title: 'Strategy', content: 'Wait for confirmation candle.', tags: ['STRATEGY'] }],
]);

describe('expandMentionsForSend', () => {
  it('returns raw text when there are no mentions', () => {
    const segs: MessageSegment[] = [{ type: 'text', value: 'hello world' }];
    expect(expandMentionsForSend(segs, notesMap)).toBe('hello world');
  });

  it('emits only the block (no inline title) for a lone slash-command mention', () => {
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' }
    ];
    expect(expandMentionsForSend(segs, notesMap))
      .toBe("[Referenced command:\nSummarize yesterday's trades and flag rule violations.\n]");
  });

  it('treats whitespace-only text segments as still "bare"', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: '  ' },
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
      { type: 'text', value: ' ' },
    ];
    expect(expandMentionsForSend(segs, notesMap))
      .toBe("[Referenced command:\nSummarize yesterday's trades and flag rule violations.\n]");
  });

  it('wraps slash-command mention as a context block when user text is present', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: 'help me with ' },
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
    ];
    const out = expandMentionsForSend(segs, notesMap);
    expect(out).toContain('help me with Daily Review');
    expect(out).toContain('[Referenced command:');
    expect(out).not.toContain('"Daily Review":');
    expect(out).toContain("Summarize yesterday's trades");
  });

  it('wraps a non-slash-command note as a "Referenced note" context block', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: 'what do you think about ' },
      { type: 'note-mention', noteId: 'n2', noteTitle: 'Strategy' },
    ];
    const out = expandMentionsForSend(segs, notesMap);
    expect(out).toContain('what do you think about Strategy');
    expect(out).toContain('[Referenced note:');
    expect(out).not.toContain('"Strategy":');
    expect(out).toContain('Wait for confirmation candle.');
  });

  it('handles multiple mentions — only bare slash-command alone triggers execute semantics', () => {
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
      { type: 'text', value: ' and ' },
      { type: 'note-mention', noteId: 'n2', noteTitle: 'Strategy' },
    ];
    const out = expandMentionsForSend(segs, notesMap);
    expect(out).toContain('Daily Review and Strategy');
    expect(out).toContain('[Referenced command:');
    expect(out).toContain('[Referenced note:');
  });

  it('renders unknown noteId as its title with no expansion', () => {
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'missing', noteTitle: 'Ghost' },
    ];
    expect(expandMentionsForSend(segs, notesMap)).toBe('Ghost');
  });
});

import { stripReferencedBlocks } from '../chatMentions';

describe('stripReferencedBlocks', () => {
  it('returns plain text unchanged', () => {
    expect(stripReferencedBlocks('hello world')).toBe('hello world');
  });

  it('strips a bare command block', () => {
    const input = '[Referenced command:\nList trades.\n]';
    expect(stripReferencedBlocks(input)).toBe('');
  });

  it('strips a trailing command block and preceding blank line', () => {
    const input = 'Today i want us to Quick Review\n\n[Referenced command:\nList my three most recent closed trades as cards.\n]';
    expect(stripReferencedBlocks(input)).toBe('Today i want us to Quick Review');
  });

  it('strips a referenced note block', () => {
    const input = 'what about this one\n\n[Referenced note:\nWait for confirmation candle.\n]';
    expect(stripReferencedBlocks(input)).toBe('what about this one');
  });

  it('strips multiple blocks in one message', () => {
    const input = 'compare both\n\n[Referenced command:\nA\n]\n\n[Referenced note:\nB\n]';
    expect(stripReferencedBlocks(input)).toBe('compare both');
  });

  it('does not terminate early on a `\\n]` inside note content', () => {
    // Content with a markdown-list-style line ending in `]` used to make
    // the strip stop at the first `\n]`, leaving an orphan tail.
    const input = '[Referenced command:\n[a]\n[b]\n]';
    expect(stripReferencedBlocks(input)).toBe('');
  });

  it('round-trips with the producer for a slash-command containing `\\n]`', () => {
    const note = { title: 'X', content: 'foo\n]bar', tags: [SLASH_COMMAND_TAG] };
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'rx', noteTitle: 'X' }
    ];
    const produced = expandMentionsForSend(
      segs,
      new Map([['rx', note]])
    );
    expect(stripReferencedBlocks(produced)).toBe('');
  });
});

describe('expandMentionsForSend (length cap)', () => {
  it('truncates very large note content with a marker', () => {
    const huge = 'x'.repeat(20000);
    const map = new Map([
      ['big', { title: 'Big', content: huge, tags: [SLASH_COMMAND_TAG] }],
    ]);
    const out = expandMentionsForSend(
      [{ type: 'note-mention', noteId: 'big', noteTitle: 'Big' }],
      map
    );
    expect(out.length).toBeLessThan(huge.length);
    expect(out).toMatch(/truncated: \d+ more chars/);
  });
});

import { ContentState, EditorState, Modifier, SelectionState } from 'draft-js';
import { extractSegments } from '../chatMentions';

function makeStateWithNoteMention(prefix: string, noteTitle: string, noteId: string, suffix: string) {
  let content = ContentState.createFromText(prefix);
  const block = content.getFirstBlock();
  const insertSel = SelectionState.createEmpty(block.getKey()).merge({
    anchorOffset: prefix.length,
    focusOffset: prefix.length,
  }) as SelectionState;

  content = Modifier.insertText(content, insertSel, noteTitle);
  content = content.createEntity('NOTE_MENTION', 'IMMUTABLE', { noteTitle, noteId });
  const entityKey = content.getLastCreatedEntityKey();
  const entitySel = SelectionState.createEmpty(block.getKey()).merge({
    anchorOffset: prefix.length,
    focusOffset: prefix.length + noteTitle.length,
  }) as SelectionState;
  content = Modifier.applyEntity(content, entitySel, entityKey);

  const tailSel = SelectionState.createEmpty(block.getKey()).merge({
    anchorOffset: prefix.length + noteTitle.length,
    focusOffset: prefix.length + noteTitle.length,
  }) as SelectionState;
  content = Modifier.insertText(content, tailSel, suffix);

  return EditorState.createWithContent(content);
}

describe('extractSegments', () => {
  it('returns a single text segment for plain text', () => {
    const state = EditorState.createWithContent(ContentState.createFromText('hello'));
    expect(extractSegments(state)).toEqual([{ type: 'text', value: 'hello' }]);
  });

  it('splits around a NOTE_MENTION entity', () => {
    const state = makeStateWithNoteMention('help me with ', 'Daily Review', 'n1', ' please');
    expect(extractSegments(state)).toEqual([
      { type: 'text', value: 'help me with ' },
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
      { type: 'text', value: ' please' },
    ]);
  });

  it('joins multi-line blocks with newlines as text', () => {
    const state = EditorState.createWithContent(ContentState.createFromText('line1\nline2'));
    expect(extractSegments(state)).toEqual([{ type: 'text', value: 'line1\nline2' }]);
  });
});
