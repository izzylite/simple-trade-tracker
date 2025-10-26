import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from '../../types/dualWrite';
import { formatValue } from '../../utils/formatters';
import { log } from '../../utils/logger';

interface CumulativePnLChartProps {
  chartData: any[];
  targetValue: number | null;
  monthly_target?: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'year' | 'all';
}

// Custom Y-axis tick component
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const value = payload.value;
  const formattedValue = formatValue(value);
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={5} textAnchor="end" fill="#666" fontSize={12}>
        {formattedValue}
      </text>
    </g>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, type }: any) => {
  const theme = useTheme();
  
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <Paper sx={{ p: 1.5, boxShadow: theme.shadows[3] }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: data.dailyChange > 0 ? '#4caf50' : data.dailyChange < 0 ? '#f44336' : 'text.secondary',
            fontWeight: 'bold'
          }}
        >
          {formatValue(data.dailyChange)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cumulative P&L: {formatValue(data.cumulativePnL)}
        </Typography>
        {data.trades && data.trades.length > 0 && (
          <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontSize: '0.75rem', mt: 0.5 }}>
            Click to view {data.trades.length} trade{data.trades.length > 1 ? 's' : ''}
          </Typography>
        )}
      </Paper>
    );
  }
  return null;
};

const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({
  chartData,
  targetValue,
  monthly_target,
  setMultipleTradesDialog,
  timePeriod
}) => {
  const theme = useTheme();
  
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
        <Typography variant="h6">Cumulative P&L</Typography>
        {monthly_target && targetValue !== null && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.875rem'
            }}
          >
            Target: {monthly_target}% (${targetValue?.toFixed(2)})
          </Box>
        )}
      </Box>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorPnLWin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.win} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.win} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPnLLoss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.loss} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.loss} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: theme.palette.text.secondary,
              fontSize: timePeriod === 'year' ? 8 : 12
            }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={<CustomYAxisTick />}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} type="cumulative" />} />
          {targetValue !== null && (
            <>
              <ReferenceLine
                y={targetValue}
                stroke={theme.palette.primary.main}
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              {/* Add a semi-transparent area above the target line */}
              <Area
                type="monotone"
                dataKey="cumulativePnL"
                stroke="none"
                fill={theme.palette.primary.main}
                fillOpacity={0.05}
                baseValue={targetValue}
              />
            </>
          )}
          <ReferenceLine y={0} stroke={COLORS.zero} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="cumulativePnL"
            stroke={COLORS.win}
            fill="url(#colorPnLWin)"
            strokeWidth={2}
            name="Cumulative P&L"
            style={{ cursor: 'pointer' }}
            activeDot={(props) => {
              const { cx, cy, index } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  stroke={theme.palette.background.paper}
                  strokeWidth={2}
                  fill={theme.palette.primary.main}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    log('Dot clicked, Index:', index);
                    const dataPoint = chartData[index];
                    if (dataPoint && dataPoint.trades && dataPoint.trades.length > 0) {
                      const formattedDate = format(dataPoint.fullDate, 'MMMM d, yyyy');
                      setMultipleTradesDialog({
                        open: true,
                        trades: dataPoint.trades,
                        date: formattedDate,
                        expandedTradeId: dataPoint.trades.length === 1 ? dataPoint.trades[0].id : null
                      });
                    }
                  }}
                />
              );
            }}
            dot={{
              r: 3,
              fill: COLORS.win,
              stroke: theme.palette.background.paper,
              strokeWidth: 1
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default CumulativePnLChart;
