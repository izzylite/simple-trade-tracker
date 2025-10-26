import React, { useMemo } from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';

interface ShimmerLoaderProps {
  variant?: 'chart' | 'table' | 'card' | 'stats';
  height?: number | string;
  width?: number | string;
  count?: number;
}

const ShimmerLoader: React.FC<ShimmerLoaderProps> = ({
  variant = 'chart',
  height = 300,
  width = '100%',
  count = 1
}) => {
  const theme = useTheme();

  // Generate stable heights for chart bars that don't change on re-renders
  const chartBarHeights = useMemo(() =>
    Array.from({ length: 7 }, () => Math.random() * 60 + 40),
    [] // Empty dependency array ensures heights are stable
  );

  const renderChartShimmer = () => (
    <Box sx={{ width, height, p: 2 }}>
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

  const renderTableShimmer = () => (
    <Box sx={{ width, p: 2 }}>
      {/* Table header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} variant="text" width="20%" height={24} />
        ))}
      </Box>

      {/* Table rows */}
      {Array.from({ length: 12 }).map((_, rowIndex) => (
        <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 1 }}>
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width="20%" height={20} />
          ))}
        </Box>
      ))}
    </Box>
  );

  const renderCardShimmer = () => (
    <Box sx={{ width, p: 2 }}>
      {/* Card title */}
      <Skeleton variant="text" width="60%" height={28} sx={{ mb: 2 }} />

      {/* Card content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton variant="text" width="90%" height={20} />
      </Box>

      {/* Card actions */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  );

  const renderStatsShimmer = () => (
    <Box sx={{ width, p: 2 }}>
      {/* Stats grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Box key={index} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
            <Skeleton variant="text" width="70%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="50%" height={32} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="80%" height={16} />
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderShimmer = () => {
    switch (variant) {
      case 'chart':
        return renderChartShimmer();
      case 'table':
        return renderTableShimmer();
      case 'card':
        return renderCardShimmer();
      case 'stats':
        return renderStatsShimmer();
      default:
        return renderChartShimmer();
    }
  };

  return (
    <Box sx={{
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}>
          {renderShimmer()}
        </Box>
      ))}
    </Box>
  );
};

export default ShimmerLoader;
