import React, { useState, useMemo } from 'react';
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
  SelectChangeEvent
} from '@mui/material';
import {
  InfoOutlined,
  Analytics,
  TrendingDown,
  TrendingUp,
  EventNote
} from '@mui/icons-material';
import { Trade, TradeEconomicEvent } from '../../types/trade';
import { ImpactLevel, Currency } from '../../types/economicCalendar';
import { formatValue } from '../../utils/formatters';

import RoundedTabs from '../common/RoundedTabs';
import { Calendar } from '../../types/calendar';
import { DEFAULT_FILTER_SETTINGS } from '../economicCalendar/EconomicCalendarDrawer';

// Helper function to get flag URL
const getFlagUrl = (flagCode?: string, size: string = 'w40'): string => {
  if (!flagCode) return '';
  return `https://flagcdn.com/${size}/${flagCode.toLowerCase()}.png`;
};

interface EconomicEventCorrelationAnalysisProps {
  trades: Trade[];
  calendar: Calendar;
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
  avgLoss: number;
  avgWin: number;
  count: number;
  winRate: number;
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
  trades,
  calendar,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();
  const [selectedImpact, setSelectedImpact] = useState<ImpactLevel>('High');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');

  // Define tabs for impact level selection
  const impactTabs = [
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
  ];

    
// Currency options for filtering - using same currencies as calendar settings
const CURRENCIES = calendar.economicCalendarFilters?.currencies || DEFAULT_FILTER_SETTINGS.currencies
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
 

  // Get losing and winning trades
  const losingTrades = useMemo(() => {
    return trades.filter(trade => trade.type === 'loss');
  }, [trades]);

  const winningTrades = useMemo(() => {
    return trades.filter(trade => trade.type === 'win');
  }, [trades]);





  // Helper function to filter events by selected currency
  const filterEventsByCurrency = (events: TradeEconomicEvent[]): TradeEconomicEvent[] => {
    if (selectedCurrency === 'ALL') {
      return events.filter(event => CURRENCIES.includes(event.currency) && event.impact === selectedImpact);
    }
    return events.filter(event => event.currency === selectedCurrency && event.impact === selectedImpact);
  };

  // Calculate trade-event correlations for both winning and losing trades using stored events
  const losingTradeCorrelations = useMemo((): TradeEventCorrelation[] => {
    return losingTrades.map(trade => {
      // Use stored economic events from the trade, filtered by selected currency
      const allTradeEvents = trade.economicEvents || [];
      const tradeEvents = filterEventsByCurrency(allTradeEvents);

      // Since we only store mid and high impact events, we can determine impact levels
      // For now, we'll treat all stored events as having some impact
      const hasHighImpactEvents = tradeEvents.length > 0; // Simplified - all stored events are considered impactful
      const hasMediumImpactEvents = tradeEvents.length > 0;

      return {
        trade,
        economicEvents: tradeEvents,
        hasHighImpactEvents,
        hasMediumImpactEvents,
        eventCount: tradeEvents.length
      };
    });
  }, [losingTrades, selectedCurrency,selectedImpact]);

  const winningTradeCorrelations = useMemo((): TradeEventCorrelation[] => {
    return winningTrades.map(trade => {
      // Use stored economic events from the trade, filtered by selected currency
      const allTradeEvents = trade.economicEvents || [];
      const tradeEvents = filterEventsByCurrency(allTradeEvents);

      // Since we only store mid and high impact events, we can determine impact levels
      // For now, we'll treat all stored events as having some impact
      const hasHighImpactEvents = tradeEvents.length > 0; // Simplified - all stored events are considered impactful
      const hasMediumImpactEvents = tradeEvents.length > 0;

      return {
        trade,
        economicEvents: tradeEvents,
        hasHighImpactEvents,
        hasMediumImpactEvents,
        eventCount: tradeEvents.length
      };
    });
  }, [winningTrades, selectedCurrency]);

