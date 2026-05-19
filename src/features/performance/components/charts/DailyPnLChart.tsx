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
import { BarChart as BarChartIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { formatValue } from 'utils/formatters';
import { log } from 'utils/logger';
import CardShell from 'components/common/CardShell';
import { TNUM } from 'styles/designTokens';

interface DailyPnLChartProps {
  chartData: any[];
  drawdownViolationValue: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'quarter' | 'ytd' | 'year' | 'all';
}

// Custom Y-axis tick component for daily P&L
const CustomDailyPnLYAxisTick = (props: any) => {
  const { x, y, payload, tickFill } = props;
  const value = payload.value;
  const formattedValue = formatValue(value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={5}
        textAnchor="end"
        fill={tickFill}
        fontSize={12}
        style={{ fontFeatureSettings: TNUM }}
      >
        {formattedValue}
      </text>
    </g>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  const theme = useTheme();
  const radius = theme.palette.custom.radius;

  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: `${radius.md}px`,
          boxShadow: 'none',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            mb: 0.5,
            color: 'text.primary',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: data.isWin
              ? 'success.main'
              : data.isLoss
                ? 'error.main'
                : 'text.secondary',
            fontWeight: 700,
            fontFeatureSettings: TNUM,
            letterSpacing: '-0.01em',
          }}
        >
          {data.isWin ? '+' : data.isLoss ? '' : ''}{formatValue(data.pnl).replace(/^\+/, '')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.tertiary', fontSize: '0.75rem' }}>
          {data.isWin ? 'Win' : data.isLoss ? 'Loss' : 'Break Even'}
        </Typography>
        {data.trades && data.trades.length > 0 && (
          <Typography
            variant="body2"
            sx={{
              color: 'primary.main',
              fontSize: '0.7rem',
              mt: 0.5,
              fontWeight: 500,
            }}
          >
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

  // Define colors — keep semantic palette references but make the chart cohesive
  const COLORS = {
    win: theme.palette.success.main,
    loss: theme.palette.error.main,
    zero: theme.palette.text.tertiary,
    breakEven: theme.palette.text.secondary,
  };

  const periodLabel =
    timePeriod === 'month'
      ? 'Current month'
      : timePeriod === 'quarter'
        ? 'Current quarter'
        : timePeriod === 'ytd'
          ? 'Year to date'
          : timePeriod === 'year'
            ? 'Year'
            : 'All time';

  return (
    <CardShell
      radius="lg"
      head={{
        icon: <BarChartIcon sx={{ fontSize: 16 }} />,
        title: 'Daily P&L',
        eyebrow: periodLabel,
      }}
    >
      {/* Chart body */}
      <Box sx={{ p: 2 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={timePeriod === 'month' ? 32 : 56}
              tick={{
                fill: theme.palette.text.secondary,
                fontSize: 10,
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={<CustomDailyPnLYAxisTick tickFill={theme.palette.text.secondary} />}
            />
            <Tooltip
              cursor={{ fill: theme.palette.custom.tintViolet.soft }}
              content={(props) => <CustomTooltip {...props} />}
            />
            <ReferenceLine y={0} stroke={theme.palette.text.tertiary} strokeDasharray="3 3" />
            <ReferenceLine
              y={drawdownViolationValue}
              stroke={theme.palette.error.main}
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{
                position: 'right',
                value: `Max Drawdown: ${formatValue(drawdownViolationValue)}`,
                fill: theme.palette.error.main,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Bar
              dataKey="pnl"
              name="Daily P&L"
              radius={[4, 4, 0, 0]}
              onClick={(data: any) => {
                log('Bar clicked:', data);
                if (data && data.payload) {
                  const payload = data.payload;
                  if (payload.trades && payload.trades.length > 0) {
                    const formattedDate = format(payload.fullDate, 'MMMM d, yyyy');
                    setMultipleTradesDialog({
                      open: true,
                      trades: payload.trades,
                      title: formattedDate,
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
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </CardShell>
  );
};

export default DailyPnLChart;
