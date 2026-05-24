import React from 'react';
import { Box, useTheme } from '@mui/material';
import { keyframes } from '@emotion/react';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Orion's animated face — a violet ring + iris that takes on one of four
 * expressions:
 *
 *   - resting : static. The default. Per-message avatars stay here so the
 *               scrollback doesn't twitch.
 *   - looking : continuous saccade scan. While the agent loop runs.
 *   - focus   : one-shot dilate / constrict / settle (~2.4s). Fires the
 *               moment a user sends — "I heard you".
 *   - snap    : one-shot blink → smile flash → snap back (~5.4s). Fires on
 *               first mount and when the assistant message lands.
 *
 * One-shots are driven by parent state — the caller flips `state` back to
 * `resting` after the duration completes (see `useOrionExpression`).
 *
 * Color resolves from `currentColor` so callers can theme the mark by
 * setting `color` on a wrapper. Defaults to `theme.palette.primary.main`
 * (brand violet).
 */
export type OrionState =
  | 'resting'
  | 'idle'
  | 'looking'
  | 'focus'
  | 'snap'
  | 'alert'
  | 'wink'
  | 'searching'
  | 'sleep';

interface OrionMarkProps {
  size?: number | string;
  state?: OrionState;
  /**
   * Bumped by the parent on every one-shot trigger. Used as the React `key`
   * so the animation restarts even when `state` repeats (e.g. two sends in
   * a row both fire `focus`).
   */
  runId?: number;
  color?: string;
  /** Color of the highlight dot inside the pupil. */
  catchColor?: string;
  sx?: SxProps<Theme>;
  title?: string;
}

// ─────────────────────── keyframes lifted from orion-icon-design.html ──
const blinkLook = keyframes`
  0%, 26%, 30%, 50%, 54%, 72%, 76%, 94%, 100% { transform: scaleY(1); }
  28%, 52%, 74%, 96% { transform: scaleY(0.05); }
`;
const look = keyframes`
  0%, 6%    { transform: translate(0, 0); }
  10%, 22%  { transform: translate(7px, 0); }
  26%, 30%  { transform: translate(0, 0); }
  34%, 46%  { transform: translate(-7px, 0); }
  50%, 54%  { transform: translate(0, 0); }
  58%, 68%  { transform: translate(0, -6px); }
  72%, 76%  { transform: translate(0, 0); }
  80%, 90%  { transform: translate(0, 6px); }
  94%, 100% { transform: translate(0, 0); }
`;

const focusPupil = keyframes`
  0%, 20%   { transform: scale(1); }
  35%, 42%  { transform: scale(1.5); }
  55%, 62%  { transform: scale(0.55); }
  78%, 100% { transform: scale(1); }
`;

const snapBlink = keyframes`
  0%, 16%, 26%, 100% { transform: scaleY(1); }
  19%, 23%           { transform: scaleY(0.05); }
`;
const snapRingTop = keyframes`
  0%, 30%   { opacity: 1; transform: scale(1); }
  36%, 68%  { opacity: 0; transform: scale(0.9); }
  76%, 100% { opacity: 1; transform: scale(1); }
`;
const snapRingBot = keyframes`
  0%, 30%   { transform: translateY(0); }
  36%, 68%  { transform: translateY(-5px); }
  76%, 100% { transform: translateY(0); }
`;
const snapPupil = keyframes`
  0%, 30%   { transform: scale(1); opacity: 1; }
  36%, 68%  { transform: scale(0); opacity: 0; }
  76%, 100% { transform: scale(1); opacity: 1; }
`;

const alertRing = keyframes`
  0%, 8%    { stroke-width: 4; opacity: 1; }
  12%, 18%  { stroke-width: 6; opacity: 1; }
  22%, 28%  { stroke-width: 4; opacity: 1; }
  32%, 38%  { stroke-width: 6; opacity: 1; }
  42%, 100% { stroke-width: 4; opacity: 1; }
`;
const alertBlink = keyframes`
  0%, 6%, 16%, 26%, 36%, 100% { transform: scaleY(1); }
  10%, 20%, 30%               { transform: scaleY(0.05); }
`;

// Idle: a single quick blink at the tail of a 5s loop. Just enough motion
// to read as "alive" without becoming visual noise. No pupil movement.
const idleBlink = keyframes`
  0%, 92%, 100% { transform: scaleY(1); }
  95%, 97%      { transform: scaleY(0.05); }
`;

// Wink: one fast blink + a quick smile flash. Lighter than Snap — used for
// micro-acknowledgments like tab switches.
const winkBlink = keyframes`
  0%, 10%, 22%, 100% { transform: scaleY(1); }
  14%, 18%           { transform: scaleY(0.05); }
`;
const winkRingTop = keyframes`
  0%, 24%   { opacity: 1; transform: scale(1); }
  30%, 48%  { opacity: 0; transform: scale(0.9); }
  56%, 100% { opacity: 1; transform: scale(1); }
`;
const winkRingBot = keyframes`
  0%, 24%   { transform: translateY(0); }
  30%, 48%  { transform: translateY(-5px); }
  56%, 100% { transform: translateY(0); }
`;
const winkPupil = keyframes`
  0%, 24%   { transform: scale(1); opacity: 1; }
  30%, 48%  { transform: scale(0); opacity: 0; }
  56%, 100% { transform: scale(1); opacity: 1; }
`;

