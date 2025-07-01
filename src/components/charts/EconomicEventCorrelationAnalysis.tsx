import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Stack,
  alpha,
  IconButton,
  Collapse
} from '@mui/material';
import {
  InfoOutlined,
  Analytics,
  TrendingDown,
  TrendingUp,
  EventNote,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { format, isSameDay, parseISO } from 'date-fns';
import { Trade } from '../../types/trade';
import { EconomicEvent, ImpactLevel, Currency } from '../../types/economicCalendar';
import { economicCalendarService } from '../../services/economicCalendarService';
import { formatValue } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import RoundedTabs from '../common/RoundedTabs';

// Helper function to get flag URL
const getFlagUrl = (flagCode?: string, size: string = 'w40'): string => {
  if (!flagCode) return '';
  return `https://flagcdn.com/${size}/${flagCode.toLowerCase()}.png`;
};

interface EconomicEventCorrelationAnalysisProps {
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'year' | 'all';
  calendar?: {
    economicCalendarFilters?: {
      currencies: string[];
      impacts: string[];
      viewType: 'day' | 'week' | 'month';
    };
  };
  setMultipleTradesDialog?: (dialogState: any) => void;
}

interface TradeEventCorrelation {
  trade: Trade;
  economicEvents: EconomicEvent[];
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
    currency: Currency;
    impact: ImpactLevel;
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
  selectedDate,
  timePeriod,
  calendar,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImpact, setSelectedImpact] = useState<ImpactLevel>('High');
  const [expanded, setExpanded] = useState(false);

  // Define tabs for impact level selection
  const impactTabs = [
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
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

  // Filter trades based on time period
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (timePeriod === 'month') {
        return trade.date.getMonth() === selectedDate.getMonth() && 
               trade.date.getFullYear() === selectedDate.getFullYear();
      } else if (timePeriod === 'year') {
        return trade.date.getFullYear() === selectedDate.getFullYear();
      }
      return true; // 'all' period
    });
  }, [trades, selectedDate, timePeriod]);

  // Get losing and winning trades
  const losingTrades = useMemo(() => {
    return filteredTrades.filter(trade => trade.type === 'loss');
  }, [filteredTrades]);

  const winningTrades = useMemo(() => {
    return filteredTrades.filter(trade => trade.type === 'win');
  }, [filteredTrades]);

  const allRelevantTrades = useMemo(() => {
    return [...losingTrades, ...winningTrades];
  }, [losingTrades, winningTrades]);

  // Helper function to get session time ranges in UTC
  const getSessionTimeRange = (session: string, tradeDate: Date): { start: Date; end: Date } => {
    const year = tradeDate.getFullYear();
    const month = tradeDate.getMonth();
    const day = tradeDate.getDate();

    // Determine if it's daylight saving time (approximate: March-October)
    const isDST = month >= 2 && month <= 9;

    let startHour: number, endHour: number;

    switch (session) {
      case 'London':
        startHour = isDST ? 7 : 8;  // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)
        endHour = isDST ? 16 : 17;  // 4:00 PM UTC (summer) / 5:00 PM UTC (winter)
        break;
      case 'NY AM':
        startHour = isDST ? 12 : 13; // 12:00 PM UTC (summer) / 1:00 PM UTC (winter)
        endHour = isDST ? 17 : 18;   // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
        break;
      case 'NY PM':
        startHour = isDST ? 17 : 18; // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
        endHour = isDST ? 21 : 22;   // 9:00 PM UTC (summer) / 10:00 PM UTC (winter)
        break;
      case 'Asia':
        // Asia session spans midnight, so we need to handle day boundaries
        const asiaStartHour = isDST ? 22 : 23; // 10:00 PM UTC (summer) / 11:00 PM UTC (winter)
        const asiaEndHour = isDST ? 7 : 8;     // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)

        // Start time is on the previous day
        const startDate = new Date(year, month, day - 1, asiaStartHour, 0, 0);
        const endDate = new Date(year, month, day, asiaEndHour, 0, 0);
        return { start: startDate, end: endDate };
      default:
        // Default to full day range if session is unknown
        startHour = 0;
        endHour = 23;
    }

    const start = new Date(year, month, day, startHour, 0, 0);
    const end = new Date(year, month, day, endHour, 59, 59);

    return { start, end };
  };

  // Fetch economic events for the date range based on selected impact level
  useEffect(() => {
    const fetchEconomicEvents = async () => {
      if (allRelevantTrades.length === 0 || !expanded) return;

      setLoading(true);
      setError(null);

      try {
        // Calculate optimized date range based on trade sessions
        let overallStartDate: Date | null = null;
        let overallEndDate: Date | null = null;

        allRelevantTrades.forEach(trade => {
          if (trade.session) {
            const sessionRange = getSessionTimeRange(trade.session, trade.date);

            if (!overallStartDate || sessionRange.start < overallStartDate) {
              overallStartDate = sessionRange.start;
            }
            if (!overallEndDate || sessionRange.end > overallEndDate) {
              overallEndDate = sessionRange.end;
            }
          } else {
            // Fallback for trades without session info - use full day
            const tradeStart = new Date(trade.date.getFullYear(), trade.date.getMonth(), trade.date.getDate(), 0, 0, 0);
            const tradeEnd = new Date(trade.date.getFullYear(), trade.date.getMonth(), trade.date.getDate(), 23, 59, 59);

            if (!overallStartDate || tradeStart < overallStartDate) {
              overallStartDate = tradeStart;
            }
            if (!overallEndDate || tradeEnd > overallEndDate) {
              overallEndDate = tradeEnd;
            }
          }
        });

        // Fallback to simple date range if no session-specific ranges found
        if (!overallStartDate || !overallEndDate) {
          const tradeDates = allRelevantTrades.map(trade => trade.date);
          overallStartDate = new Date(Math.min(...tradeDates.map(d => d.getTime())));
          overallEndDate = new Date(Math.max(...tradeDates.map(d => d.getTime())));
        }

        const dateRange = {
          start: format(overallStartDate, 'yyyy-MM-dd'),
          end: format(overallEndDate, 'yyyy-MM-dd')
        };

        const filterSettings = calendar?.economicCalendarFilters;
        // Only fetch events for the selected impact level to reduce data transfer
        const events = await economicCalendarService.fetchEvents(dateRange, {
          currencies: filterSettings?.currencies as Currency[] || ['USD', 'EUR', 'GBP'],
          impacts: [selectedImpact] // Fetch only the selected impact level
        });

        setEconomicEvents(events);
        logger.log(`📊 Fetched ${events.length} ${selectedImpact} impact economic events for session-optimized correlation analysis`);
        logger.log(`📅 Date range optimized from ${format(overallStartDate, 'yyyy-MM-dd HH:mm')} to ${format(overallEndDate, 'yyyy-MM-dd HH:mm')}`);
      } catch (err) {
        logger.error('Failed to fetch economic events for correlation analysis:', err);
        setError('Failed to load economic events data');
      } finally {
        setLoading(false);
      }
    };

    fetchEconomicEvents();
  }, [selectedImpact, expanded, allRelevantTrades.length, calendar?.economicCalendarFilters]);

  // Helper function to check if an economic event falls within a trade's session range
  const isEventInTradeSession = (event: EconomicEvent, trade: Trade): boolean => {
    if (!trade.session) {
      // If trade has no session, fall back to same day matching
      const eventDate = parseISO(event.date);
      return isSameDay(trade.date, eventDate);
    }

    // Get the session time range for the trade
    const sessionRange = getSessionTimeRange(trade.session, trade.date);

    // Parse the event time (assuming it's in UTC)
    const eventTime = parseISO(event.timeUtc || event.time);

    // Check if event time falls within the session range
    return eventTime >= sessionRange.start && eventTime <= sessionRange.end;
  };

  // Calculate trade-event correlations for both winning and losing trades
  const losingTradeCorrelations = useMemo((): TradeEventCorrelation[] => {
    return losingTrades.map(trade => {
      // Find events within the trade's session range
      const tradeEvents = economicEvents.filter(event => isEventInTradeSession(event, trade));

      const hasHighImpactEvents = tradeEvents.some(event => event.impact === 'High');
      const hasMediumImpactEvents = tradeEvents.some(event => event.impact === 'Medium');

      return {
        trade,
        economicEvents: tradeEvents,
        hasHighImpactEvents,
        hasMediumImpactEvents,
        eventCount: tradeEvents.length
      };
    });
  }, [losingTrades, economicEvents]);

  const winningTradeCorrelations = useMemo((): TradeEventCorrelation[] => {
    return winningTrades.map(trade => {
      // Find events within the trade's session range
      const tradeEvents = economicEvents.filter(event => isEventInTradeSession(event, trade));

      const hasHighImpactEvents = tradeEvents.some(event => event.impact === 'High');
      const hasMediumImpactEvents = tradeEvents.some(event => event.impact === 'Medium');

      return {
        trade,
        economicEvents: tradeEvents,
        hasHighImpactEvents,
        hasMediumImpactEvents,
        eventCount: tradeEvents.length
      };
    });
  }, [winningTrades, economicEvents]);

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
        country?: string;
        flagCode?: string;
        flagUrl?: string;
        currency: Currency;
        impact: ImpactLevel;
      };
    }>();

    // Process losing trades
    losingTradeCorrelations.forEach(tc => {
      tc.economicEvents.forEach(event => {
        const existing = eventTypeMap.get(event.event) || {
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
            country: event.country,
            flagCode: event.flagCode,
            flagUrl: event.flagUrl,
            currency: event.currency,
            impact: event.impact
          };
        }

        eventTypeMap.set(event.event, existing);
      });
    });

    // Process winning trades
    winningTradeCorrelations.forEach(tc => {
      tc.economicEvents.forEach(event => {
        const existing = eventTypeMap.get(event.event) || {
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
            country: event.country,
            flagCode: event.flagCode,
            flagUrl: event.flagUrl,
            currency: event.currency,
            impact: event.impact
          };
        }

        eventTypeMap.set(event.event, existing);
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
  }, [losingTradeCorrelations, winningTradeCorrelations, selectedImpact]);



  if (error) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

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

  return (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 3, pb: expanded ? 0 : 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: expanded ? 2 : 0 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                fontWeight: 600,
                color: theme.palette.text.primary
              }}
            >
              <Analytics sx={{ mr: 1, color: theme.palette.primary.main }} />
              Economic Event Correlation Analysis
            </Typography>

            {expanded && (
              <RoundedTabs
                tabs={impactTabs}
                activeTab={getImpactTabIndex(selectedImpact)}
                onTabChange={handleImpactTabChange}
                size="small"
               
              />
            )}
          </Stack>

          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{ color: theme.palette.text.secondary }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>

        {expanded && (
          <Typography
            variant="body2"
            sx={{
              mb: 3,
              color: theme.palette.text.secondary,
              lineHeight: 1.6,
              maxWidth: '100%'
            }}
          >
            Analyze how economic events impact your trading performance during specific sessions.
            This analysis correlates your trades with market-moving events to help you identify optimal trading times,
            improve risk management, and develop session-specific strategies based on historical event patterns.
          </Typography>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>

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
            {loading ? (
              <Box sx={{ py: 3 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                  Analyzing correlation between trades and economic events...
                </Typography>
              </Box>
            ) : (
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
                              alt={eventType.economicEventDetails.country || eventType.economicEventDetails.currency}
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
                      {setMultipleTradesDialog && (
                        <InfoOutlined
                          fontSize="small"
                          sx={{
                            color: 'text.secondary',
                            ml: 1,
                            opacity: 0.7
                          }}
                        />
                      )}
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
            )}
          </CardContent>
        </Card>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default EconomicEventCorrelationAnalysis;
