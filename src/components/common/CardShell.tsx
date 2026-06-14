/**
 * CardShell — the canonical outer-card shell with optional header band.
 *
 * Replaces the older `features/performance/components/PerfCard.tsx`, which
 * is now a thin re-export so existing imports keep working.
 *
 * Visual contract:
 * - paper background, hairline divider border, no shadow at rest
 * - optional `head` slot with violet-tinted icon pill, title, optional
 *   eyebrow subtitle, optional sub caption (right of title), and optional
 *   right slot for controls (toggles, action buttons)
 *
 * Used by every top-level analysis card in the app.
 */

import React from 'react';
import { Box, BoxProps, Typography, useTheme } from '@mui/material';
import { EYEBROW_SX, TNUM, getCardShellSx, getShadow } from 'styles/designTokens';

export interface CardHeadProps {
  /** Optional icon node — rendered inside a 28×28 violet-tinted pill */
  icon?: React.ReactNode;
  /** Title node — usually a string, rendered at 1rem / 600 / -0.015em */
  title: React.ReactNode;
  /**
   * Optional eyebrow rendered below the title. Use for subtitles like
   * "By trading session" or "All currencies · High impact".
   */
  eyebrow?: React.ReactNode;
  /**
   * Optional caption rendered to the immediate right of title (compact,
   * tnum-locked text.tertiary). Mirrors the old `PerfCardHead.sub` slot
   * so existing PerfCard call sites continue to work.
   */
  sub?: React.ReactNode;
  /** Optional right slot — controls, action buttons, toggle groups */
  right?: React.ReactNode;
}

const HeaderBand: React.FC<CardHeadProps> = ({ icon, title, eyebrow, sub, right }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexWrap: 'wrap',
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: `${theme.palette.custom.radius.md}px`,
            bgcolor: theme.palette.custom.tintViolet.strong,
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '1rem',
            letterSpacing: '-0.015em',
            color: 'text.primary',
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
        {eyebrow !== undefined && (
          <Typography sx={{ ...EYEBROW_SX, mt: 0.25, color: 'text.tertiary' }}>
            {eyebrow}
          </Typography>
        )}
      </Box>
      {sub !== undefined && (
        <Box
          sx={{
            fontSize: '0.75rem',
            color: 'text.tertiary',
            fontFeatureSettings: TNUM,
          }}
        >
          {sub}
        </Box>
      )}
      {right}
    </Box>
  );
};

export interface CardShellProps extends BoxProps {
  head?: CardHeadProps;
  /** Outer radius — defaults to 'xl' (16px) for top-level cards */
  radius?: 'lg' | 'xl';
  /**
   * Resting elevation tier. Defaults to `'none'` (flat — the divider carries
   * the edge). Top-level cards opt into `'md'`; the single primary/focus card
   * per view uses `'lg'`. Nested cards (inside a dialog/panel) must stay `'none'`.
   * See the elevation role→tier map in `styles/designTokens`.
   */
  elevation?: 'none' | 'md' | 'lg';
  /** Optional sx applied to the inner body wrapper (after the head band) */
  innerSx?: BoxProps['sx'];
}

const CardShell: React.FC<CardShellProps> = ({
  head,
  radius = 'xl',
  elevation = 'none',
  children,
  innerSx,
  sx,
  ...rest
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        ...getCardShellSx(theme, radius),
        ...(elevation !== 'none' && { boxShadow: getShadow(theme, elevation) }),
        color: 'text.primary',
        ...sx,
      }}
      {...rest}
    >
      {head && <HeaderBand {...head} />}
      {innerSx ? <Box sx={innerSx}>{children}</Box> : children}
    </Box>
  );
};

export default CardShell;
