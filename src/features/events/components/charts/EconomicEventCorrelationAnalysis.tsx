import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Analytics,
  TrendingDown,
  TrendingUp,
  EventNote,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Trade } from 'features/calendar/types/dualWrite';
import { ImpactLevel } from 'features/events/types/economicCalendar';
import { cleanEventNameForPinning } from 'features/events/utils/eventNameUtils';
import { formatValue } from 'utils/formatters';

import RoundedTabs from 'components/common/RoundedTabs';
import { getCurrenciesForInstrument } from 'features/events/services/instrumentCatalog';
import { getSessionForTimestamp } from 'utils/sessionTimeUtils';
import { EYEBROW_SX, TNUM, getInsetSurface, getInsetTileSx } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import StatTile from 'components/common/StatTile';
import EyebrowRow from 'components/common/EyebrowRow';
import InfoStrip from 'components/common/InfoStrip';
import CompareBar from 'components/common/CompareBar';

const getFlagUrl = (flagCode?: string, size: string = 'w40'): string => {
  if (!flagCode) return '';
  return `https://flagcdn.com/${size}/${flagCode.toLowerCase()}.png`;
};

interface EconomicEventCorrelationAnalysisProps {
  calendarId: string;
  trades: Trade[];
  timePeriod: 'month' | 'quarter' | 'ytd' | 'year' | 'all';
  selectedDate: Date;
  setMultipleTradesDialog?: (dialogState: any) => void;
  economicCorrelations?: any;
}

