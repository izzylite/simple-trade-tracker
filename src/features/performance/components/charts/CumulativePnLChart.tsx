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
import { TrendingUp } from '@mui/icons-material';
import { format } from 'date-fns';
import { formatValue } from 'utils/formatters';
import { log } from 'utils/logger';
import CardShell from 'components/common/CardShell';
import { TNUM } from 'styles/designTokens';
import { useIsMobile } from 'hooks/useResponsive';

interface CumulativePnLChartProps {
  chartData: any[];
  targetValue: number | null;
  monthly_target?: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'quarter' | 'ytd' | 'year' | 'all';
}

// Custom Y-axis tick component
const CustomYAxisTick = (props: any) => {
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
            color:
              data.dailyChange > 0
                ? 'success.main'
                : data.dailyChange < 0
                  ? 'error.main'
                  : 'text.secondary',
            fontWeight: 700,
            fontFeatureSettings: TNUM,
            letterSpacing: '-0.01em',
          }}
        >
          {formatValue(data.dailyChange)}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.tertiary', fontSize: '0.75rem', fontFeatureSettings: TNUM }}
        >
          Cumulative P&L: {formatValue(data.cumulativePnL)}
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

const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({
  chartData,
  targetValue,
  monthly_target,
  setMultipleTradesDialog,
  timePeriod
}) => {
  const theme = useTheme();
  const radius = theme.palette.custom.radius;
  const isMobile = useIsMobile();

  // Define colors
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

  const targetChip = monthly_target && targetValue !== null ? (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: theme.palette.custom.tintViolet.strong,
        border: `1px solid ${theme.palette.divider}`,
        color: 'primary.main',
        px: 1.25,
        py: 0.5,
        borderRadius: `${radius.md}px`,
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        fontFeatureSettings: TNUM,
        flexShrink: 0,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mr: 0.25,
        }}
      >
        Target
      </Box>
      <Box component="span" sx={{ color: 'primary.main' }}>
        {monthly_target}%
      </Box>
      <Box component="span" sx={{ color: 'text.tertiary' }}>
        · ${targetValue?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Box>
    </Box>
  ) : undefined;

  return (
    <CardShell
      radius="lg"
      head={{
        icon: <TrendingUp sx={{ fontSize: 16 }} />,
        title: 'Cumulative P&L',
        eyebrow: periodLabel,
        right: targetChip,
      }}
    >
      {/* Chart body */}
      <Box sx={{ p: 2 }}>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
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
              tick={<CustomYAxisTick tickFill={theme.palette.text.secondary} />}
            />
            <Tooltip
              cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }}
              content={(props) => <CustomTooltip {...props} />}
            />
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
            <ReferenceLine y={0} stroke={theme.palette.text.tertiary} strokeDasharray="3 3" />
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
                          title: formattedDate,
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
    </CardShell>
  );
};

export default CumulativePnLChart;
