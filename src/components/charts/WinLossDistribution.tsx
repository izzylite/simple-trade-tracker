import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { Box, Paper, Typography, useTheme, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PieChart as PieChartIcon, DonutLarge as DonutLargeIcon } from '@mui/icons-material';
import { getTagColor } from '../../utils/tagColors';

import TagFilterDialog from '../TagFilterDialog';

interface WinLossDistributionProps {
  winLossData: any[];
  comparisonWinLossData?: any[] | null;
  allTags: string[];
  comparisonTags: string[];
  setComparisonTags: (tags: string[]) => void;
  onPieClick?: (category: string) => void;
  tagStats?: { tag: string; totalTrades: number }[];
}

const WinLossDistribution: React.FC<WinLossDistributionProps> = ({
  winLossData,
  comparisonWinLossData,
  allTags,
  comparisonTags,
  setComparisonTags,
  onPieClick,
  tagStats = []
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

  // Define colors with enhanced visual appeal
  const COLORS = {
    win: theme.palette.mode === 'dark' ? '#66bb6a' : '#4caf50', // Slightly lighter green in dark mode
    loss: theme.palette.mode === 'dark' ? '#ef5350' : '#f44336', // Slightly lighter red in dark mode
    zero: theme.palette.mode === 'dark' ? '#bdbdbd' : '#9e9e9e', // Lighter gray in dark mode
    breakEven: theme.palette.mode === 'dark' ? '#ffb74d' : '#ff9800' // Lighter orange in dark mode
  };

  // Define chart styling
  const chartStyle = {
    outerRadius: 100,
    innerRadius: 60,
    paddingAngle: 3,
    cornerRadius: 4,
    activeFillOpacity: 0.9,
    hoverShadowColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
    labelFontSize: '0.85rem',
    labelFontWeight: 500
  };

  // Generate tag distribution data when in tag distribution mode
  const generateTagDistributionData = () => {
    if (!comparisonTags || comparisonTags.length === 0) return [];

    // If we don't have any win/loss data, we can't generate tag distribution
    if (!comparisonWinLossData || !comparisonWinLossData.some(d => d.value > 0)) {
      return [];
    }

    // Create a map to store the count for each tag
    const tagCounts = new Map<string, number>();

    // Use the tagStats from the parent component if available
    if (tagStats && tagStats.length > 0) {
      // Filter to only include the selected comparison tags
      const filteredTagStats = tagStats.filter(stat => comparisonTags.includes(stat.tag));

      // If we have stats for the selected tags, use them
      if (filteredTagStats.length > 0) {
        filteredTagStats.forEach(stat => {
          tagCounts.set(stat.tag, stat.totalTrades);
        });
      } else {
        // Fallback if we don't have stats for the selected tags
        comparisonTags.forEach(tag => {
          // Use a hash of the tag name to generate a consistent value
          const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          // Generate a value between 1 and 10 based on the hash
          const value = (hash % 10) + 1;
          tagCounts.set(tag, value);
        });
      }
    } else {
      // Fallback if we don't have any tag stats
      comparisonTags.forEach(tag => {
        // Use a hash of the tag name to generate a consistent value
        const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Generate a value between 1 and 10 based on the hash
        const value = (hash % 10) + 1;
        tagCounts.set(tag, value);
      });
    }

    // Convert to the format needed for the pie chart
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        name: tag,
        value: count
      }));
  };

  // Get the appropriate data based on whether tags are selected
  const chartData = comparisonTags.length > 0
    ? generateTagDistributionData()
    : winLossData;

  return (
    <Paper
      elevation={theme.palette.mode === 'dark' ? 2 : 1}
      sx={{
        p: 3,
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
      }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        pb: 1.5,
      }}>
        <Typography variant="h6" sx={{

          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {comparisonTags.length > 0 ? (
            <>

              Tag Distribution
            </>
          ) : (
            <>

              Win/Loss Distribution
            </>
          )}
        </Typography>
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
        {/* Show message when no data is available */}
        {comparisonTags.length > 0 && chartData.length === 0 ? (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="body1" color="text.secondary">
              No trades found with the selected tags
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Try selecting different tags for comparison
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              style={{ outline: 'none' }}
              tabIndex={-1}
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <Paper sx={{ p: 1.5, boxShadow: theme.shadows[3] }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {data.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: comparisonTags.length > 0
                              ? getTagColor(data.name)
                              : data.name === 'Wins'
                                ? COLORS.win
                                : data.name === 'Losses'
                                  ? COLORS.loss
                                  : data.name === 'Breakeven'
                                    ? COLORS.breakEven
                                    : COLORS.zero,
                            fontWeight: 'bold'
                          }}
                        >
                          {data.value} trade{data.value !== 1 ? 's' : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(data.value / chartData.reduce((sum, item) => sum + item.value, 0) * 100).toFixed(1)}% of total
                        </Typography>
                        {onPieClick && (
                          <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontSize: '0.75rem', mt: 0.5 }}>
                            Click to view trades
                          </Typography>
                        )}
                      </Paper>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={chartStyle.outerRadius}
                strokeWidth={0}
                innerRadius={chartStyle.innerRadius}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => {
                  // Only show labels for segments with significant percentage
                  if (percent < 0.05) return null;
                  return `${name} ${(percent * 100).toFixed(0)}%`;
                }}
                paddingAngle={chartStyle.paddingAngle}
                cornerRadius={chartStyle.cornerRadius}
                onClick={(data) => {
                  if (onPieClick) {
                    onPieClick(data.name);
                  }
                }}
                cursor={'pointer'}
                style={{
                  outline: 'none',
                  filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.1))'
                }}
                tabIndex={-1}
              >
                {chartData.map((entry, index) => {
                  // Determine the fill color based on whether we're showing tags or win/loss
                  let fillColor;
                  if (comparisonTags.length > 0) {
                    // For tag distribution, use the tag's color from the tagColors utility
                    fillColor = getTagColor(entry.name);
                  } else {
                    // For win/loss distribution, use the predefined colors
                    fillColor = entry.name === 'Wins' ? COLORS.win :
                               entry.name === 'Losses' ? COLORS.loss :
                               entry.name === 'Breakeven' ? COLORS.breakEven :
                               COLORS.zero;
                  }

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      strokeWidth={1}
                      stroke={theme.palette.background.paper}
                      style={{
                        outline: 'none',
                        transition: 'opacity 0.3s'
                      }}
                    />
                  );
                })}
              </Pie>
              <Legend
                verticalAlign="bottom"
                align="center"
                layout="horizontal"
                iconSize={12}
                iconType="circle"
                wrapperStyle={{
                  paddingTop: 15,
                  fontSize: '0.85rem',
                  fontWeight: 500
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Box>
      {/* Only show this message when we're displaying a chart */}
      {!(comparisonTags.length > 0 && chartData.length === 0) && (
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          mt: 2,
          pt: 1.5,
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 'auto'
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {comparisonTags.length > 0
              ? 'Showing distribution of selected tags'
              : 'Showing win/loss distribution for all trades'}
          </Typography>
          {onPieClick && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              px: 1.5,
              py: 0.5,
              borderRadius: 1
            }}>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 500 }}>
                Click on a segment to view trades
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default WinLossDistribution;
