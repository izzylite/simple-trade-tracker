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
