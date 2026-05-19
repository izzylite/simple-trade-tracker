/**
 * EyebrowRow — accent-dot + label + right-side caption.
 *
 * Used above sub-grids to title a section without taking visual space.
 * Example: "● Losing trades                       High impact correlation"
 *          ● Winning trades                       High impact correlation"
 *
 * Renders as flex space-between. The dot is optional — omit to get a
 * plain left-aligned eyebrow with optional right caption.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { EYEBROW_SX } from 'styles/designTokens';

export interface EyebrowRowProps {
  /** Accent color for the 6px leading dot — omit for a plain eyebrow */
  accent?: string;
  /** Primary label (usually 1-2 words) */
  label: React.ReactNode;
  /** Optional right-aligned caption (a description, count, or status) */
  rightLabel?: React.ReactNode;
}

const EyebrowRow: React.FC<EyebrowRowProps> = ({ accent, label, rightLabel }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {accent && (
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: accent }} />
      )}
      <Typography sx={{ ...EYEBROW_SX, color: 'text.primary' }}>{label}</Typography>
    </Box>
    {rightLabel !== undefined && (
      <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary' }}>{rightLabel}</Typography>
    )}
  </Box>
);

export default EyebrowRow;
