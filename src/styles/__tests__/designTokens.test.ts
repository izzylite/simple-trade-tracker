import {
  SHADOWS,
  getShadow,
  getHairline,
  getInsetSurface,
  getInsetHoverSurface,
} from 'styles/designTokens';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

const themeFor = (mode: 'dark' | 'light'): Theme =>
  ({
    palette: {
      mode,
      divider: '#cbd5e1',
      text: { primary: mode === 'dark' ? '#f1f5f9' : '#0f172a' },
    },
  } as Theme);

describe('getShadow', () => {
  it.each(['sm', 'md', 'lg', 'xl'] as const)(
    'returns the dark-mode %s shadow from SHADOWS.dark',
    size => {
      expect(getShadow(themeFor('dark'), size)).toBe(SHADOWS.dark[size]);
    },
  );

  it.each(['sm', 'md', 'lg', 'xl'] as const)(
    'returns the light-mode %s shadow from SHADOWS.light',
    size => {
      expect(getShadow(themeFor('light'), size)).toBe(SHADOWS.light[size]);
    },
  );
});

describe('getHairline', () => {
  it('returns the 8%-white hairline in dark mode', () => {
    expect(getHairline(themeFor('dark'))).toBe('rgba(255,255,255,0.08)');
  });

  it('returns theme.palette.divider in light mode', () => {
    expect(getHairline(themeFor('light'))).toBe('#cbd5e1');
  });
});

describe('getInsetSurface', () => {
  it('returns the 3%-white inset surface in dark mode', () => {
    expect(getInsetSurface(themeFor('dark'))).toBe('rgba(255,255,255,0.03)');
  });

  it('returns alpha(text.primary, 0.03) in light mode', () => {
    expect(getInsetSurface(themeFor('light'))).toBe(alpha('#0f172a', 0.03));
  });
});

describe('getInsetHoverSurface', () => {
  it('returns the 6%-white hover surface in dark mode', () => {
    expect(getInsetHoverSurface(themeFor('dark'))).toBe('rgba(255,255,255,0.06)');
  });

  it('returns alpha(text.primary, 0.05) in light mode', () => {
    expect(getInsetHoverSurface(themeFor('light'))).toBe(alpha('#0f172a', 0.05));
  });
});
