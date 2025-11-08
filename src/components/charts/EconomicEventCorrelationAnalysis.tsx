import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Card,
  CardContent,
  Alert,
  Stack,
  alpha,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress
} from '@mui/material';
import {
  InfoOutlined,
  Analytics,
  TrendingDown,
  TrendingUp,
  EventNote
} from '@mui/icons-material';
import { Trade, TradeEconomicEvent, Calendar } from '../../types/dualWrite';
import { ImpactLevel, Currency } from '../../types/economicCalendar';
import { formatValue } from '../../utils/formatters';

import RoundedTabs from '../common/RoundedTabs';
import { getCurrenciesForPair } from '../../services/tradeEconomicEventService'; 
import { performanceCalculationService, CalculationProgress } from '../../services/performanceCalculationService';

// Helper function to get flag URL
const getFlagUrl = (flagCode?: string, size: string = 'w40'): string => {
  if (!flagCode) return '';
  return `https://flagcdn.com/${size}/${flagCode.toLowerCase()}.png`;
};

interface EconomicEventCorrelationAnalysisProps {
  calendarIds: string[]; // Changed from calendarId to support multiple calendars
  trades: Trade[];
  timePeriod: 'month' | 'year' | 'all';
  selectedDate: Date;
  setMultipleTradesDialog?: (dialogState: any) => void;
}

interface TradeEventCorrelation {
  trade: Trade;
  economicEvents: TradeEconomicEvent[];
  hasHighImpactEvents: boolean;
  hasMediumImpactEvents: boolean;
  eventCount: number;
}

interface EventTradeDetails {
  event: string;
  losingTrades: Trade[];
  winningTrades: Trade[];
  totalLoss: number;
  totalWin: number;
  avg_loss: number;
  avg_win: number;
  count: number;
  win_rate: number;
  // Economic event details
  economicEventDetails?: {
    country?: string;
    flagCode?: string;
    flagUrl?: string;
  };
}

interface CorrelationStats {
  // Losing trades stats
  totalLosingTrades: number;
  losingTradesWithHighImpact: number;
  losingTradesWithMediumImpact: number;
  losingTradesWithAnyEvents: number;
  highImpactLossCorrelationRate: number;
  mediumImpactLossCorrelationRate: number;
  anyEventLossCorrelationRate: number;
  avgLossWithEvents: number;
  avgLossWithoutEvents: number;

  // Winning trades stats
  totalWinningTrades: number;
  winningTradesWithHighImpact: number;
  winningTradesWithMediumImpact: number;
  winningTradesWithAnyEvents: number;
  highImpactWinCorrelationRate: number;
  mediumImpactWinCorrelationRate: number;
  anyEventWinCorrelationRate: number;
  avgWinWithEvents: number;
  avgWinWithoutEvents: number;

  // Combined stats
  mostCommonEventTypes: EventTradeDetails[];
  impactDistribution: Record<ImpactLevel, number>;
}