// Searching: pupil traces a figure-8 in a continuous loop. "Let me check" —
// fired when the agent loop is on a search-class tool call.
const searching = keyframes`
  0%   { transform: translate(0, 0); }
  12%  { transform: translate(6px, -4px); }
  25%  { transform: translate(0, 0); }
  37%  { transform: translate(-6px, 4px); }
  50%  { transform: translate(0, 0); }
  62%  { transform: translate(-6px, -4px); }
  75%  { transform: translate(0, 0); }
  87%  { transform: translate(6px, 4px); }
  100% { transform: translate(0, 0); }
`;


// transform-box: fill-box keeps each animated <g>'s origin at its own
// center rather than the SVG root. Required for scale + translate to read
// correctly. Reduced-motion users get the resting geometry with no motion.
const stateSx: Record<OrionState, SxProps<Theme>> = {
  resting: {},
  idle: {
    '& .eye-blink': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      animation: `${idleBlink} 5s ease-in-out infinite`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .eye-blink': { animation: 'none' },
    },
  },
  looking: {
    '& .eye-blink, & .eye-grp': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
    },
    '& .eye-blink': {
      animation: `${blinkLook} 5.4s ease-in-out infinite`,
    },
    '& .eye-grp': {
      animation: `${look} 5.4s cubic-bezier(.4, 0, .2, 1) infinite`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .eye-blink, & .eye-grp': { animation: 'none' },
    },
  },
  focus: {
    '& .eye-grp': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      animation: `${focusPupil} 2.4s cubic-bezier(.5, 0, .3, 1) 1 both`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .eye-grp': { animation: 'none' },
    },
  },
  snap: {
    '& .ring-top, & .ring-bot, & .eye-blink, & .eye-grp': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
    },
    '& .eye-blink': {
      animation: `${snapBlink} 5.4s ease-in-out 1 both`,
    },
    '& .ring-top': {
      animation: `${snapRingTop} 5.4s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '& .ring-bot': {
      animation: `${snapRingBot} 5.4s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '& .eye-grp': {
      animation: `${snapPupil} 5.4s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .ring-top, & .ring-bot, & .eye-blink, & .eye-grp': {
        animation: 'none',
      },
    },
  },
  alert: {
    '& .ring-top, & .ring-bot, & .eye-blink': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
    },
    '& .ring-top, & .ring-bot': {
      animation: `${alertRing} 3s ease-in-out infinite`,
    },
    '& .eye-blink': {
      animation: `${alertBlink} 3s ease-in-out infinite`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .ring-top, & .ring-bot, & .eye-blink': { animation: 'none' },
    },
  },
  wink: {
    '& .ring-top, & .ring-bot, & .eye-blink, & .eye-grp': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
    },
    '& .eye-blink': {
      animation: `${winkBlink} 3.6s ease-in-out 1 both`,
    },
    '& .ring-top': {
      animation: `${winkRingTop} 3.6s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '& .ring-bot': {
      animation: `${winkRingBot} 3.6s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '& .eye-grp': {
      animation: `${winkPupil} 3.6s cubic-bezier(.3, 0, .7, 1) 1 both`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .ring-top, & .ring-bot, & .eye-blink, & .eye-grp': {
        animation: 'none',
      },
    },
  },
  searching: {
    '& .eye-grp': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      animation: `${searching} 3.6s ease-in-out infinite`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .eye-grp': { animation: 'none' },
    },
  },
  sleep: {
    // Dim ring + closed eye. Reads as "paused/away" without any extra
    // ornament. (An earlier version drifted Zs above the eye but they
    // couldn't read clearly at avatar sizes.)
    '& .ring-top, & .ring-bot': { opacity: 0.4 },
    '& .eye-blink': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      transform: 'scaleY(0.06)',
    },
  },
};

const OrionMark: React.FC<OrionMarkProps> = ({
  size = 24,
  state = 'resting',
  runId = 0,
  color,
  catchColor = '#ffffff',
  sx,
  title = 'Orion',
}) => {
  const theme = useTheme();
  const resolvedColor = color ?? theme.palette.primary.main;
  // Stroke width scales with viewBox; the original 4 against a 64-unit box
  // reads as a confident 2px+ at common avatar sizes (20–36).
  return (
    <Box
      // Array form is required so `stateSx[state]` (a SxProps union) and
      // the caller's `sx` merge without collapsing into invalid types.
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: resolvedColor,
          flexShrink: 0,
          lineHeight: 0,
        },
        stateSx[state],
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <svg
        // key forces a remount on every runId bump so one-shot animations
        // restart even when state hasn't changed.
        key={runId}
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={title}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path
          className="ring ring-top"
          d="M8 32 A24 24 0 0 1 56 32"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
        />
        <path
          className="ring ring-bot"
          d="M8 32 A24 24 0 0 0 56 32"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <g className="eye-blink">
          <g className="eye-grp">
            <circle className="pupil" cx={32} cy={32} r={8} fill="currentColor" />
            <circle className="catch" cx={28.5} cy={28.5} r={2} fill={catchColor} />
          </g>
        </g>
      </svg>
    </Box>
  );
};

export default OrionMark;
