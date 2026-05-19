/**
 * CompareBar — thin progress / proportion bar.
 *
 * The canonical 4px bar used everywhere we want a visual proportion: target
 * progress, average-loss / average-win comparison, pattern proportion in the
 * top-combinations list, win/loss split mini-strips.
 *
 * Track is `alpha(color, 0.12)`; fill is the solid accent color. Width
 * transitions on 240ms ease-out-quart (DESIGN.md confidence curve).
 *
 * Two input modes:
 *   <CompareBar value={48} pct />              // already a 0-100 percent
 *   <CompareBar value={1247} max={3000} />    // ratio mode (abs/max)
 */

import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

export interface CompareBarProps {
  /** When `pct` is true: a 0-100 percent. Otherwise: a raw value divided by `max`. */
  value: number;
  /** Denominator for ratio mode. Ignored when `pct` is true. */
  max?: number;
  /** Treat `value` as an already-computed percent (0-100). Default: false */
  pct?: boolean;
  /** Solid fill color (also seeds the track at 12% alpha) */
  color: string;
  /** Bar height in px. Default: 4 */
  height?: number;
  /** Optional sx override on the track */
  sx?: any;
}

const CompareBar: React.FC<CompareBarProps> = ({
  value,
  max = 100,
  pct = false,
  color,
  height = 4,
  sx,
}) => {
  const theme = useTheme();
  const percent = pct
    ? Math.min(100, Math.max(0, value))
    : Math.min(100, Math.max(0, (Math.abs(value) / Math.max(max, 1)) * 100));
  return (
    <Box
      sx={{
        width: '100%',
        height,
        borderRadius: height / 2,
        bgcolor: alpha(color, 0.12),
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        sx={{
          width: `${percent}%`,
          height: '100%',
          bgcolor: color,
          transition: `width 240ms ${theme.palette.custom.easing.smooth}`,
        }}
      />
    </Box>
  );
};

export default CompareBar;
