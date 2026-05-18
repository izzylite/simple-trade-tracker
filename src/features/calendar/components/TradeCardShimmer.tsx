import React from 'react';
import { Box, useTheme } from '@mui/material';
import Shimmer from 'components/Shimmer';

interface TradeCardShimmerProps {
  /** Number of shimmer cards to display */
  count?: number;
  /** Custom styling for the container */
  containerSx?: object;
}

/**
 * Skeleton placeholder mirroring the TradeCard layout:
 * title + PnL row, tag chips, hairline, meta footer.
 */
const TradeCardShimmer: React.FC<TradeCardShimmerProps> = ({
  count = 3,
  containerSx = {},
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
  const restingShadow = isDark
    ? '0 2px 8px rgba(0,0,0,0.30)'
    : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, ...containerSx }}>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${hairline}`,
            borderRadius: '12px',
            boxShadow: restingShadow,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 1.75, py: 1.25 }}>
            {/* Title + PnL */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 0.875,
              }}
            >
              <Shimmer height={12} width="55%" borderRadius={3} variant="wave" intensity="medium" />
              <Shimmer height={14} width={84} borderRadius={4} variant="wave" intensity="medium" />
            </Box>

            {/* Tag chips */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.875 }}>
              <Shimmer height={20} width={64} borderRadius={6} variant="wave" intensity="low" />
              <Shimmer height={20} width={48} borderRadius={6} variant="wave" intensity="low" />
              <Shimmer height={20} width={56} borderRadius={6} variant="wave" intensity="low" />
            </Box>

            {/* Meta footer (R:R · date · session · icons) */}
            <Box
              sx={{
                pt: 0.875,
                borderTop: `1px solid ${hairline}`,
                display: 'flex',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Shimmer height={10} width={48} borderRadius={3} variant="wave" intensity="low" />
              <Shimmer height={10} width={38} borderRadius={3} variant="wave" intensity="low" />
              <Shimmer height={10} width={48} borderRadius={3} variant="wave" intensity="low" />
              <Shimmer height={12} width={12} borderRadius="50%" variant="wave" intensity="low" />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default TradeCardShimmer;
