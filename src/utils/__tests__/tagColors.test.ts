import {
  isGroupedTag,
  getTagGroup,
  getTagName,
  formatTagWithCapitalizedGroup,
  formatTagsWithCapitalizedGroups,
  getTagColor,
  getTagChipStyles,
  filterTagsByGroup,
  getUniqueTagGroups,
  formatTagForDisplay,
} from 'utils/tagColors';
import { Theme } from '@mui/material';

describe('isGroupedTag', () => {
  it('detects a colon-delimited grouped tag', () => {
    expect(isGroupedTag('Strategy:Volume')).toBe(true);
    expect(isGroupedTag('breakout')).toBe(false);
  });
});

describe('getTagGroup', () => {
  it('returns the group prefix for grouped tags', () => {
    expect(getTagGroup('Strategy:Volume')).toBe('Strategy');
  });

  it('returns empty string for ungrouped tags', () => {
    expect(getTagGroup('breakout')).toBe('');
  });
});

describe('getTagName', () => {
  it('strips the group prefix', () => {
    expect(getTagName('Strategy:Volume')).toBe('Volume');
  });

  it('returns the whole tag when ungrouped', () => {
    expect(getTagName('breakout')).toBe('breakout');
  });
});

describe('formatTagWithCapitalizedGroup', () => {
  it('capitalizes the group name only', () => {
    expect(formatTagWithCapitalizedGroup('strategy:Volume')).toBe('Strategy:Volume');
  });

  it('trims whitespace around the parts', () => {
    expect(formatTagWithCapitalizedGroup('strategy : Volume ')).toBe('Strategy:Volume');
  });

  it('leaves ungrouped tags unchanged', () => {
    expect(formatTagWithCapitalizedGroup('breakout')).toBe('breakout');
  });

  it('passes through empty input', () => {
    expect(formatTagWithCapitalizedGroup('')).toBe('');
  });
});

describe('formatTagsWithCapitalizedGroups', () => {
  it('maps over an array', () => {
    expect(formatTagsWithCapitalizedGroups(['strategy:Volume', 'breakout'])).toEqual([
      'Strategy:Volume',
      'breakout',
    ]);
  });
});

describe('getTagColor', () => {
  it('is deterministic for the same tag', () => {
    expect(getTagColor('breakout')).toBe(getTagColor('breakout'));
  });

  it('returns a color from the predefined palette', () => {
    expect(getTagColor('breakout')).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('colors grouped tags by their group, not the full tag', () => {
    // Two tags in the same group share a color; the color tracks the group.
    expect(getTagColor('Strategy:Volume')).toBe(getTagColor('Strategy:Breakout'));
    expect(getTagColor('Strategy:Volume')).toBe(getTagColor('Strategy'));
  });
});

describe('getTagChipStyles', () => {
  it('returns chip styling derived from the tag color', () => {
    const styles = getTagChipStyles('breakout', {} as Theme);
    expect(styles).toMatchObject({ fontWeight: 500 });
    expect(typeof styles.backgroundColor).toBe('string');
  });
});

describe('filterTagsByGroup', () => {
  it('keeps only tags within the requested group', () => {
    const tags = ['Strategy:Volume', 'Strategy:Breakout', 'Session:London', 'plain'];
    expect(filterTagsByGroup(tags, 'Strategy')).toEqual([
      'Strategy:Volume',
      'Strategy:Breakout',
    ]);
  });
});

describe('getUniqueTagGroups', () => {
  it('returns the sorted unique set of groups', () => {
    const tags = ['Session:NY', 'Strategy:Volume', 'Strategy:Breakout', 'plain'];
    expect(getUniqueTagGroups(tags)).toEqual(['Session', 'Strategy']);
  });
});

describe('formatTagForDisplay', () => {
  it('returns the full tag by default', () => {
    expect(formatTagForDisplay('Strategy:Volume')).toBe('Strategy:Volume');
  });

  it('hides the group prefix when requested', () => {
    expect(formatTagForDisplay('Strategy:Volume', true)).toBe('Volume');
  });

  it('leaves ungrouped tags unchanged even when hiding groups', () => {
    expect(formatTagForDisplay('breakout', true)).toBe('breakout');
  });
});
