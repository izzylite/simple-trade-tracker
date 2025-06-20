import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { format } from 'date-fns'; 
 import { formatValue } from '../../utils/formatters';

interface DailyPnLChartProps {
  chartData: any[];
  drawdownViolationValue: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'year' | 'all';
}

// Custom Y-axis tick component for daily P&L
const CustomDailyPnLYAxisTick = (props: any) => {
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
            color: data.isWin ? '#4caf50' : data.isLoss ? '#f44336' : 'text.secondary',
            fontWeight: 'bold'
          }}
        >
          {formatValue(data.pnl)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.isWin ? 'Win' : data.isLoss ? 'Loss' : 'Break Even'}
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

const DailyPnLChart: React.FC<DailyPnLChartProps> = ({
  chartData,
  drawdownViolationValue,
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
      <Typography variant="h6" sx={{ mb: 2 }}>
        Daily P&L
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
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
            tick={<CustomDailyPnLYAxisTick />}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} type="daily" />} />
          <ReferenceLine y={0} stroke={COLORS.zero} strokeDasharray="3 3" />
          <ReferenceLine
            y={drawdownViolationValue}
            stroke={theme.palette.error.main}
            strokeDasharray="3 3"
            strokeWidth={2}
            label={{
              position: 'right',
              value: `Max Drawdown: ${formatValue(drawdownViolationValue)}`,
              fill: theme.palette.error.main,
              fontSize: 12,
              fontWeight: 'bold'
            }}
          />
          <Bar
            dataKey="pnl"
            name="Daily P&L"
            radius={[4, 4, 0, 0]}
            onClick={(data: any) => {
              console.log('Bar clicked:', data);
              if (data && data.payload) {
                const payload = data.payload;
                if (payload.trades && payload.trades.length > 0) {
                  const formattedDate = format(payload.fullDate, 'MMMM d, yyyy');
                  setMultipleTradesDialog({
                    open: true,
                    trades: payload.trades,
                    date: formattedDate,
                    expandedTradeId: payload.trades.length === 1 ? payload.trades[0].id : null
                  });
                }
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isWin ? COLORS.win : entry.isLoss ? COLORS.loss : COLORS.breakEven}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default DailyPnLChart;
