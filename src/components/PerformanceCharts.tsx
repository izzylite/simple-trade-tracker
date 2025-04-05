import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { Trade } from '../types/trade';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { Box, Paper, Typography, useTheme, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface PerformanceChartsProps {
  trades: Trade[];
  selectedDate: Date;
  monthlyTarget?: number;
  accountBalance: number;
  maxDailyDrawdown: number;
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ trades, selectedDate, monthlyTarget, accountBalance, maxDailyDrawdown }) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Filter trades for the selected month
    const monthTrades = trades.filter(trade => 
      isSameMonth(new Date(trade.date), selectedDate)
    );

    // Sort trades by date to ensure correct cumulative calculation
    const sortedTrades = [...monthTrades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Initialize cumulative tracking
    let cumulative = 0;
    let prevCumulative = 0;

    // Prepare daily data
    const dailyData = daysInMonth.map(day => {
      const dayTrades = sortedTrades.filter(trade => 
        format(trade.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      
      // Calculate daily P&L using trade amounts directly
      const dailyPnL = dayTrades.reduce((sum, trade) => {
        return sum + trade.amount;
      }, 0);

      // Store previous cumulative for trend calculation
      prevCumulative = cumulative;
      
      // Update cumulative P&L
      cumulative += dailyPnL;

      return {
        date: format(day, 'MM/dd'),
        pnl: dailyPnL,
        cumulativePnL: cumulative,
        isIncreasing: cumulative > prevCumulative,
        isDecreasing: cumulative < prevCumulative,
        dailyChange: cumulative - prevCumulative,
        isWin: dailyPnL > 0,
        isLoss: dailyPnL < 0,
        isBreakEven: dailyPnL === 0
      };
    });

    return dailyData;
  }, [trades, selectedDate]);

  const winLossData = useMemo(() => {
    const monthTrades = trades.filter(trade => 
      isSameMonth(new Date(trade.date), selectedDate)
    );
    
    const wins = monthTrades.filter(trade => trade.type === 'win').length;
    const losses = monthTrades.filter(trade => trade.type === 'loss').length;
    
    return [
      { name: 'Wins', value: wins },
      { name: 'Losses', value: losses }
    ];
  }, [trades, selectedDate]);

  const dailySummaryData = useMemo(() => {
    // Group trades by date
    const tradesByDate = trades
      .filter(trade => isSameMonth(new Date(trade.date), selectedDate))
      .reduce((acc, trade) => {
        const dateKey = format(new Date(trade.date), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(trade);
        return acc;
      }, {} as { [key: string]: Trade[] });

    // Calculate daily statistics
    return Object.entries(tradesByDate)
      .map(([date, dayTrades]) => {
        const totalPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
        // Get journal link from the first trade of the day (assuming all trades for the day share the same journal)
        const journalLink = dayTrades[0]?.journalLink;
        // Collect all unique tags from the day's trades
        const tags = Array.from(new Set(dayTrades.flatMap(trade => trade.tags || [])));

        return {
          date: parseISO(date),
          trades: dayTrades.length,
          journalLink,
          pnl: totalPnL,
          tags
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending
  }, [trades, selectedDate]);

  // Add new useMemo for tag statistics
  const tagStats = useMemo(() => {
    const monthTrades = trades.filter(trade => 
      isSameMonth(new Date(trade.date), selectedDate)
    );

    // Create a map to store stats for each tag
    const tagMap = new Map<string, { wins: number; losses: number; totalPnL: number }>();

    monthTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          const stats = tagMap.get(tag) || { wins: 0, losses: 0, totalPnL: 0 };
          if (trade.type === 'win') {
            stats.wins++;
          } else {
            stats.losses++;
          }
          stats.totalPnL += trade.amount;
          tagMap.set(tag, stats);
        });
      }
    });

    // Convert map to array and calculate win rates
    return Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        wins: stats.wins,
        losses: stats.losses,
        total: stats.wins + stats.losses,
        winRate: ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1),
        totalPnL: stats.totalPnL
      }))
      .sort((a, b) => b.total - a.total); // Sort by total trades
  }, [trades, selectedDate]);

  const COLORS = {
    win: '#4CAF50',
    loss: '#f44336',
    breakEven: theme.palette.grey[400],
    zero: theme.palette.divider
  };

  const formatValue = (value: number) => {
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  // Calculate target value if monthly target exists
  const targetValue = useMemo(() => {
    if (monthlyTarget && accountBalance) {
      return (monthlyTarget / 100) * accountBalance;
    }
    return null;
  }, [monthlyTarget, accountBalance]);

  // Calculate drawdown violation value
  const drawdownViolationValue = useMemo(() => {
    return -(maxDailyDrawdown / 100) * accountBalance;
  }, [maxDailyDrawdown, accountBalance]);

  // Custom Y-axis tick for Daily PnL chart
  const CustomDailyPnLYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const isDrawdownViolation = Math.abs(payload.value - drawdownViolationValue) < 0.01;

    return (
      <g transform={`translate(${x},${y})`}>
        {isDrawdownViolation && (
          <rect
            x={-55}
            y={-10}
            width={60}
            height={20}
            fill={theme.palette.error.main}
            fillOpacity={0.1}
            rx={4}
          />
        )}
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill={isDrawdownViolation ? theme.palette.error.main : theme.palette.text.secondary}
          fontSize={isDrawdownViolation ? 14 : 12}
          fontWeight={isDrawdownViolation ? 700 : 400}
          letterSpacing={isDrawdownViolation ? "0.5px" : "normal"}
        >
          {isDrawdownViolation 
            ? formatValue(payload.value).replace('-$', '-$') // Keep the negative sign for drawdown
            : formatValue(payload.value)
          }
        </text>
      </g>
    );
  };

  // Custom Y-axis tick with enhanced target highlighting
  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const isTargetTick = targetValue !== null && Math.abs(payload.value - targetValue) < 0.01;

    return (
      <g transform={`translate(${x},${y})`}>
        {isTargetTick && (
          <rect
            x={-45}
            y={-10}
            width={50}
            height={20}
            fill={theme.palette.primary.main}
            fillOpacity={0.1}
            rx={4}
          />
        )}
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill={isTargetTick ? theme.palette.primary.main : theme.palette.text.secondary}
          fontSize={12}
          fontWeight={isTargetTick ? 700 : 400}
        >
          {formatValue(payload.value)}
        </text>
      </g>
    );
  };

  // Custom tooltip for all charts
  const CustomTooltip = ({ active, payload, label, type }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      let content;
      if (type === 'daily') {
        content = (
          <>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: data.isWin ? COLORS.win : data.isLoss ? COLORS.loss : COLORS.breakEven,
                fontWeight: 'bold'
              }}
            >
              {formatValue(data.pnl)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.isWin ? 'Win' : data.isLoss ? 'Loss' : 'Break Even'}
            </Typography>
          </>
        );
      } else if (type === 'cumulative') {
        content = (
          <>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: data.isIncreasing ? COLORS.win : data.isDecreasing ? COLORS.loss : COLORS.breakEven,
                fontWeight: 'bold'
              }}
            >
              {formatValue(data.dailyChange)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cumulative P&L: {formatValue(data.cumulativePnL)}
            </Typography>
          </>
        );
      } else if (type === 'distribution') {
        const isWin = payload[0].name === 'Wins';
        content = (
          <>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {payload[0].name}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: isWin ? COLORS.win : COLORS.loss,
                fontWeight: 'bold'
              }}
            >
              {payload[0].value} trades
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {((payload[0].value / (winLossData[0].value + winLossData[1].value)) * 100).toFixed(1)}%
            </Typography>
          </>
        );
      }

      return (
        <Paper sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          {content}
        </Paper>
      );
    }
    return null;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Performance Charts for {format(selectedDate, 'MMMM yyyy')}
        </Typography>
      </Box>
      
      {/* Cumulative P&L Area Chart */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">
            Cumulative P&L
          </Typography>
          {monthlyTarget && (
            <Box 
              component="span" 
              sx={{ 
                ml: 2,
                px: 1, 
                py: 0.5, 
                borderRadius: 1,
                bgcolor: theme.palette.primary.main,
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'medium'
              }}
            >
              Target: {monthlyTarget}% (${targetValue?.toFixed(2)})
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
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
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
            />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      {/* Daily P&L Bar Chart */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">
            Daily P&L
          </Typography>
          <Box 
            component="span" 
            sx={{ 
              ml: 2,
              px: 1, 
              py: 0.5, 
              borderRadius: 1,
              bgcolor: theme.palette.error.main,
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 'medium',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            Max Drawdown: {formatValue(drawdownViolationValue)}
          </Box>
        </Box>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
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
      </Paper>

      {/* Tag Performance Analysis */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Tag Performance Analysis
        </Typography>
        {tagStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={tagStats}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              maxBarSize={50}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
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
              />
              <Bar
                dataKey="losses"
                name="Losses"
                stackId="trades"
                fill={COLORS.loss}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ 
            height: 300, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Typography color="text.secondary">
              No tags found for this month
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Win/Loss Distribution and Daily Summary Section */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/* Win/Loss Distribution Pie Chart */}
        <Paper sx={{ p: 2, flex: 1, minWidth: '40%' }}>
          <Typography variant="subtitle1" gutterBottom>
            Win/Loss Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={winLossData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                paddingAngle={2}
              >
                {winLossData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? COLORS.win : COLORS.loss}
                    fillOpacity={0.8}
                  />
                ))}
              </Pie>
              <Tooltip content={(props) => <CustomTooltip {...props} type="distribution" />} />
            </PieChart>
          </ResponsiveContainer>
        </Paper>

        {/* Daily Summary Table */}
        <Paper sx={{ p: 2, flex: 1.5, minWidth: '60%' }}>
          <Typography variant="subtitle1" gutterBottom>
            Daily Summary
          </Typography>
          <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>DATE</TableCell>
                  <TableCell align="right">TRADES</TableCell>
                  <TableCell align="center">JOURNAL</TableCell>
                  <TableCell>TAGS</TableCell>
                  <TableCell align="right">P/L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailySummaryData.map((row) => (
                  <TableRow
                    key={format(row.date, 'yyyy-MM-dd')}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      bgcolor: row.pnl > 0 
                        ? alpha(theme.palette.success.main, 0.05)
                        : row.pnl < 0 
                        ? alpha(theme.palette.error.main, 0.05)
                        : 'transparent'
                    }}
                  >
                    <TableCell>{format(row.date, 'dd/MM/yyyy')}</TableCell>
                    <TableCell align="right">{row.trades}</TableCell>
                    <TableCell align="center">
                      {row.journalLink ? (
                        <Box
                          component="a"
                          href={row.journalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            color: theme.palette.primary.main,
                            textDecoration: 'none',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          View
                        </Box>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {row.tags.map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.75rem',
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              '& .MuiChip-label': {
                                px: 1
                              }
                            }}
                          />
                        ))}
                        {row.tags.length === 0 && '—'}
                      </Box>
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        color: row.pnl > 0 
                          ? theme.palette.success.main 
                          : row.pnl < 0 
                          ? theme.palette.error.main 
                          : 'inherit',
                        fontWeight: 500
                      }}
                    >
                      {formatValue(row.pnl)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
};

export default PerformanceCharts; 