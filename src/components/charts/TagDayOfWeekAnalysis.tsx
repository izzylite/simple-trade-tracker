import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Box, Paper, Typography, useTheme, Button, alpha, Tooltip as MuiTooltip } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

import { Trade } from '../../types/trade';
import { formatCurrency } from '../../utils/formatters';
import TagFilterDialog from '../TagFilterDialog';
import { getTagDayOfWeekChartData } from '../../utils/chartDataUtils';

interface TagDayOfWeekAnalysisProps {
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'year' | 'all';
  allTags: string[];
  primaryTags: string[];
  secondaryTags: string[];
  setPrimaryTags: (tags: string[]) => void;
  setSecondaryTags: (tags: string[]) => void;
  setMultipleTradesDialog: (dialogState: any) => void;
}



const TagDayOfWeekAnalysis: React.FC<TagDayOfWeekAnalysisProps> = ({
  trades,
  selectedDate,
  timePeriod,
  allTags,
  primaryTags,
  secondaryTags,
  setPrimaryTags,
  setSecondaryTags,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();
  const [primaryTagsDialogOpen, setPrimaryTagsDialogOpen] = useState(false);
  const [secondaryTagsDialogOpen, setSecondaryTagsDialogOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'winRate' | 'pnl'>('winRate');

  // Format data for the chart based on selected metric
  const filteredTrades = React.useMemo(() => {
    // If no tags selected, return empty array
    if (primaryTags.length === 0) {
      return [];
    }

    // Filter trades by selected tags
    return trades.filter(trade => {
      // Check if trade has tags
      if (!trade.tags || trade.tags.length === 0) {
        return false;
      }

      // Check if trade has any of the primary tags
      const hasPrimaryTag = primaryTags.some(tag => trade.tags?.includes(tag));
      if (!hasPrimaryTag) {
        return false;
      }

      // If secondary tags are selected, check if trade has all of them
      if (secondaryTags.length > 0) {
        return secondaryTags.every(tag => trade.tags?.includes(tag));
      }

      return true;
    });
  }, [trades, primaryTags, secondaryTags]);


  // Format data for the chart based on selected metric
  
  const chartData = React.useMemo(() => {

    return getTagDayOfWeekChartData(filteredTrades, theme, selectedMetric === 'winRate');
      
  }, [selectedMetric,filteredTrades]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {data.fullDay}
          </Typography>
          <Typography variant="body2">
            Total Trades: {data.totalTrades}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.success.main }}>
            Wins: {data.winTrades}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
            Losses: {data.lossTrades}
          </Typography>
          <Typography variant="body2">
            Win Rate: {data.winRate.toFixed(1)}%
          </Typography>
          <Typography variant="body2">
            P&L: {formatCurrency(data.pnl)}
          </Typography>
        </Paper>
      );
    }
    return null;
  };



  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Tag Performance by Day of Week</Typography>
          <MuiTooltip
            title="Analyze how selected tags perform on different days of the week. This helps identify which strategies work better on specific days."
            arrow
            placement="top"
          >
            <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
          </MuiTooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={selectedMetric === 'winRate' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedMetric('winRate')}
            sx={{ textTransform: 'none' }}
          >
            Win Rate
          </Button>
          <Button
            variant={selectedMetric === 'pnl' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedMetric('pnl')}
            sx={{ textTransform: 'none' }}
          >
            P&L
          </Button>
          <MuiTooltip
            title="Select primary tags to filter trades that have ANY of these tags. These are your main strategies or setups to analyze."
            arrow
            placement="top"
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPrimaryTagsDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {primaryTags.length > 0 ? `Primary: ${primaryTags.length} tags` : 'Select Primary Tags'}
            </Button>
          </MuiTooltip>
          <MuiTooltip
            title="Select secondary tags to further filter trades that have ALL of these tags. Use this to analyze specific conditions within your primary strategies."
            arrow
            placement="top"
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSecondaryTagsDialogOpen(true)}
              color={secondaryTags.length > 0 ? "secondary" : "primary"}
              sx={{
                textTransform: 'none',
                borderColor: secondaryTags.length > 0 ? 'secondary.main' : undefined
              }}
            >
              {secondaryTags.length > 0 ? `Secondary: ${secondaryTags.length} tags` : 'Select Secondary Tags'}
            </Button>
          </MuiTooltip>
          <TagFilterDialog
            open={primaryTagsDialogOpen}
            onClose={() => setPrimaryTagsDialogOpen(false)}
            title="Select Primary Tags"
            allTags={allTags}
            selectedTags={primaryTags}
            onTagsChange={(tags) => setPrimaryTags(tags)}
            showApplyButton={true}
            showClearButton={true}
          />
          <TagFilterDialog
            open={secondaryTagsDialogOpen}
            onClose={() => setSecondaryTagsDialogOpen(false)}
            title="Select Secondary Tags"
            allTags={allTags}
            selectedTags={secondaryTags}
            onTagsChange={(tags) => setSecondaryTags(tags)}
            showApplyButton={true}
            showClearButton={true}
          />
        </Box>
      </Box> 
      {primaryTags.length === 0 ? (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 300,
          bgcolor: alpha(theme.palette.background.paper, 0.4),
          borderRadius: 2,
          p: 3
        }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Tags Selected
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Please select primary tags to view day of week performance analysis.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              This chart shows how your selected trading strategies (tags) perform on different days of the week.
              {selectedMetric === 'winRate'
                ? ' Higher bars indicate better win rates on those days. '
                : ' Higher bars indicate better profitability on those days. '}
              Click on any bar to see the specific trades for that day.
            </Typography>
            {chartData.some(data => data.totalTrades > 0) ? (
              <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 500 }}>
                {selectedMetric === 'winRate'
                  ? `Best day for selected strategies: ${chartData.reduce((best, day) => day.totalTrades > 0 && day.winRate > best.winRate ? day : best, { winRate: 0, fullDay: 'None' }).fullDay}`
                  : `Most profitable day: ${chartData.reduce((best, day) => day.totalTrades > 0 && day.pnl > best.pnl ? day : best, { pnl: -Infinity, fullDay: 'None' }).fullDay}`
                }
              </Typography>
            ) : null}
          </Box>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              maxBarSize={50}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                domain={selectedMetric === 'winRate' ? [0, 100] : ['auto', 'auto']}
                tickFormatter={selectedMetric === 'winRate'
                  ? (value) => `${value}%`
                  : (value) => formatCurrency(value).replace('$', '')}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="value"
                name={selectedMetric === 'winRate' ? 'Win Rate' : 'P&L'}
                fill={theme.palette.primary.main}
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data && data.payload && setMultipleTradesDialog) {
                    const dayTrades = data.payload.trades;
                    if (dayTrades.length > 0) {
                      setMultipleTradesDialog({
                        open: true,
                        trades: dayTrades,
                        showChartInfo:false,
                        date: `${selectedMetric === 'winRate' ? 'Win Rate' : 'P&L'} for ${data.payload.fullDay}`,
                        expandedTradeId: dayTrades.length === 1 ? dayTrades[0].id : null
                      });
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )} 
    </Box>
  );
};
 

export default TagDayOfWeekAnalysis;
