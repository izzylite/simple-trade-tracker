/**
 * PnlValue — DESIGN.md PNL rule encoder.
 *
 * Renders a P&L number with the full encoding triple:
 *   color (success/error/neutral) + arrow glyph (↑/↓/—) + sign character (+/−)
 *
 * Per DESIGN.md "color is never the only encoding for win/loss". Every P&L
 * readout in the app should go through this component so the rule cannot be
 * forgotten in a one-off Typography.
 *
 * Pass a `format` function (typically `formatValue` or `formatCurrency` from
 * `utils/formatters`). The component handles sign / arrow / color from the
 * sign of `amount`; the formatter just shapes the magnitude.
 */

import React from 'react';
import { Box, useTheme } from '@mui/material';
import { TNUM, MONO_FONT } from 'styles/designTokens';

export interface PnlValueProps {
  /** Raw signed amount — sign determines tone, arrow, and prefix */
  amount: number;
  /**
   * Currency / number formatter. Called with `Math.abs(amount)`; this
   * component prefixes the sign character itself, so the formatter should
   * NOT add its own +/− (any leading + or − is stripped defensively).
   */
  format: (n: number) => string;
  /** Show the trailing-position arrow glyph (↑/↓/—). Default: true */
  arrow?: boolean;
  /** Force a color (overrides the success/error/neutral default) */
  color?: string;
  /** Numeric size — 'sm' (0.85rem) | 'md' (1rem, default) | 'lg' (1.5rem) */
  size?: 'sm' | 'md' | 'lg';
  /** Make the number not bold (e.g. inside a dense table cell) */
  bold?: boolean;
  /** Optional sx override on the wrapper */
  sx?: any;
}

const SIZE_PX: Record<NonNullable<PnlValueProps['size']>, string> = {
  sm: '0.85rem',
  md: '1rem',
  lg: '1.5rem',
};

const PnlValue: React.FC<PnlValueProps> = ({
  amount,
  format,
  arrow = true,
  color,
  size = 'md',
  bold = true,
  sx,
}) => {
  const theme = useTheme();
  const isWin = amount > 0;
  const isLoss = amount < 0;
  const accent =
    color ??
    (isWin
      ? theme.palette.success.main
      : isLoss
        ? theme.palette.error.main
        : theme.palette.text.secondary);
  const sign = isWin ? '+' : isLoss ? '−' : '';
  const dir = isWin ? '↑' : isLoss ? '↓' : '—';
  const magnitude = format(Math.abs(amount)).replace(/^[+-]/, '');
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.375,
        color: accent,
        fontFamily: MONO_FONT,
        fontWeight: bold ? 700 : 500,
        fontFeatureSettings: TNUM,
        letterSpacing: '-0.01em',
        fontSize: SIZE_PX[size],
        ...sx,
      }}
    >
      {arrow && (
        <Box component="span" sx={{ fontSize: '0.85em', lineHeight: 1 }}>
          {dir}
        </Box>
      )}
      <Box component="span">
        {sign}
        {magnitude}
      </Box>
    </Box>
  );
};

export default PnlValue;
