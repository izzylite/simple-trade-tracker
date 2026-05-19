/**
 * InfoStrip — hairline-bordered tinted info / callout strip.
 *
 * Replaces every loud MUI `<Alert severity=…>` and every ad-hoc
 * `<Box sx={{ bgcolor: alpha(color, 0.1), border: alpha(color, 0.2) }}>`
 * banner across the app.
 *
 * Tone variants:
 * - 'violet' (default) — neutral info, uses the canonical tintViolet.soft + 15%
 * - 'success' / 'error' / 'warning' — semantic tones at 10% bg / 20% border
 *
 * Always pairs background tint with hairline border at the accent color
 * (rather than colored fills with no border, which read as too loud).
 */

import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

export type InfoStripTone = 'violet' | 'success' | 'error' | 'warning';

export interface InfoStripProps {
  /** Tone — controls accent color, background tint, and border opacity */
  tone?: InfoStripTone;
  /** Optional override for the leading icon (defaults to InfoOutlined) */
  icon?: React.ReactNode;
  /** Body content — usually a `body2` paragraph or a Typography */
  children: React.ReactNode;
  /** Optional sx override on the outer wrapper */
  sx?: any;
}

const InfoStrip: React.FC<InfoStripProps> = ({
  tone = 'violet',
  icon,
  children,
  sx,
}) => {
  const theme = useTheme();
  const radius = theme.palette.custom.radius.md;
  const accent =
    tone === 'success'
      ? theme.palette.success.main
      : tone === 'error'
        ? theme.palette.error.main
        : tone === 'warning'
          ? theme.palette.warning.main
          : theme.palette.primary.main;
  const bg =
    tone === 'violet'
      ? theme.palette.custom.tintViolet.soft
      : alpha(accent, 0.1);
  const border =
    tone === 'violet'
      ? alpha(theme.palette.primary.main, 0.15)
      : alpha(accent, 0.2);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        p: 1.5,
        borderRadius: `${radius}px`,
        bgcolor: bg,
        border: `1px solid ${border}`,
        ...sx,
      }}
    >
      <Box sx={{ color: accent, mt: '2px', display: 'flex', flexShrink: 0 }}>
        {icon ?? <InfoOutlined sx={{ fontSize: 16 }} />}
      </Box>
      {typeof children === 'string' ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
          {children}
        </Typography>
      ) : (
        children
      )}
    </Box>
  );
};

export default InfoStrip;