const EconomicEventCorrelationAnalysis: React.FC<EconomicEventCorrelationAnalysisProps> = ({
  trades,
  setMultipleTradesDialog,
  economicCorrelations,
}) => {
  const theme = useTheme();
  const [selectedImpact, setSelectedImpact] = useState<ImpactLevel>('High');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [eventSearch, setEventSearch] = useState<string>('');
  const [groupEvents, setGroupEvents] = useState<boolean>(false);
  const [correlationStats, setCorrelationStats] = useState<any>({});
  const [isCalculating] = useState(false);

  const impactTabs = useMemo(
    () => [
      { label: 'High', value: 'High' },
      { label: 'Medium', value: 'Medium' },
    ],
    [],
  );

  const CURRENCIES = useMemo(() => {
    const currencyTags = trades
      .map((trade) => trade.tags)
      .flat()
      .filter((tag) => tag?.includes('Asset:'))
      .map((tag) => tag?.split(':')[1])
      .filter((symbol): symbol is string => symbol !== undefined)
      .map((symbol) => getCurrenciesForInstrument(symbol))
      .flat();
    return Array.from(new Set(currencyTags));
  }, [trades]);

  const CURRENCY_OPTIONS = useMemo(
    () => [
      { value: 'ALL', label: 'All Currencies' },
      ...CURRENCIES.map((currency) => ({ value: currency, label: currency })),
    ],
    [CURRENCIES],
  );

  const getImpactTabIndex = (currentImpact: ImpactLevel): number =>
    impactTabs.findIndex((tab) => tab.value === currentImpact);

  const handleImpactTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const newImpact = impactTabs[newIndex]?.value as ImpactLevel;
    if (newImpact) setSelectedImpact(newImpact);
  };

  const handleCurrencyChange = (event: SelectChangeEvent<string>) =>
    setSelectedCurrency(event.target.value);

  // ── Per-impact server payload → session-filtered + rehydrated stats ──
  useEffect(() => {
    if (!economicCorrelations) {
      setCorrelationStats({});
      return;
    }
    const impactData =
      selectedImpact === 'High' ? economicCorrelations.high : economicCorrelations.medium;
    if (!impactData) {
      setCorrelationStats({});
      return;
    }

    // Server emits losing_trade_ids / winning_trade_ids (UUID arrays) instead
    // of full rows. Rehydrate from the top-level `trades` prop; fall back to
    // legacy full-row payloads (losingTrades / winningTrades).
    const tradesById = new Map<string, Trade>();
    trades.forEach((t) => {
      if (t?.id) tradesById.set(String(t.id), t);
    });
    const rehydrate = (eventType: any, key: 'losing' | 'winning'): Trade[] => {
      const idsKey = key === 'losing' ? 'losing_trade_ids' : 'winning_trade_ids';
      const fullKey = key === 'losing' ? 'losingTrades' : 'winningTrades';
      const ids: any[] | undefined = eventType?.[idsKey];
      if (Array.isArray(ids)) {
        const out: Trade[] = [];
        for (const id of ids) {
          const t = tradesById.get(String(id));
          if (t) out.push(t);
        }
        return out;
      }
      return Array.isArray(eventType?.[fullKey]) ? eventType[fullKey] : [];
    };

    const stats = { ...(impactData.correlationStats || {}) };
    if (stats.mostCommonEventTypes) {
      stats.mostCommonEventTypes = stats.mostCommonEventTypes
        .map((eventType: any) => {
          const losingHydrated = rehydrate(eventType, 'losing');
          const winningHydrated = rehydrate(eventType, 'winning');
          const filterTradesBySession = (rows: any[]) => {
            if (!rows) return [];
            return rows.filter((trade: any) => {
              if (!trade.session) return true;
              let events: any[] = trade.economic_events || [];
              if (typeof events === 'string') {
                try {
                  events = JSON.parse(events);
                } catch {
                  return true;
                }
              }
              if (!Array.isArray(events) || events.length === 0) return true;
              const eventName = eventType.event;
              const eventCurrency = eventType.currency;
              const matchingEvent =
                events.find(
                  (e: any) =>
                    e.name === eventName &&
                    (!eventCurrency || e.currency === eventCurrency),
                ) ||
                events.find(
                  (e: any) =>
                    e.name?.toLowerCase() === eventName?.toLowerCase() &&
                    (!eventCurrency ||
                      e.currency?.toLowerCase() === eventCurrency?.toLowerCase()),
                );
              if (!matchingEvent?.time_utc) return true;
              const eventSession = getSessionForTimestamp(matchingEvent.time_utc);
              return !eventSession || trade.session === eventSession;
            });
          };

          const filteredLosing = filterTradesBySession(losingHydrated);
          const filteredWinning = filterTradesBySession(winningHydrated);
          const losingCount = filteredLosing.length;
          const winningCount = filteredWinning.length;
          const totalCount = losingCount + winningCount;
          const totalLoss = filteredLosing.reduce(
            (sum: number, t: any) => sum + Math.abs(t.amount || 0),
            0,
          );
          const totalWin = filteredWinning.reduce(
            (sum: number, t: any) => sum + (t.amount || 0),
            0,
          );
          return {
            ...eventType,
            losingTrades: filteredLosing,
            winningTrades: filteredWinning,
            count: totalCount,
            totalLoss,
            totalWin,
            avg_loss: losingCount > 0 ? totalLoss / losingCount : 0,
            avg_win: winningCount > 0 ? totalWin / winningCount : 0,
            win_rate: totalCount > 0 ? (winningCount / totalCount) * 100 : 0,
          };
        })
        .filter((eventType: any) => eventType.count > 0);
    }
    setCorrelationStats(stats);
  }, [economicCorrelations, selectedImpact, selectedCurrency, trades]);

  const losingTrades = useMemo(
    () => trades.filter((trade) => trade.trade_type === 'loss'),
    [trades],
  );
  const winningTrades = useMemo(
    () => trades.filter((trade) => trade.trade_type === 'win'),
    [trades],
  );

  const insetBg = getInsetSurface(theme);

  // Header band content for CardShell — title + eyebrow + right controls.
  const headerControls = (
    <>
      <RoundedTabs
        tabs={impactTabs}
        activeTab={getImpactTabIndex(selectedImpact)}
        onTabChange={handleImpactTabChange}
        size="small"
      />
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Currency</InputLabel>
        <Select value={selectedCurrency} onChange={handleCurrencyChange} label="Currency">
          {CURRENCY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );

  const cardHead = {
    icon: <Analytics sx={{ fontSize: 16 }} />,
    title: 'Economic Event Correlation',
    eyebrow: `${selectedImpact} impact · ${selectedCurrency === 'ALL' ? 'All currencies' : selectedCurrency}`,
    right: headerControls,
  };

  // ── Empty state ─────────────────────────────────────────────────────
  if (losingTrades.length === 0 && winningTrades.length === 0) {
    return (
      <CardShell head={cardHead} sx={{ mb: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No trades found for the selected period.
          </Typography>
        </Box>
      </CardShell>
    );
  }

  // ── Derived figures for tiles ───────────────────────────────────────
  const lossPct = correlationStats.anyEventLossCorrelationRate || 0;
  const winPct = correlationStats.anyEventWinCorrelationRate || 0;
  const totalLosing = correlationStats.totalLosingTrades || 0;
  const totalWinning = correlationStats.totalWinningTrades || 0;
  const losingWithEvents = correlationStats.losingTradesWithEvents || 0;
  const winningWithEvents = correlationStats.winningTradesWithEvents || 0;
  const avgLossWith = correlationStats.avgLossWithEvents || 0;
  const avgLossNo = correlationStats.avgLossWithoutEvents || 0;
  const avgWinWith = correlationStats.avgWinWithEvents || 0;
  const avgWinNo = correlationStats.avgWinWithoutEvents || 0;
  const lossBarMax = Math.max(Math.abs(avgLossWith), Math.abs(avgLossNo), 1);
  const winBarMax = Math.max(avgWinWith, avgWinNo, 1);

  // ── Most-common-events: optional grouping + search filter ───────────
  const eventList = (() => {
    let events: any[] = correlationStats.mostCommonEventTypes || [];
    if (groupEvents) {
      const grouped = new Map<string, any>();
      events.forEach((eventType: any) => {
        const cleanedName = cleanEventNameForPinning(eventType.event);
        const key = `${cleanedName}::${eventType.currency || ''}`;
        if (grouped.has(key)) {
          const existing = grouped.get(key);
          const mergedLosing = [
            ...(existing.losingTrades || []),
            ...(eventType.losingTrades || []),
          ];
          const mergedWinning = [
            ...(existing.winningTrades || []),
            ...(eventType.winningTrades || []),
          ];
          const losingCount = mergedLosing.length;
          const winningCount = mergedWinning.length;
          const totalCount = losingCount + winningCount;
          const totalLoss = mergedLosing.reduce(
            (s: number, t: any) => s + Math.abs(t.amount || 0),
            0,
          );
          const totalWin = mergedWinning.reduce(
            (s: number, t: any) => s + (t.amount || 0),
            0,
          );
          grouped.set(key, {
            ...existing,
            event: cleanedName,
            losingTrades: mergedLosing,
            winningTrades: mergedWinning,
            count: totalCount,
            totalLoss,
            totalWin,
            avg_loss: losingCount > 0 ? totalLoss / losingCount : 0,
            avg_win: winningCount > 0 ? totalWin / winningCount : 0,
            win_rate: totalCount > 0 ? (winningCount / totalCount) * 100 : 0,
          });
        } else {
          grouped.set(key, { ...eventType, event: cleanedName });
        }
      });
      events = Array.from(grouped.values()).sort((a: any, b: any) => b.count - a.count);
    }
    return events
      .filter((eventType: any) => {
        if (!eventSearch.trim()) return true;
        const query = eventSearch.toLowerCase();
        return (
          eventType.event?.toLowerCase().includes(query) ||
          eventType.currency?.toLowerCase().includes(query)
        );
      })
      .slice(0, eventSearch.trim() ? 20 : 9);
  })();

  const totalEventTypes = correlationStats.mostCommonEventTypes?.length || 0;

  // Reusable mini-section: eyebrow row + 2 stat tiles for losing/winning summary.
  const renderSummaryGroup = (
    accent: string,
    label: string,
    rightLabel: string,
    countLabel: string,
    total: number,
    pct: number,
    withEvents: number,
    DownIcon: React.ReactNode,
    EvIcon: React.ReactNode,
  ) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <EyebrowRow accent={accent} label={label} rightLabel={rightLabel} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <StatTile
          icon={DownIcon}
          label={countLabel}
          value={total}
          valueColor={accent}
        />
        <StatTile
          icon={EvIcon}
          label="Tied to events"
          value={`${pct.toFixed(1)}%`}
          valueColor={accent}
          subtitle={`${withEvents} of ${total} trades`}
        />
      </Box>
    </Box>
  );

  // Reusable mini-section: "with events" vs "without events" comparison card.
  const renderCompareCard = (
    title: string,
    accent: string,
    withVal: number,
    noVal: number,
    barMax: number,
  ) => (
    <Box
      sx={{
        ...getInsetTileSx(theme),
        p: 1.75,
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <EyebrowRow accent={accent} label={title} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {[
          { label: 'With events', value: withVal, color: accent },
          { label: 'Without events', value: noVal, color: theme.palette.text.secondary },
        ].map((row) => (
          <Box key={row.label}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                mb: 0.625,
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {row.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: row.color,
                  fontFeatureSettings: TNUM,
                  letterSpacing: '-0.01em',
                }}
              >
                {formatValue(row.value)}
              </Typography>
            </Box>
            <CompareBar value={row.value} max={barMax} color={row.color} />
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <CardShell head={cardHead} sx={{ mb: 3 }}>
      {isCalculating ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 6,
            gap: 2,
          }}
        >
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Calculating economic event correlations…
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <InfoStrip>
            This analysis correlates your trades with economic events that occurred
            during the same trading sessions, surfacing patterns in your performance.
            {selectedCurrency !== 'ALL' && (
              <>
                {' '}
                Filtered to{' '}
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  {selectedCurrency}
                </Box>{' '}
                events.
              </>
            )}
          </InfoStrip>

          {/* Summary: losing vs winning trades */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {renderSummaryGroup(
              theme.palette.error.main,
              'Losing trades',
              `${selectedImpact} impact correlation`,
              'Total losing',
              totalLosing,
              lossPct,
              losingWithEvents,
              <TrendingDown sx={{ fontSize: 14, color: theme.palette.error.main }} />,
              <EventNote sx={{ fontSize: 14, color: theme.palette.error.main }} />,
            )}
            {renderSummaryGroup(
              theme.palette.success.main,
              'Winning trades',
              `${selectedImpact} impact correlation`,
              'Total winning',
              totalWinning,
              winPct,
              winningWithEvents,
              <TrendingUp sx={{ fontSize: 14, color: theme.palette.success.main }} />,
              <EventNote sx={{ fontSize: 14, color: theme.palette.success.main }} />,
            )}
          </Box>

          {/* Average loss/win comparison */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {renderCompareCard('Average loss', theme.palette.error.main, avgLossWith, avgLossNo, lossBarMax)}
            {renderCompareCard('Average win', theme.palette.success.main, avgWinWith, avgWinNo, winBarMax)}
          </Box>

          {/* Most common event types — nested sub-card with inverted header
              (eyebrow above title, no icon pill) so it reads as scoped */}
          <Box
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: `${theme.palette.custom.radius.lg}px`,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography sx={EYEBROW_SX}>Most common event types</Typography>
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    mt: 0.25,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Showing {eventList.length} of {totalEventTypes}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ToggleButtonGroup
                  size="small"
                  value={groupEvents ? 'grouped' : 'individual'}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setGroupEvents(val === 'grouped');
                  }}
                >
                  <ToggleButton
                    value="individual"
                    sx={{ textTransform: 'none', px: 1.5, py: 0.5 }}
                  >
                    Individual
                  </ToggleButton>
                  <ToggleButton
                    value="grouped"
                    sx={{ textTransform: 'none', px: 1.5, py: 0.5 }}
                  >
                    Grouped
                  </ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  size="small"
                  placeholder="Search events…"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ width: 240 }}
                />
              </Box>
            </Box>

            <Box sx={{ p: 2 }}>
              {eventList.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
                  No common event types found.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {eventList.map((eventType: any, index: number) => (
                    <EventTile
                      key={`${eventType.event}-${eventType.currency}-${index}`}
                      eventType={eventType}
                      insetBg={insetBg}
                      hairline={theme.palette.divider}
                      onClickLosing={
                        setMultipleTradesDialog
                          ? () => {
                              if ((eventType.losingTrades || []).length > 0) {
                                setMultipleTradesDialog({
                                  open: true,
                                  trades: eventType.losingTrades || [],
                                  title: `Losing trades during "${eventType.event}" events`,
                                  subtitle: `${(eventType.losingTrades || []).length} losing trades · Avg loss: ${formatValue(eventType.avg_loss)}`,
                                });
                              }
                            }
                          : undefined
                      }
                      onClickWinning={
                        setMultipleTradesDialog
                          ? () => {
                              if ((eventType.winningTrades || []).length > 0) {
                                setMultipleTradesDialog({
                                  open: true,
                                  trades: eventType.winningTrades || [],
                                  title: `Winning trades during "${eventType.event}" events`,
                                  subtitle: `${(eventType.winningTrades || []).length} winning trades · Avg win: ${formatValue(eventType.avg_win)}`,
                                });
                              }
                            }
                          : undefined
                      }
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </CardShell>
  );
};

// ─── EventTile ────────────────────────────────────────────────────────────
// Single event-type tile with two clickable segments below the divider.
// Kept inline because its structure (flag + clamped name + count caption +
// two-segment footer) is unique to this analysis.

interface EventTileProps {
  eventType: any;
  insetBg: string;
  hairline: string;
  onClickLosing?: () => void;
  onClickWinning?: () => void;
}

const EventTile: React.FC<EventTileProps> = ({
  eventType,
  insetBg,
  hairline,
  onClickLosing,
  onClickWinning,
}) => {
  const theme = useTheme();
  const losingCount = (eventType.losingTrades || []).length;
  const winningCount = (eventType.winningTrades || []).length;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '10px',
        bgcolor: insetBg,
        border: `1px solid ${hairline}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.875, minWidth: 0 }}>
        {eventType.economicEventDetails?.flagCode && (
          <Box
            component="img"
            src={getFlagUrl(eventType.economicEventDetails.flagCode)}
            alt={eventType.economicEventDetails.flagCode || 'flag'}
            sx={{
              width: 18,
              height: 13,
              borderRadius: '2px',
              objectFit: 'cover',
              flexShrink: 0,
              mt: '3px',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {eventType.event}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.tertiary',
              fontFeatureSettings: TNUM,
              mt: 0.25,
            }}
          >
            {eventType.count || 0} trades · {(eventType.win_rate || 0).toFixed(1)}% win
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0.5,
          borderTop: `1px solid ${hairline}`,
          pt: 1,
        }}
      >
        <SegmentButton
          ariaLabel="Show losing trades"
          color={theme.palette.error.main}
          arrow="↓"
          count={losingCount}
          countLabel="losses"
          amount={eventType.avg_loss}
          sign="−"
          onClick={onClickLosing}
          disabled={losingCount === 0}
        />
        <SegmentButton
          ariaLabel="Show winning trades"
          color={theme.palette.success.main}
          arrow="↑"
          count={winningCount}
          countLabel="wins"
          amount={eventType.avg_win}
          sign="+"
          onClick={onClickWinning}
          disabled={winningCount === 0}
        />
      </Box>
    </Box>
  );
};

// ─── SegmentButton ────────────────────────────────────────────────────────

interface SegmentButtonProps {
  ariaLabel: string;
  color: string;
  arrow: string;
  count: number;
  countLabel: string;
  amount: number;
  sign: string;
  onClick?: () => void;
  disabled: boolean;
}

const SegmentButton: React.FC<SegmentButtonProps> = ({
  ariaLabel,
  color,
  arrow,
  count,
  countLabel,
  amount,
  sign,
  onClick,
  disabled,
}) => {
  const interactive = !!onClick && !disabled;
  return (
    <Box
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onClick!();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0.5,
        px: 0.875,
        py: 0.625,
        borderRadius: '6px',
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 150ms ease',
        '&:hover': interactive ? { bgcolor: alpha(color, 0.1) } : {},
        '&:focus-visible': interactive
          ? { outline: 'none', boxShadow: `0 0 0 3px ${alpha(color, 0.25)}` }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.375 }}>
        <Typography
          component="span"
          sx={{ fontSize: '0.8rem', fontWeight: 700, color, lineHeight: 1 }}
        >
          {arrow}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color,
            fontFeatureSettings: TNUM,
            lineHeight: 1,
          }}
        >
          {count}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: '0.7rem', color: 'text.tertiary', lineHeight: 1 }}
        >
          {countLabel}
        </Typography>
      </Box>
      <Typography
        component="span"
        sx={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color,
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.01em',
        }}
      >
        {sign}
        {formatValue(Math.abs(amount || 0)).replace(/^[+-]/, '')}
      </Typography>
    </Box>
  );
};

export default EconomicEventCorrelationAnalysis;
