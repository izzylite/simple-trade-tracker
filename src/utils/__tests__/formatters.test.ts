import {
  formatCount,
  formatValue,
  formatCurrency,
  formatPercentage,
  formatDate,
} from 'utils/formatters';

describe('formatCount', () => {
  it.each([undefined, null, NaN])('returns "0" for %p', value => {
    expect(formatCount(value as never)).toBe('0');
  });

  it('renders the value with locale separators', () => {
    // Compare against the platform locale rather than hard-coding "1,000",
    // so the test is not sensitive to the runner locale.
    expect(formatCount(1234567)).toBe((1234567).toLocaleString());
  });

  it('handles zero', () => {
    expect(formatCount(0)).toBe('0');
  });
});

describe('formatValue', () => {
  it.each([undefined, null, NaN])('returns "$0.00" for %p', value => {
    expect(formatValue(value as never)).toBe('$0.00');
  });

  it('formats sub-thousand amounts with two decimals', () => {
    expect(formatValue(999.5)).toBe('$999.50');
    expect(formatValue(0)).toBe('$0.00');
  });

  it('abbreviates thousands with a "k" suffix at one decimal', () => {
    expect(formatValue(1500)).toBe('$1.5k');
    expect(formatValue(1000)).toBe('$1.0k');
  });

  it('abbreviates negative thousands by magnitude', () => {
    expect(formatValue(-2500)).toBe('$-2.5k');
  });
});

describe('formatCurrency', () => {
  it.each([undefined, null, NaN])('returns "$0.00" for %p', value => {
    expect(formatCurrency(value as never)).toBe('$0.00');
  });

  it('always shows two fraction digits', () => {
    expect(formatCurrency(1234.5)).toBe(
      `$${(1234.5).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  });
});

describe('formatPercentage', () => {
  it.each([undefined, null, NaN])('returns "0.0%" for %p', value => {
    expect(formatPercentage(value as never)).toBe('0.0%');
  });

  it('defaults to one decimal place', () => {
    expect(formatPercentage(12.345)).toBe('12.3%');
  });

  it('honours a custom decimal count', () => {
    expect(formatPercentage(50, 0)).toBe('50%');
    expect(formatPercentage(33.3333, 2)).toBe('33.33%');
  });
});

describe('formatDate', () => {
  // Use a fixed local date; assert structural properties rather than exact
  // strings to stay locale-stable.
  const date = new Date(2026, 4, 27); // 2026-05-27 local

  it('omits the year in short format', () => {
    expect(formatDate(date, 'short')).not.toContain('2026');
  });

  it('includes the year in medium and long formats', () => {
    expect(formatDate(date, 'medium')).toContain('2026');
    expect(formatDate(date, 'long')).toContain('2026');
  });

  it('defaults to medium format', () => {
    expect(formatDate(date)).toBe(formatDate(date, 'medium'));
  });
});
