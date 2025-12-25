import React, { useMemo } from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';

interface ShimmerChartLoaderProps {
  height?: number | string;
  width?: number | string;
}

const ShimmerChartLoader: React.FC<ShimmerChartLoaderProps> = ({
  height = 300,
  width = '100%'
}) => {
  const theme = useTheme();

  // Generate stable heights for chart bars that don't change on re-renders
  const chartBarHeights = useMemo(() =>
    Array.from({ length: 7 }, () => Math.random() * 60 + 40),
    []
  );

  return (
    <Box sx={{
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 2,
      m: 2,
      overflow: 'hidden',
      width,
      height,
      p: 2
    }}>
      {/* Chart title */}
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />

      {/* Chart area */}
      <Box sx={{ display: 'flex', alignItems: 'end', gap: 1, height: '80%', mb: 2 }}>
        {chartBarHeights.map((barHeight, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width="12%"
            height={`${barHeight}%`}
            sx={{
              borderRadius: 1,
              transition: 'height 0.3s ease-in-out'
            }}
          />
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="text" width={80} height={20} />
        <Skeleton variant="text" width={80} height={20} />
      </Box>
    </Box>
  );
};

export default ShimmerChartLoader;
