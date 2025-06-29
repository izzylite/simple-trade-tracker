import React, { useState } from 'react';
import {
  Typography,
  Box,
  Button,
  Tooltip,
  useTheme,
  Paper
} from '@mui/material';
import {
  ViewCarousel as GalleryIcon
} from '@mui/icons-material';
import { Trade } from '../../types/trade';
import TradeList from '../trades/TradeList';
import { BaseDialog } from '../common';
import DayHeader from '../trades/DayHeader';
import { calculateCumulativePnL, startOfNextDay } from '../trades/TradeFormDialog';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getTagDayOfWeekChartData } from '../../utils/chartDataUtils';

interface TradesDialogProps {
  open: boolean;
  trades: Trade[];
  date: string;
  expandedTradeId: string | null;
  showChartInfo?: boolean
  onClose: () => void;
  onTradeExpand: (tradeId: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onZoomImage: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  accountBalance: number;
  allTrades: Trade[];
  onEditClick?: (trade: Trade) => void;
  onDeleteClick?: (tradeId: string) => void;
  onDeleteMultiple?: (tradeIds: string[]) => void;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  calendarId?: string;
  // Calendar data for economic events filtering
  calendar?: {
    economicCalendarFilters?: {
      currencies: string[];
      impacts: string[];
      viewType: 'day' | 'week' | 'month';
    };
  };
}

const TradesListDialog: React.FC<TradesDialogProps> = ({
  open,
  trades,
  date,
  showChartInfo,
  expandedTradeId,
  onClose,
  onTradeExpand,
  onZoomImage,
  accountBalance,
  allTrades,
  onUpdateTradeProperty,
  onEditClick,
  onDeleteClick,
  onDeleteMultiple,
  onOpenGalleryMode,
  calendarId,
  calendar
}) => {
  const theme = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<'winRate' | 'pnl'>('winRate');
  // Format data for the chart based on selected metric
  const [chartData, setChartData] = React.useState<any[] | undefined>(undefined);


  const tradeStats = React.useMemo(() => {
    let containWins = false;
    let containLosses = false;
    trades.forEach((trade) => {
      if (trade.type === 'win') containWins = true;
      else if (trade.type === 'loss') containLosses = true;
    });
    return {
      containWins,
      containLosses,
      containBoth: containWins && containLosses
    };
  }, [trades]);

  React.useEffect(() => {
    let isMounted = true;

    const fetchChartData = async () => {
      // If getTagDayOfWeekChartData is async, await it; otherwise, wrap in Promise.resolve
      const result = await Promise.resolve(
        getTagDayOfWeekChartData(trades, theme, selectedMetric === "winRate" && tradeStats.containBoth)
      );

      if (isMounted) {
        // Sum all totalTrades values
        const totalTradesSum = Array.isArray(result)
          ? result.reduce((sum, item) => sum + (item.totalTrades > 0 ? 1 : 0), 0)
          : 0;
        setChartData(totalTradesSum > 1 ? result : undefined);
      }
    };

    fetchChartData();

    return () => { isMounted = false; };
  }, [selectedMetric, showChartInfo, trades, theme]);



  // Gallery mode handler
  const handleGalleryModeClick = () => {
    if (onOpenGalleryMode && trades.length > 0) {
      const title = `${date} - ${trades.length} Trade${trades.length > 1 ? 's' : ''}`;
      onOpenGalleryMode(trades, expandedTradeId || trades[0].id, title);
      onClose(); // Close the dialog when opening gallery mode
    }
  };

  // Calculate total PnL from trades
  const [totalPnL, setTotalPnL] = React.useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;
    const calculateTotalPnL = async () => {
      // Simulate async calculation, replace with real async logic if needed
      const sum = trades.reduce((acc, trade) => acc + trade.amount, 0);
      if (isMounted) setTotalPnL(sum);
    };
    calculateTotalPnL();
    return () => { isMounted = false; };
  }, [trades]);

  const dialogTitle = (
    <Typography variant="h6">
      {trades.length} {trades.length === 1 ? 'Trade' : 'Trades'} for {date}
    </Typography>
  );

  // Custom actions for the dialog
  const dialogActions = onOpenGalleryMode && trades.length > 0 ? (
    <Tooltip title="View trades in gallery mode">
      <Button
        variant="contained"
        size="large"
        startIcon={<GalleryIcon />}
        onClick={handleGalleryModeClick}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 1.5,
          px: 3
        }}
      >
        Gallery View
      </Button>
    </Tooltip>
  ) : undefined;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={dialogTitle}
      actions={dialogActions}
    >
      <Box sx={{ p: 2 }}>
        {/* DayHeader with navigation buttons hidden */}
        <DayHeader
          title={''}
          accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
          formInputVisible={true} // Set to true to hide navigation buttons
          totalPnL={totalPnL}
          onPrevDay={() => { }} // Empty function since we're hiding the buttons
          onNextDay={() => { }} // Empty function since we're hiding the buttons
        />

        {chartData &&
          <>
            {tradeStats.containBoth &&
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

              </Box>}
            {chartData.some(data => data.totalTrades > 0) ? (
              <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 500 }}>
                {tradeStats.containBoth && selectedMetric === 'winRate'
                  ? `Best day for selected strategies: ${chartData.reduce((best, day) => day.totalTrades > 0 && day.winRate > best.winRate ? day : best, { winRate: 0, fullDay: 'None' }).fullDay}`
                  : `Most profitable/un-profitable day: ${chartData.reduce((best, day) => day.totalTrades > 0 && day.pnl > best.pnl ? day : best, { pnl: -Infinity, fullDay: 'None' }).fullDay}`
                }
              </Typography>
            ) : null}

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
                  domain={tradeStats.containBoth ? [0, 100] : ['auto', 'auto']}
                  tickFormatter={tradeStats.containBoth && selectedMetric === "winRate"
                    ? (value) => `${value}%`
                    : (value) => formatCurrency(value).replace('$', '')}
                />

                <Legend />
                <RechartsTooltip content={({ active, payload, label }: any) => {
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
                        {tradeStats.containWins &&
                          <Typography variant="body2" sx={{ color: theme.palette.success.main }}>
                            Wins: {data.winTrades}
                          </Typography>
                        }

                        {tradeStats.containLosses &&
                          <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                            Losses: {data.lossTrades}
                          </Typography>
                        }

                        {tradeStats.containBoth &&
                          <Typography variant="body2">
                            Win Rate: {data.winRate.toFixed(1)}%
                          </Typography>}

                        <Typography variant="body2">
                          P&L: {formatCurrency(data.pnl)}
                        </Typography>
                      </Paper>
                    );
                  }
                  return null;
                }} />
                <Bar
                  dataKey="value"
                  name={tradeStats.containBoth && selectedMetric === "winRate" ? 'Win Rate' : 'P&L'}
                  fill={theme.palette.primary.main}
                  radius={[4, 4, 0, 0]}

                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

          </>
        }

        <TradeList
          sx={{ mt: 0 }}
          trades={trades}
          expandedTradeId={expandedTradeId}
          onTradeClick={onTradeExpand}
          onEditClick={onEditClick || (() => { })} // Use provided handler or no-op
          onDeleteClick={onDeleteClick || (() => { })} // Use provided handler or no-op
          onDeleteMultiple={onDeleteMultiple}
          onZoomedImage={onZoomImage}
          onUpdateTradeProperty={onUpdateTradeProperty}
          hideActions={!onEditClick && !onDeleteClick} // Hide actions only if both handlers are not provided
          enableBulkSelection={trades.length > 1 && !!onDeleteMultiple} // Enable bulk selection when there are multiple trades and handler is provided
          calendarId={calendarId}
          onOpenGalleryMode={onOpenGalleryMode}
          calendar={calendar}
        />
      </Box>
    </BaseDialog>
  );
};

export default TradesListDialog;
