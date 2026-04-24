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
    expect(detectMentionTrigger('/foo bar', 8)).toBeNull();
    expect(detectMentionTrigger('/foo!', 5)).toBeNull();
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

  it('expands a lone slash-command mention to the note content', () => {
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' }
    ];
    expect(expandMentionsForSend(segs, notesMap))
      .toBe("Summarize yesterday's trades and flag rule violations.");
  });

  it('ignores surrounding whitespace when deciding "lone" mention', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: '  ' },
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
      { type: 'text', value: ' ' },
    ];
    expect(expandMentionsForSend(segs, notesMap))
      .toBe("Summarize yesterday's trades and flag rule violations.");
  });

  it('wraps slash-command mention as a context block when user text is present', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: 'help me with ' },
      { type: 'note-mention', noteId: 'n1', noteTitle: 'Daily Review' },
    ];
    const out = expandMentionsForSend(segs, notesMap);
    expect(out).toContain('help me with Daily Review');
    expect(out).toContain('[Referenced command "Daily Review":');
    expect(out).toContain("Summarize yesterday's trades");
  });

  it('wraps a non-slash-command note as a "Referenced note" context block', () => {
    const segs: MessageSegment[] = [
      { type: 'text', value: 'what do you think about ' },
      { type: 'note-mention', noteId: 'n2', noteTitle: 'Strategy' },
    ];
    const out = expandMentionsForSend(segs, notesMap);
    expect(out).toContain('what do you think about Strategy');
    expect(out).toContain('[Referenced note "Strategy":');
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
    expect(out).toContain('[Referenced command "Daily Review":');
    expect(out).toContain('[Referenced note "Strategy":');
  });

  it('renders unknown noteId as its title with no expansion', () => {
    const segs: MessageSegment[] = [
      { type: 'note-mention', noteId: 'missing', noteTitle: 'Ghost' },
    ];
    expect(expandMentionsForSend(segs, notesMap)).toBe('Ghost');
  });
});
