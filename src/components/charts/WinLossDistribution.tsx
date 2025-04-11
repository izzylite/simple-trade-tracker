import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Box, Paper, Typography, useTheme, Button } from '@mui/material';

import TagFilterDialog from '../TagFilterDialog';

interface WinLossDistributionProps {
  winLossData: any[];
  comparisonWinLossData?: any[] | null;
  allTags: string[];
  comparisonTags: string[];
  setComparisonTags: (tags: string[]) => void;
  onPieClick?: (category: string) => void;
}

const WinLossDistribution: React.FC<WinLossDistributionProps> = ({
  winLossData,
  comparisonWinLossData,
  allTags,
  comparisonTags,
  setComparisonTags,
  onPieClick
}) => {
  const theme = useTheme();
  const [comparisonTagsDialogOpen, setComparisonTagsDialogOpen] = useState(false);

  // Add a style element to remove focus outlines from SVG elements
  React.useEffect(() => {
    // Create a style element
    const style = document.createElement('style');
    // Add CSS to remove focus outlines from SVG elements
    style.innerHTML = `
      .recharts-sector:focus,
      .recharts-sector:focus-visible,
      .recharts-pie:focus,
      .recharts-pie:focus-visible,
      .recharts-pie-sector:focus,
      .recharts-pie-sector:focus-visible,
      .recharts-layer:focus,
      .recharts-layer:focus-visible,
      .recharts-surface:focus,
      .recharts-surface:focus-visible {
        outline: none !important;
        stroke: none !important;
        stroke-width: 0 !important;
        box-shadow: none !important;
      }

      /* Target all SVG elements in the chart */
      .recharts-wrapper svg *:focus,
      .recharts-wrapper svg *:focus-visible,
      .win-loss-chart-container svg *:focus,
      .win-loss-chart-container svg *:focus-visible {
        outline: none !important;
        stroke-width: 0 !important;
      }
    `;
    // Append the style element to the document head
    document.head.appendChild(style);

    // Clean up the style element when the component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Define colors
  const COLORS = {
    win: '#4caf50',
    loss: '#f44336',
    zero: '#9e9e9e',
    breakEven: '#ff9800'
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.paper }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Win/Loss Distribution</Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setComparisonTagsDialogOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          {comparisonTags.length > 0 ? `Compare: ${comparisonTags.length} tags` : 'Compare Tags'}
        </Button>
        <TagFilterDialog
          open={comparisonTagsDialogOpen}
          onClose={() => setComparisonTagsDialogOpen(false)}
          title="Select Tags to Compare"
          allTags={allTags}
          selectedTags={comparisonTags}
          onTagsChange={(tags) => setComparisonTags(tags)}
          showApplyButton={true}
          showClearButton={true}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 300 }} className="win-loss-chart-container">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart style={{ outline: 'none' }} tabIndex={-1}>
          <Pie
            data={comparisonTags.length > 0 ? (comparisonWinLossData || winLossData) : winLossData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            strokeWidth={0}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            paddingAngle={2}
            onClick={(data) => {
              if (onPieClick) {
                onPieClick(data.name);
              }
            }}
            cursor="pointer"
            style={{ outline: 'none' }}
            tabIndex={-1}
          >
            {(comparisonTags.length > 0 ? (comparisonWinLossData || winLossData) : winLossData).map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.name === 'Wins' ? COLORS.win : entry.name === 'Losses' ? COLORS.loss : COLORS.breakEven}
                strokeWidth={0}
                style={{ outline: 'none' }}
              />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {comparisonTags.length > 0 ? 'Showing distribution for selected tags' : 'Showing distribution for all trades'}
        </Typography>
        {onPieClick && (
          <Typography variant="caption" color="primary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
            Click on a segment to view trades
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default WinLossDistribution;
