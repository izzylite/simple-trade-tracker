/**
 * StatTile — canonical inset stat tile.
 *
 * Eyebrow label (with optional leading icon) + tnum value + optional
 * subtitle + optional footer slot. Background is the 3%-tinted inset
 * surface, hairline border, 10px radius — the same look used by
 * MonthlyStats, KpiStrip, and every summary tile in an analysis card.
 *
 * No hover effects (per "no hover on inset data tiles" rule).
 */

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { EYEBROW_SX, TNUM, MONO_FONT, getInsetTileSx } from 'styles/designTokens';

export interface StatTileProps {
  /** Optional leading icon shown next to the eyebrow label */
  icon?: React.ReactNode;
  /** Eyebrow label (uppercase) — describes the metric */
  label: string;
  /** The value — string, number, or composite node (e.g. with a trailing chip) */
  value: React.ReactNode;
  /** Override the value color (defaults to `text.primary`) */
  valueColor?: string;
  /** Optional subtitle under the value (tnum, text.tertiary, 0.7rem) */
  subtitle?: React.ReactNode;
  /** Optional footer slot under subtitle (target progress, mini-bars, etc.) */
  footer?: React.ReactNode;
  /**
   * Numeric size: 'sm' = 1rem, 'md' = 1.5rem (default), 'lg' = 1.75rem.
   * Use 'sm' for dense grids; 'lg' for hero-style KPI strips.
   */
  size?: 'sm' | 'md' | 'lg';
}

const VALUE_SIZES: Record<NonNullable<StatTileProps['size']>, string> = {
  sm: '1rem',
  md: '1.5rem',
  lg: '1.75rem',
};

const StatTile: React.FC<StatTileProps> = ({
  icon,
  label,
  value,
  valueColor,
  subtitle,
  footer,
  size = 'md',
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        ...getInsetTileSx(theme),
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        {icon}
        <Typography sx={EYEBROW_SX}>{label}</Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: MONO_FONT,
          fontSize: VALUE_SIZES[size],
          fontWeight: 700,
          color: valueColor ?? 'text.primary',
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
          display: 'flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          rowGap: 0.25,
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
      {subtitle && (
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontSize: '0.7rem',
            color: 'text.tertiary',
            fontWeight: 500,
            fontFeatureSettings: TNUM,
          }}
        >
          {subtitle}
        </Typography>
      )}
      {footer && <Box sx={{ mt: 0.5 }}>{footer}</Box>}
    </Box>
  );
};

export default StatTile;