  // Calculate correlation statistics
  const correlationStats = useMemo((): CorrelationStats => {
    const totalLosingTrades = losingTradeCorrelations.length;
    const totalWinningTrades = winningTradeCorrelations.length;

    if (totalLosingTrades === 0 && totalWinningTrades === 0) {
      return {
        // Losing trades stats
        totalLosingTrades: 0,
        losingTradesWithHighImpact: 0,
        losingTradesWithMediumImpact: 0,
        losingTradesWithAnyEvents: 0,
        highImpactLossCorrelationRate: 0,
        mediumImpactLossCorrelationRate: 0,
        anyEventLossCorrelationRate: 0,
        avgLossWithEvents: 0,
        avgLossWithoutEvents: 0,

        // Winning trades stats
        totalWinningTrades: 0,
        winningTradesWithHighImpact: 0,
        winningTradesWithMediumImpact: 0,
        winningTradesWithAnyEvents: 0,
        highImpactWinCorrelationRate: 0,
        mediumImpactWinCorrelationRate: 0,
        anyEventWinCorrelationRate: 0,
        avgWinWithEvents: 0,
        avgWinWithoutEvents: 0,

        // Combined stats
        mostCommonEventTypes: [],
        impactDistribution: { 'Low': 0, 'Medium': 0, 'High': 0, 'Holiday': 0, 'Non-Economic': 0 }
      };
    }

    // Since we're now fetching only events for the selected impact level,
    // any trade with events has events of the selected impact level
    const losingTradesWithSelectedImpact = losingTradeCorrelations.filter(tc => tc.eventCount > 0);
    const losingTradesWithAnyEvents = losingTradesWithSelectedImpact; // Same as selected impact now

    // For display purposes, we'll use the selected impact data for all calculations
    const selectedImpactLossCorrelationRate = totalLosingTrades > 0 ? (losingTradesWithSelectedImpact.length / totalLosingTrades) * 100 : 0;

    // Use selected impact rate for all legacy fields to maintain UI compatibility
    const highImpactLossCorrelationRate = selectedImpactLossCorrelationRate;
    const mediumImpactLossCorrelationRate = selectedImpactLossCorrelationRate;
    const anyEventLossCorrelationRate = selectedImpactLossCorrelationRate;

    // Winning trades calculations - same logic as losing trades
    const winningTradesWithSelectedImpact = winningTradeCorrelations.filter(tc => tc.eventCount > 0);
    const winningTradesWithAnyEvents = winningTradesWithSelectedImpact; // Same as selected impact now

    const selectedImpactWinCorrelationRate = totalWinningTrades > 0 ? (winningTradesWithSelectedImpact.length / totalWinningTrades) * 100 : 0;

    // Use selected impact rate for all legacy fields to maintain UI compatibility
    const highImpactWinCorrelationRate = selectedImpactWinCorrelationRate;
    const mediumImpactWinCorrelationRate = selectedImpactWinCorrelationRate;
    const anyEventWinCorrelationRate = selectedImpactWinCorrelationRate;

    // Calculate average losses
    const losingTradesWithEvents = losingTradeCorrelations.filter(tc => tc.eventCount > 0);
    const losingTradesWithoutEvents = losingTradeCorrelations.filter(tc => tc.eventCount === 0);

    const avgLossWithEvents = losingTradesWithEvents.length > 0
      ? losingTradesWithEvents.reduce((sum, tc) => sum + Math.abs(tc.trade.amount), 0) / losingTradesWithEvents.length
      : 0;

    const avgLossWithoutEvents = losingTradesWithoutEvents.length > 0
      ? losingTradesWithoutEvents.reduce((sum, tc) => sum + Math.abs(tc.trade.amount), 0) / losingTradesWithoutEvents.length
      : 0;

    // Calculate average wins
    const winningTradesWithEvents = winningTradeCorrelations.filter(tc => tc.eventCount > 0);
    const winningTradesWithoutEvents = winningTradeCorrelations.filter(tc => tc.eventCount === 0);

    const avgWinWithEvents = winningTradesWithEvents.length > 0
      ? winningTradesWithEvents.reduce((sum, tc) => sum + tc.trade.amount, 0) / winningTradesWithEvents.length
      : 0;

    const avgWinWithoutEvents = winningTradesWithoutEvents.length > 0
      ? winningTradesWithoutEvents.reduce((sum, tc) => sum + tc.trade.amount, 0) / winningTradesWithoutEvents.length
      : 0;

    // Find most common event types with detailed trade information
    const eventTypeMap = new Map<string, {
      losingTrades: Trade[];
      winningTrades: Trade[];
      totalLoss: number;
      totalWin: number;
      economicEventDetails?: {
        flagCode?: string;
        flagUrl?: string;
      };
    }>();

    // Process losing trades
    losingTradeCorrelations.forEach(tc => {
      tc.economicEvents.forEach(event => {
        const existing = eventTypeMap.get(event.name) || {
          losingTrades: [],
          winningTrades: [],
          totalLoss: 0,
          totalWin: 0
        };
        existing.losingTrades.push(tc.trade);
        existing.totalLoss += Math.abs(tc.trade.amount);

        // Store economic event details (use first occurrence)
        if (!existing.economicEventDetails) {
          existing.economicEventDetails = {
            flagCode: event.flagCode,
            flagUrl: getFlagUrl(event.flagCode)
          };
        }

        eventTypeMap.set(event.name, existing);
      });
    });

    // Process winning trades
    winningTradeCorrelations.forEach(tc => {
      tc.economicEvents.forEach(event => {
        const existing = eventTypeMap.get(event.name) || {
          losingTrades: [],
          winningTrades: [],
          totalLoss: 0,
          totalWin: 0
        };
        existing.winningTrades.push(tc.trade);
        existing.totalWin += tc.trade.amount;

        // Store economic event details (use first occurrence)
        if (!existing.economicEventDetails) {
          existing.economicEventDetails = {
            flagCode: event.flagCode,
            flagUrl: getFlagUrl(event.flagCode)
          };
        }

        eventTypeMap.set(event.name, existing);
      });
    });

    const mostCommonEventTypes: EventTradeDetails[] = Array.from(eventTypeMap.entries())
      .map(([event, data]) => {
        const totalTrades = data.losingTrades.length + data.winningTrades.length;
        const winRate = totalTrades > 0 ? (data.winningTrades.length / totalTrades) * 100 : 0;

        return {
          event,
          losingTrades: data.losingTrades,
          winningTrades: data.winningTrades,
          totalLoss: data.totalLoss,
          totalWin: data.totalWin,
          avgLoss: data.losingTrades.length > 0 ? data.totalLoss / data.losingTrades.length : 0,
          avgWin: data.winningTrades.length > 0 ? data.totalWin / data.winningTrades.length : 0,
          count: totalTrades,
          winRate,
          economicEventDetails: data.economicEventDetails
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Impact distribution
    const impactDistribution: Record<ImpactLevel, number> = {
      'Low': 0, 'Medium': 0, 'High': 0, 'Holiday': 0, 'Non-Economic': 0
    };

    [...losingTradeCorrelations, ...winningTradeCorrelations].forEach(tc => {
      tc.economicEvents.forEach(event => {
        impactDistribution[event.impact]++;
      });
    });

    return {
      // Losing trades stats
      totalLosingTrades,
      losingTradesWithHighImpact: losingTradesWithSelectedImpact.length,
      losingTradesWithMediumImpact: losingTradesWithSelectedImpact.length,
      losingTradesWithAnyEvents: losingTradesWithAnyEvents.length,
      highImpactLossCorrelationRate,
      mediumImpactLossCorrelationRate,
      anyEventLossCorrelationRate,
      avgLossWithEvents,
      avgLossWithoutEvents,

      // Winning trades stats
      totalWinningTrades,
      winningTradesWithHighImpact: winningTradesWithSelectedImpact.length,
      winningTradesWithMediumImpact: winningTradesWithSelectedImpact.length,
      winningTradesWithAnyEvents: winningTradesWithAnyEvents.length,
      highImpactWinCorrelationRate,
      mediumImpactWinCorrelationRate,
      anyEventWinCorrelationRate,
      avgWinWithEvents,
      avgWinWithoutEvents,

      // Combined stats
      mostCommonEventTypes,
      impactDistribution
    };
  }, [losingTradeCorrelations, winningTradeCorrelations, selectedCurrency]);





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

      {/* Summary Statistics - Losing Trades */}
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
              {correlationStats.totalLosingTrades}
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
              {selectedImpact === 'High' ? correlationStats.highImpactLossCorrelationRate.toFixed(1) :
               selectedImpact === 'Medium' ? correlationStats.mediumImpactLossCorrelationRate.toFixed(1) :
               correlationStats.anyEventLossCorrelationRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedImpact === 'High' ? correlationStats.losingTradesWithHighImpact :
               selectedImpact === 'Medium' ? correlationStats.losingTradesWithMediumImpact :
               correlationStats.losingTradesWithAnyEvents} trades
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
              {correlationStats.totalWinningTrades}
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
              {selectedImpact === 'High' ? correlationStats.highImpactWinCorrelationRate.toFixed(1) :
               selectedImpact === 'Medium' ? correlationStats.mediumImpactWinCorrelationRate.toFixed(1) :
               correlationStats.anyEventWinCorrelationRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedImpact === 'High' ? correlationStats.winningTradesWithHighImpact :
               selectedImpact === 'Medium' ? correlationStats.winningTradesWithMediumImpact :
               correlationStats.winningTradesWithAnyEvents} trades
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
                      {formatValue(correlationStats.avgLossWithEvents)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={correlationStats.avgLossWithEvents > 0 ? 100 : 0}
                    color="error"
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Without Economic Events</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatValue(correlationStats.avgLossWithoutEvents)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={correlationStats.avgLossWithoutEvents > 0 ?
                      (correlationStats.avgLossWithoutEvents / Math.max(correlationStats.avgLossWithEvents, correlationStats.avgLossWithoutEvents)) * 100 : 0}
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
                      {formatValue(correlationStats.avgWinWithEvents)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={correlationStats.avgWinWithEvents > 0 ? 100 : 0}
                    color="success"
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Without Economic Events</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatValue(correlationStats.avgWinWithoutEvents)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={correlationStats.avgWinWithoutEvents > 0 ?
                      (correlationStats.avgWinWithoutEvents / Math.max(correlationStats.avgWinWithEvents, correlationStats.avgWinWithoutEvents)) * 100 : 0}
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
                {correlationStats.mostCommonEventTypes.map((eventType, index) => (
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
                          {eventType.count} trades • {eventType.winRate.toFixed(1)}% win rate
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
                          cursor: setMultipleTradesDialog && eventType.losingTrades.length > 0 ? 'pointer' : 'default',
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': setMultipleTradesDialog && eventType.losingTrades.length > 0 ? {
                            bgcolor: alpha(theme.palette.error.main, 0.08)
                          } : {}
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setMultipleTradesDialog && eventType.losingTrades.length > 0) {
                            setMultipleTradesDialog({
                              open: true,
                              trades: eventType.losingTrades,
                              title: `Losing trades during "${eventType.event}" events`,
                              subtitle: `${eventType.losingTrades.length} losing trades • Avg loss: ${formatValue(eventType.avgLoss)}`
                            });
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {eventType.losingTrades.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          losses
                        </Typography>
                        <Typography variant="caption" color="error.main" sx={{ fontSize: '0.7rem' }}>
                          ({formatValue(eventType.avgLoss)})
                        </Typography>
                      </Box>

                      <Box sx={{ width: '1px', height: '16px', bgcolor: 'divider' }} />

                      {/* Clickable Winning Trades Section */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: setMultipleTradesDialog && eventType.winningTrades.length > 0 ? 'pointer' : 'default',
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': setMultipleTradesDialog && eventType.winningTrades.length > 0 ? {
                            bgcolor: alpha(theme.palette.success.main, 0.08)
                          } : {}
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setMultipleTradesDialog && eventType.winningTrades.length > 0) {
                            setMultipleTradesDialog({
                              open: true,
                              trades: eventType.winningTrades,
                              title: `Winning trades during "${eventType.event}" events`,
                              subtitle: `${eventType.winningTrades.length} winning trades • Avg win: ${formatValue(eventType.avgWin)}`
                            });
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {eventType.winningTrades.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          wins
                        </Typography>
                        <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                          ({formatValue(eventType.avgWin)})
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
                {correlationStats.mostCommonEventTypes.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No common event types found
                  </Typography>
                )}
              </Box>
          </CardContent>
        </Card>
      </Box>
    </Paper>
  );
};

export default EconomicEventCorrelationAnalysis;