const EconomicEventCorrelationAnalysis: React.FC<EconomicEventCorrelationAnalysisProps> = ({
  calendarIds,
  trades,
  timePeriod,
  selectedDate,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();
  const [selectedImpact, setSelectedImpact] = useState<ImpactLevel>('High');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');

  // Async calculation states
  const [losingTradeCorrelations, setLosingTradeCorrelations] = useState<any[]>([]);
  const [winningTradeCorrelations, setWinningTradeCorrelations] = useState<any[]>([]);
  const [correlationStats, setCorrelationStats] = useState<any>({
    totalLosingTrades: 0,
    totalWinningTrades: 0,
    highImpactLossCorrelationRate: 0,
    mediumImpactLossCorrelationRate: 0,
    anyEventLossCorrelationRate: 0,
    highImpactWinCorrelationRate: 0,
    mediumImpactWinCorrelationRate: 0,
    anyEventWinCorrelationRate: 0,
    losingTradesWithHighImpact: 0,
    losingTradesWithMediumImpact: 0,
    losingTradesWithAnyEvents: 0,
    winningTradesWithHighImpact: 0,
    winningTradesWithMediumImpact: 0,
    winningTradesWithAnyEvents: 0,
    avgLossWithEvents: 0,
    avgLossWithoutEvents: 0,
    avgWinWithEvents: 0,
    avgWinWithoutEvents: 0,
    mostCommonEventTypes: []
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState<CalculationProgress | null>(null);

  // Define tabs for impact level selection
  const impactTabs = [
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
  ];

    
// Currency options for filtering - using same currencies as calendar settings 
const CURRENCIES = useMemo(() => {
  const currencyTags = trades
    .map(trade => trade.tags)
    .flat()
    .filter(tag => tag?.includes('pair:'))
    .map(tag => tag?.split(':')[1])
    .filter((pair): pair is string => pair !== undefined).map(pair => getCurrenciesForPair(pair)).flat();
  
  return Array.from(new Set(currencyTags));
}, [trades]);

const CURRENCY_OPTIONS = [
  { value: 'ALL', label: 'All Currencies' },
  ...CURRENCIES.map(currency => ({ value: currency, label: currency }))
];

  // Convert string value to tab index for RoundedTabs
  const getImpactTabIndex = (currentImpact: ImpactLevel): number => {
    return impactTabs.findIndex(tab => tab.value === currentImpact);
  };

  // Handle tab change for impact level
  const handleImpactTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const newImpact = impactTabs[newIndex]?.value as ImpactLevel;
    if (newImpact) {
      setSelectedImpact(newImpact);
    }
  };

  // Calculate economic event correlations using PostgreSQL RPC function
  useEffect(() => {
    const calculateCorrelations = async () => {
      setIsCalculating(true);
      setCalculationProgress(null);
      try {
        const result = await performanceCalculationService.calculateEconomicEventCorrelations(
          calendarIds,
          selectedCurrency,
          selectedImpact,
          timePeriod,
          selectedDate,
          setCalculationProgress
        );
        setLosingTradeCorrelations(result.losingTradeCorrelations);
        setWinningTradeCorrelations(result.winningTradeCorrelations);
        setCorrelationStats(result.correlationStats);
      } catch (error) {
        console.error('Error calculating economic event correlations:', error);
        setLosingTradeCorrelations([]);
        setWinningTradeCorrelations([]);
        setCorrelationStats({});
      } finally {
        setIsCalculating(false);
        setCalculationProgress(null);
      }
    };

    calculateCorrelations();
  }, [calendarIds, selectedCurrency, selectedImpact, timePeriod, selectedDate]);

  // Get losing and winning trades (kept for legacy compatibility)
  const losingTrades = useMemo(() => {
    return trades.filter(trade => trade.trade_type === 'loss');
  }, [trades]);

  const winningTrades = useMemo(() => {
    return trades.filter(trade => trade.trade_type === 'win');
  }, [trades]);





  // Note: Heavy calculations moved to async service

  // Note: Correlation statistics now calculated asynchronously in service





  if (losingTrades.length === 0 && winningTrades.length === 0) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Analytics sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6">Economic Event Correlation Analysis</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          No trades found for the selected period.
        </Typography>
      </Paper>
    );
  }

  const handleCurrencyChange = (event: SelectChangeEvent<string>) => {
    setSelectedCurrency(event.target.value);
  };

  return (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                display: 'flex',
                alignItems: 'center',
               
                gap: 1,
                color: theme.palette.text.primary,
                fontWeight: 600
              }}
            >
              <Analytics sx={{ color: theme.palette.primary.main }} />
              Economic Event Correlation Analysis
            </Typography>

          </Stack>

          
            <RoundedTabs
              tabs={impactTabs}
              activeTab={getImpactTabIndex(selectedImpact)}
              onTabChange={handleImpactTabChange}
              size="small"
            />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Currency</InputLabel>
            <Select
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              label="Currency"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Alert
          severity="info"
          sx={{
            mb: 2,
            backgroundColor: alpha(theme.palette.info.main, 0.1),
            '& .MuiAlert-icon': {
              color: theme.palette.info.main
            }
          }}
        >
          This analysis correlates your trades with economic events that occurred during the same trading sessions to help identify patterns.
          {selectedCurrency !== 'ALL' && (
            <> Currently filtering events for <strong>{selectedCurrency}</strong> currency.</>
          )}
        </Alert>

        {/* Loading State */}
        {isCalculating && (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
            gap: 2
          }}>
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              Calculating economic event correlations...
            </Typography>
            {calculationProgress && (
              <Box sx={{ width: '100%', maxWidth: 400 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {calculationProgress.step} ({calculationProgress.progress}/{calculationProgress.total})
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(calculationProgress.progress / calculationProgress.total) * 100}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Summary Statistics - Losing Trades */}
        {!isCalculating && (
          <>
            <Typography variant="h6" sx={{ mb: 2, color: 'error.main' }}>
              Losing Trades - {selectedImpact} Impact Events
            </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)'
        },
        gap: 2,
        mb: 3
      }}>
        <Card sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingDown sx={{ color: theme.palette.error.main, mr: 1 }} />
              <Typography variant="body2" color="text.secondary">Total Losing Trades</Typography>
            </Box>
            <Typography variant="h4" color="error.main">
              {correlationStats.totalLosingTrades || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{
          bgcolor: alpha(
            selectedImpact === 'High' ? theme.palette.error.main :
            selectedImpact === 'Medium' ? theme.palette.warning.main :
            selectedImpact === 'Low' ? theme.palette.success.main :
            theme.palette.secondary.main, // Holiday
            0.1
          )
        }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <EventNote sx={{
                color: selectedImpact === 'High' ? theme.palette.error.main :
                       selectedImpact === 'Medium' ? theme.palette.warning.main :
                       selectedImpact === 'Low' ? theme.palette.success.main :
                       theme.palette.secondary.main, // Holiday
                mr: 1
              }} />
              <Typography variant="body2" color="text.secondary">{selectedImpact} Impact Events</Typography>
            </Box>
            <Typography variant="h4" sx={{
              color: selectedImpact === 'High' ? 'error.main' :
                     selectedImpact === 'Medium' ? 'warning.main' :
                     selectedImpact === 'Low' ? 'success.main' :
                     'secondary.main' // Holiday
            }}>
              {(correlationStats.anyEventLossCorrelationRate || 0).toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {correlationStats.losingTradesWithEvents || 0} trades
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Summary Statistics - Winning Trades */}
      <Typography variant="h6" sx={{ mb: 2, color: 'success.main' }}>
      Winning Trades - {selectedImpact} Impact Events
      </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)'
        },
        gap: 2,
        mb: 2
      }}>
        <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUp sx={{ color: theme.palette.success.main, mr: 1 }} />
              <Typography variant="body2" color="text.secondary">Total Winning Trades</Typography>
            </Box>
            <Typography variant="h4" color="success.main">
              {correlationStats.totalWinningTrades || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{
          bgcolor: alpha(
            selectedImpact === 'High' ? theme.palette.error.main :
            selectedImpact === 'Medium' ? theme.palette.warning.main :
            selectedImpact === 'Low' ? theme.palette.success.main :
            theme.palette.secondary.main, // Holiday
            0.1
          )
        }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <EventNote sx={{
                color: selectedImpact === 'High' ? theme.palette.error.main :
                       selectedImpact === 'Medium' ? theme.palette.warning.main :
                       selectedImpact === 'Low' ? theme.palette.success.main :
                       theme.palette.secondary.main, // Holiday
                mr: 1
              }} />
              <Typography variant="body2" color="text.secondary">{selectedImpact} Impact Events</Typography>
            </Box>
            <Typography variant="h4" sx={{
              color: selectedImpact === 'High' ? 'error.main' :
                     selectedImpact === 'Medium' ? 'warning.main' :
                     selectedImpact === 'Low' ? 'success.main' :
                     'secondary.main' // Holiday
            }}>
              {(correlationStats.anyEventWinCorrelationRate || 0).toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {correlationStats.winningTradesWithEvents || 0} trades
            </Typography>
          </CardContent>
        </Card>
      </Box>



        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 2
        }}>
          {/* Average Loss Comparison */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Average Loss Comparison</Typography>
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">With Economic Events</Typography>
                    <Typography variant="body2" color="error.main">
                      {formatValue(correlationStats.avgLossWithEvents || 0)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(correlationStats.avgLossWithEvents || 0) > 0 ? 100 : 0}
                    color="error"
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Without Economic Events</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatValue(correlationStats.avgLossWithoutEvents || 0)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(correlationStats.avgLossWithoutEvents || 0) > 0 ?
                      ((correlationStats.avgLossWithoutEvents || 0) / Math.max((correlationStats.avgLossWithEvents || 0), (correlationStats.avgLossWithoutEvents || 0))) * 100 : 0}
                    color="inherit"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Average Win Comparison */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Average Win Comparison</Typography>
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">With Economic Events</Typography>
                    <Typography variant="body2" color="success.main">
                      {formatValue(correlationStats.avgWinWithEvents || 0)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(correlationStats.avgWinWithEvents || 0) > 0 ? 100 : 0}
                    color="success"
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Without Economic Events</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatValue(correlationStats.avgWinWithoutEvents || 0)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(correlationStats.avgWinWithoutEvents || 0) > 0 ?
                      ((correlationStats.avgWinWithoutEvents || 0) / Math.max((correlationStats.avgWinWithEvents || 0), (correlationStats.avgWinWithoutEvents || 0))) * 100 : 0}
                    color="inherit"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Most Common Event Types */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Most Common Event Types</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {(correlationStats.mostCommonEventTypes || []).map((eventType: any, index: number) => (
                <Card
                  key={index}
                  variant="outlined"
                  sx={{
                    flex: '1 1 300px', // Grow, shrink, with 300px minimum width
                    minWidth: 300,
                    maxWidth: 400
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {eventType.economicEventDetails?.flagCode && (
                            <Box
                              component="img"
                              src={getFlagUrl(eventType.economicEventDetails.flagCode)}
                              alt={eventType.economicEventDetails.flagCode || 'flag'}
                              sx={{
                                width: 20,
                                height: 15,
                                borderRadius: 0.5,
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                // Hide image if it fails to load
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                            {eventType.event}
                          </Typography>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {eventType.count || 0} trades • {(eventType.win_rate || 0).toFixed(1)}% win rate
                        </Typography>
                      </Box>
                      
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      {/* Clickable Losing Trades Section */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: setMultipleTradesDialog && (eventType.losingTrades || []).length > 0 ? 'pointer' : 'default',
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': setMultipleTradesDialog && (eventType.losingTrades || []).length > 0 ? {
                            bgcolor: alpha(theme.palette.error.main, 0.08)
                          } : {}
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setMultipleTradesDialog && (eventType.losingTrades || []).length > 0) {
                            setMultipleTradesDialog({
                              open: true,
                              trades: eventType.losingTrades || [],
                              title: `Losing trades during "${eventType.event}" events`,
                              subtitle: `${(eventType.losingTrades || []).length} losing trades • Avg loss: ${formatValue(eventType.avg_loss)}`
                            });
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {(eventType.losingTrades || []).length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          losses
                        </Typography>
                        <Typography variant="caption" color="error.main" sx={{ fontSize: '0.7rem' }}>
                          ({formatValue(eventType.avg_loss)})
                        </Typography>
                      </Box>

                      <Box sx={{ width: '1px', height: '16px', bgcolor: 'divider' }} />

                      {/* Clickable Winning Trades Section */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: setMultipleTradesDialog && (eventType.winningTrades || []).length > 0 ? 'pointer' : 'default',
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': setMultipleTradesDialog && (eventType.winningTrades || []).length > 0 ? {
                            bgcolor: alpha(theme.palette.success.main, 0.08)
                          } : {}
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setMultipleTradesDialog && (eventType.winningTrades || []).length > 0) {
                            setMultipleTradesDialog({
                              open: true,
                              trades: eventType.winningTrades || [],
                              title: `Winning trades during "${eventType.event}" events`,
                              subtitle: `${(eventType.winningTrades || []).length} winning trades • Avg win: ${formatValue(eventType.avg_win)}`
                            });
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {(eventType.winningTrades || []).length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          wins
                        </Typography>
                        <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                          ({formatValue(eventType.avg_win)})
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
                {(correlationStats.mostCommonEventTypes || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No common event types found
                  </Typography>
                )}
              </Box>
          </CardContent>
        </Card>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default EconomicEventCorrelationAnalysis;
