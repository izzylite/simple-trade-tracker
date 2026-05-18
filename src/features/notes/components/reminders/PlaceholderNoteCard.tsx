/**
 * PlaceholderNoteCard Component
 * Empty placeholder card for visual stacking effect when only 1 note exists
 */

import React from 'react';
import { Box, alpha, useTheme, keyframes } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface PlaceholderNoteCardProps {
  index: number;
  totalCards: number;
  isHovered: boolean;
  hasAnimated: boolean;
}

// Entry animation - slide up with opacity and scale
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

const PlaceholderNoteCard: React.FC<PlaceholderNoteCardProps> = ({
  index,
  totalCards,
  isHovered,
  hasAnimated,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Use a neutral grey color for placeholder cards
  const baseColor = theme.palette.grey[isDark ? 700 : 400];

  // Calculate transform based on state
  const stackedTransform = `translateY(${index * 6}px) translateX(${index * 3}px)`;
  const fannedTransform = `rotate(${(index - Math.floor(totalCards / 2)) * 12}deg) translateX(${index * 35}px) translateY(-${index * 5}px)`;

  // Z-index: reversed so first card appears on top when stacked
  const zIndex = totalCards - index;
  // Calculate staggered animation delay - placeholders appear slightly before the main card
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
          backgroundColor: alpha(baseColor, isDark ? 0.3 : 0.2),
          boxShadow: isDark
            ? `0 4px 12px ${alpha(theme.palette.common.black, 0.3)}`
            : `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
          border: `2px  ${alpha(isDark ? theme.palette.common.white : theme.palette.common.black, 0.3)}`,
          transform: isHovered ? fannedTransform : stackedTransform,
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex,
          cursor: 'pointer',
          // Center the plus icon
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Initial state and entry fade/blur animation
          opacity: hasAnimated ? 1 : 0,
          filter: hasAnimated ? 'blur(0px)' : 'blur(4px)',
          ...(hasAnimated && {
            animation: `${slideInAnimation} 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${animationDelay} both`,
          }),
        }}
      >
        {/* <AddIcon
          sx={{
            fontSize: 24,
            color: alpha(isDark ? theme.palette.common.white : theme.palette.common.black, 0.4),
          }}
        /> */}
      </Box>
    </Box>
  );
};

export default PlaceholderNoteCard;
