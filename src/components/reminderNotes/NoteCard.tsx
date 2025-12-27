/**
 * NoteCard Component
 * Displays a compact note card for the stacked widget
 * Supports stacked and fanned animation states
 */

import React from 'react';
import { Box, Typography, alpha, useTheme, Theme, keyframes } from '@mui/material';
import {
  pink,
  purple,
  deepPurple,
  indigo,
  lightBlue,
  cyan,
  teal,
  lightGreen,
  lime,
  yellow,
  amber,
  deepOrange,
  brown,
  grey,
  blueGrey,
} from '@mui/material/colors';
import { Note } from '../../types/note';

interface NoteCardProps {
  note: Note;
  index: number;
  totalCards: number;
  isHovered: boolean;
  hasAnimated: boolean;
}

// Entry animation - slide up with opacity and scale (doesn't affect positioning transform)
const slideInAnimation = keyframes`
  0% {
    opacity: 0;
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    filter: blur(0px);
  }
`;

// Separate animation for the slide-up effect on the wrapper
const slideUpAnimation = keyframes`
  0% {
    transform: translateY(40px);
  }
  60% {
    transform: translateY(-4px);
  }
  80% {
    transform: translateY(2px);
  }
  100% {
    transform: translateY(0);
  }
`;

// Color mapping - reused from CalendarDayReminder
const getColorMap = (theme: Theme): Record<string, string> => ({
  'red': theme.palette.error.main,
  'pink': pink[500],
  'purple': purple[500],
  'deepPurple': deepPurple[500],
  'indigo': indigo[500],
  'blue': theme.palette.info.main,
  'lightBlue': lightBlue[500],
  'cyan': cyan[500],
  'teal': teal[500],
  'green': theme.palette.success.main,
  'lightGreen': lightGreen[500],
  'lime': lime[500],
  'yellow': yellow[600],
  'amber': amber[500],
  'orange': theme.palette.warning.main,
  'deepOrange': deepOrange[500],
  'brown': brown[500],
  'grey': grey[500],
  'blueGrey': blueGrey[500],
});

const NoteCard: React.FC<NoteCardProps> = ({ note, index, totalCards, isHovered, hasAnimated }) => {
  const theme = useTheme();
  const colorMap = getColorMap(theme);
  const isDark = theme.palette.mode === 'dark';

  // Use note color for full background, default to a neutral dark color
  const baseColor = note.color ? colorMap[note.color] || theme.palette.grey[700] : theme.palette.grey[700];

  // Calculate transform based on state
  // Stacked: each card offset slightly down and right
  // Fanned: cards spread out with rotation
  const stackedTransform = `translateY(${index * 6}px) translateX(${index * 3}px)`;
  const fannedTransform = `rotate(${(index - Math.floor(totalCards / 2)) * 12}deg) translateX(${index * 35}px) translateY(-${index * 5}px)`;

  // Z-index: reversed so first card appears on top when stacked
  const zIndex = totalCards - index;

  // Calculate staggered animation delay - cards appear one after another
  const animationDelay = `${index * 0.1}s`;

  return (
    <Box
      sx={{
        position: 'absolute',
        // Initial state and entry slide-up animation wrapper
        ...(hasAnimated && {
          animation: `${slideUpAnimation} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${animationDelay} both`,
        }),
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 90,
          borderRadius: 1.5,
          overflow: 'hidden',
          backgroundColor: alpha(baseColor, isDark ? 0.85 : 0.9),
          boxShadow: isDark
            ? `0 4px 12px ${alpha(theme.palette.common.black, 0.4)}`
            : `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
          transform: isHovered ? fannedTransform : stackedTransform,
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex,
          cursor: 'pointer',
          // Initial state and entry fade/blur animation
          opacity: hasAnimated ? 1 : 0,
          filter: hasAnimated ? 'blur(0px)' : 'blur(4px)',
          ...(hasAnimated && {
            animation: `${slideInAnimation} 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${animationDelay} both`,
          }),
          '&:hover': {
            boxShadow: isDark
              ? `0 6px 16px ${alpha(theme.palette.common.black, 0.5)}`
              : `0 6px 16px ${alpha(theme.palette.common.black, 0.2)}`,
          },
        }}
      >
      {/* Card content */}
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Title */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: theme.palette.common.white,
            fontSize: '0.65rem',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {note.title || 'Untitled'}
        </Typography>

        {/* Small indicator for multiple notes - only on first card */}
        {totalCards > 1 && index === 0 && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem',
              color: alpha(theme.palette.common.white, 0.8),
              mt: 'auto',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            +{totalCards - 1} more
          </Typography>
        )}
      </Box>
      </Box>
    </Box>
  );
};

export default NoteCard;
