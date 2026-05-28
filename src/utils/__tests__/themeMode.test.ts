import { isDarkMode } from 'utils/themeMode';
import type { Theme } from '@mui/material/styles';

const themeWithMode = (mode: 'dark' | 'light') =>
  ({ palette: { mode } } as Theme);

describe('isDarkMode', () => {
  it('returns true when the palette mode is dark', () => {
    expect(isDarkMode(themeWithMode('dark'))).toBe(true);
  });

  it('returns false when the palette mode is light', () => {
    expect(isDarkMode(themeWithMode('light'))).toBe(false);
  });
});
