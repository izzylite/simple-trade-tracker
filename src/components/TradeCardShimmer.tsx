import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';
import Shimmer from './Shimmer';

interface TradeCardShimmerProps {
  /** Number of shimmer cards to display */
  count?: number;
  /** Custom styling for the container */
  containerSx?: object;
}

/**
 * Reusable shimmer loading component for trade cards.
 * Displays skeleton cards that match the TradeCard component layout.
 */
const TradeCardShimmer: React.FC<TradeCardShimmerProps> = ({
  count = 3,
  containerSx = {}
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...containerSx }}>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}
        >
          {/* Header - Name and Amount */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Shimmer height={20} width="40%" borderRadius={4} variant="wave" intensity="medium" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Shimmer height={16} width={16} borderRadius="50%" variant="wave" intensity="medium" />
              <Shimmer height={20} width={80} borderRadius={4} variant="wave" intensity="medium" />
            </Box>
          </Box>

          {/* Info Icons Row */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
            <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
            <Shimmer height={12} width={80} borderRadius={4} variant="wave" intensity="low" />
            <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
            <Shimmer height={12} width={60} borderRadius={4} variant="wave" intensity="low" />
          </Box>

          {/* Tags Row */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Shimmer height={20} width={80} borderRadius={10} variant="wave" intensity="medium" />
            <Shimmer height={20} width={60} borderRadius={10} variant="wave" intensity="medium" />
            <Shimmer height={20} width={70} borderRadius={10} variant="wave" intensity="medium" />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default TradeCardShimmer;
