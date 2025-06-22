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
import { format, isSameMonth } from 'date-fns';
import { Trade } from '../../types/trade';
import { formatValue } from '../../utils/formatters';
import TagFilterDialog from '../TagFilterDialog'; 
import { getTradesStats } from '../../utils/chartDataUtils';

interface TagPerformanceAnalysisProps {
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

const TagPerformanceAnalysis: React.FC<TagPerformanceAnalysisProps> = ({
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

 
    const filteredTagStats : any = React.useMemo(() => {
      // If no tags selected, return empty array
      if (primaryTags.length === 0) {
        return [];
      }
  
      // Filter trades by selected tags 
     return getTradesStats(trades.filter(trade => {
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
      }))
  
     
   
    }, [trades, primaryTags, secondaryTags]);

  
  
  // Define colors
  const COLORS = {
    win: '#4caf50',
    loss: '#f44336',
    zero: '#9e9e9e',
    breakEven: '#ff9800'
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Tag Performance Analysis</Typography>
          <MuiTooltip
            title="Analyze how different tags perform. Select primary tags to filter, and optionally secondary tags to see how they perform in combination."
            arrow
            placement="top"
          >
            <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
          </MuiTooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
      {primaryTags.length === 0 && secondaryTags.length === 0 ? (
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
            Please select primary or secondary tags to view performance analysis.
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={[filteredTagStats]}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            maxBarSize={50}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="tag"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.win }}>
                        Wins: {data.wins}
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.loss }}>
                        Losses: {data.losses}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Win Rate: {data.winRate}%
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: data.totalPnL > 0 ? COLORS.win : COLORS.loss,
                          fontWeight: 'bold',
                          mt: 0.5
                        }}
                      >
                        P&L: {formatValue(data.totalPnL)}
                      </Typography>
                    </Paper>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar
              dataKey="wins"
              name="Wins"
              stackId="trades"
              fill={COLORS.win}
              radius={[4, 4, 0, 0]}
              onClick={(data) => {
               if (data && data.payload) {
                 const trades = data.payload.trades as Trade[]; 
                 const filteredTrades = trades.filter(trade => 
                   trade.type === 'win' &&
                   (timePeriod === 'month' ? isSameMonth(new Date(trade.date), selectedDate) :
                    timePeriod === 'year' ? new Date(trade.date).getFullYear() === selectedDate.getFullYear() :
                    true)
                 );
                 if (filteredTrades.length > 0) {
                   setMultipleTradesDialog({
                     open: true,
                     trades: filteredTrades,
                     date: `Winning trades with tag: ${[...primaryTags,...secondaryTags].join(", ")}`,
                     expandedTradeId: filteredTrades.length === 1 ? filteredTrades[0].id : null
                   });
                 }
               }
             }}
             style={{ cursor: 'pointer' }}
            />
            <Bar
              dataKey="losses"
              name="Losses"
              stackId="trades"
              fill={COLORS.loss}
              radius={[4, 4, 0, 0]}
              onClick={(data) => {
               if (data && data.payload) {
                 const tag = data.payload.tag;
                 const trades = data.payload.trades as Trade[]; 
                 const filteredTrades = trades.filter(trade => 
                   trade.type === 'loss' &&
                   (timePeriod === 'month' ? isSameMonth(new Date(trade.date), selectedDate) :
                    timePeriod === 'year' ? new Date(trade.date).getFullYear() === selectedDate.getFullYear() :
                    true)
                 );
                 if (filteredTrades.length > 0) {
                   setMultipleTradesDialog({
                     open: true,
                     trades: filteredTrades,
                     date: `Losing trades with tag: ${[...primaryTags,...secondaryTags].join(", ")}`,
                     expandedTradeId: filteredTrades.length === 1 ? filteredTrades[0].id : null
                   });
                 }
               }
             }}
             style={{ cursor: 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
};

export default TagPerformanceAnalysis;
