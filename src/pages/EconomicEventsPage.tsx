import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PushPin as PinIcon,
  EventNote as EventsIcon,
  CalendarMonth as DateRangeIcon,
  Close as CloseIcon,
  Notes as NotesIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  addDays,
  addWeeks,
  differenceInMilliseconds,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns';

import { useEconomicEvents } from 'features/events/hooks/useEconomicEvents';
import { useEventCountdownTime } from 'hooks/useCurrentTime';
import { useUserPinnedEvents } from 'features/events/contexts/UserPinnedEventsContext';
import { useTradesContext } from 'features/calendar/contexts/TradesContext';
import { useTradeOperations } from 'features/calendar/contexts/TradeOperationsContext';
import {
  DEFAULT_FILTER_SETTINGS,
  EconomicCalendarFilterSettings,
} from 'features/events/hooks/useEconomicCalendarFilters';
import { useUserTradeEventCounts } from 'features/events/hooks/useUserTradeEventCounts';
import {
  SidePanelProvider,
  useSidePanel,
  SidePanelView,
  EventDetailView,
} from 'contexts/SidePanelContext';
import { usePanelMutexSlot } from 'contexts/PanelMutexContext';
import SidePanel from 'components/sidePanel/SidePanel';
import { Currency, EconomicEvent, ImpactLevel } from 'features/events/types/economicCalendar';
import { isEventPinned } from 'features/events/utils/eventNameUtils';
import { isDarkMode } from 'utils/themeMode';
import { PinnedEvent } from 'features/calendar/types/dualWrite';
import EconomicEventRow, {
  ImpactBars,
  formatTime,
  impactColor,
} from 'features/events/components/EconomicEventRow';
import EconomicEventDetailDialog from 'features/events/components/EconomicEventDetailDialog';
import EconomicEventDetailPanel from 'features/events/components/EconomicEventDetailPanel';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog from 'features/calendar/components/ImageZoomDialog';
import NotesContent from 'features/notes/components/sidePanel/NotesContent';
import NotesDrawer from 'features/notes/components/NotesDrawer';
import { useEventPageTradeOps } from 'features/events/hooks/useEventPageTradeOps';
import AllPinnedEventsContent from 'features/events/components/AllPinnedEventsContent';
import EconomicEventShimmer from 'features/events/components/EconomicEventShimmer';
import { Z_INDEX } from 'styles/zIndex';
import { EYEBROW_SX, TNUM } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import StatTile from 'components/common/StatTile';
import CompareBar from 'components/common/CompareBar';

const APP_HEADER_HEIGHT = 64;
// App.tsx sets pb: 0 for /events (isViewportLockedPage) so the page can
// fill the full visible content area — only the AppHeader (pt:8 = 64px)
// must be subtracted from 100vh.
const APP_VIEWPORT_OFFSET = APP_HEADER_HEIGHT;

type HubTab = 'all' | 'upcoming' | 'releases';

const IMPACT_LEVELS: Array<{ value: ImpactLevel; label: string }> = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Med' },
  { value: 'Low', label: 'Low' },
];
const HUB_TABS: Array<{ value: HubTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'releases', label: 'Releases' },
];

const CURRENCY_OPTIONS: Currency[] = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'NZD',
  'CNY',
];

// `formatTime`, `computeTimeInfo`, `getActualResultStyle`, `impactColor`,
// `ImpactBars`, `ValuePill`, and the `EventRow` body itself were all
// extracted to `EconomicEventRow.tsx` so every events surface (this
// page, the side panel, the gallery panel) shares one canonical row.
// Imports below pull the still-needed pieces — only `EventRow`'s body
// is gone, the FilterPill + PinnedRow callers below still consume
// `impactColor`, `formatTime`, and `ImpactBars` from the shared file.

/** A "release" is an event whose actual figure has already published. */
const isReleaseEvent = (e: EconomicEvent): boolean =>
  Boolean(e.actual_value && e.actual_value.trim() !== '');

const formatRelativeTime = (timeUtc: string, now: Date): string => {
  try {
    const target = parseISO(timeUtc);
    const ms = differenceInMilliseconds(target, now);
    const abs = Math.abs(ms);
    const minutes = Math.floor(abs / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (ms < 0) {
      if (days >= 1) return `${days}d ago`;
      if (hours >= 1) return `${hours}h ago`;
      if (minutes >= 1) return `${minutes}m ago`;
      return 'just now';
    }
    if (days >= 1) return `In ${days} day${days === 1 ? '' : 's'}`;
    if (hours >= 1) return `In ${hours}h ${minutes - hours * 60}m`;
    if (minutes >= 1) return `In ${minutes}m`;
    return 'Now';
  } catch {
    return '';
  }
};

/**
 * User-scoped Economic Hub. Layout: page-head (eyebrow + h1 + filter pill) →
 * hub tabs (Calendar / Releases) + date picker → 3-column body (day rail,
 * grouped event list, sidebar with impact distribution + pinned events +
 * historical edge from user's trades). Pinning + edge stats both run
 * user-level — no calendar binding required.
 */
const EconomicEventsPageInner: React.FC = () => {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const { pushPanel, currentView, stack, setOpen, isOpen: isPanelOpen } = useSidePanel();

  // Panel mutex slot — broadcasts to global SidePanel + CalendarsList so
  // only one panel surface is open at a time.
  const closeLocalPanel = useCallback(() => setOpen(false), [setOpen]);
  usePanelMutexSlot('page-side-panel', isPanelOpen, closeLocalPanel);

  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  // All filters live on the selected calendar (`calendars.economic_calendar_filters`)
  // so Events page + Home page panel/drawer stay in sync. Read straight from
  // the calendar row, write via onUpdateCalendarProperty — change here shows up
  // immediately on home via the same calendar prop.
  const { calendar, isReadOnly: calendarIsReadOnly } = useTradesContext();
  const { onUpdateCalendarProperty } = useTradeOperations();

  const persistedFilters: EconomicCalendarFilterSettings =
    calendar?.economic_calendar_filters || DEFAULT_FILTER_SETTINGS;

  // Optimistic local copy so impact/currency pill toggles reflect instantly,
  // before the async onUpdateCalendarProperty write round-trips back through
  // the calendar prop. Re-anchored only when the user switches calendars —
  // depending on the filter object reference would re-fire on every one of
  // our own writes (the persisted object is a fresh ref with identical
  // content), causing a second full-page rerender per tap.
  const [filterSettings, setFilterSettings] =
    useState<EconomicCalendarFilterSettings>(persistedFilters);

  useEffect(() => {
    setFilterSettings(
      calendar?.economic_calendar_filters || DEFAULT_FILTER_SETTINGS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar?.id]);

  const selectedCurrencies = filterSettings.currencies;
  const selectedImpacts = filterSettings.impacts;
  const notificationsEnabled = filterSettings.notificationsEnabled;

  const updateFilters = useCallback(
    (patch: Partial<EconomicCalendarFilterSettings>) => {
      if (!calendar?.id || !onUpdateCalendarProperty || calendarIsReadOnly) return;
      // Optimistic: reflect the change locally immediately.
      setFilterSettings((prev) => ({ ...prev, ...patch }));
      void onUpdateCalendarProperty(calendar.id, (cal) => ({
        ...cal,
        economic_calendar_filters: {
          ...(cal.economic_calendar_filters || DEFAULT_FILTER_SETTINGS),
          ...patch,
        },
      }));
    },
    [calendar?.id, onUpdateCalendarProperty, calendarIsReadOnly]
  );

  const toggleCurrency = useCallback(
    (c: Currency) => {
      const next = selectedCurrencies.includes(c)
        ? selectedCurrencies.filter((x) => x !== c)
        : [...selectedCurrencies, c];
      updateFilters({ currencies: next });
    },
    [selectedCurrencies, updateFilters]
  );

  // Single write — the previous implementation looped onToggle per chip,
  // queueing N sequential DB writes + N cascading rerenders.
  const clearCurrencies = useCallback(
    () => updateFilters({ currencies: [] }),
    [updateFilters],
  );

  const toggleImpact = useCallback(
    (i: ImpactLevel) => {
      const next = selectedImpacts.includes(i)
        ? selectedImpacts.filter((x) => x !== i)
        : [...selectedImpacts, i];
      updateFilters({ impacts: next });
    },
    [selectedImpacts, updateFilters]
  );

  const setNotificationsEnabled = useCallback(
    (v: boolean) => updateFilters({ notificationsEnabled: v }),
    [updateFilters]
  );
  const [hubTab, setHubTab] = useState<HubTab>('all');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const goToWeek = (delta: number) => {
    const next = addWeeks(weekStart, delta);
    setWeekStart(next);
    const offset = Math.max(
      0,
      Math.min(
        6,
        Math.round((selectedDay.getTime() - weekStart.getTime()) / 86_400_000)
      )
    );
    setSelectedDay(addDays(next, offset));
  };

  const goToThisWeek = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setSelectedDay(today);
  };

  const handleDatePick = (d: Date | null) => {
    if (!d) return;
    setWeekStart(startOfWeek(d, { weekStartsOn: 0 }));
    setSelectedDay(d);
  };

  // pageSize bumped: a full week with All impacts can return 150+ events.
  // Default 50 was clipping the list to Mon/Tue only.
  const { events, loading, error } = useEconomicEvents({
    viewType: 'week',
    currentDate: weekStart,
    currencies: selectedCurrencies,
    impacts: selectedImpacts,
    onlyUpcoming: false,
    enabled: true,
    pageSize: 300,
  });

  const { currentTime } = useEventCountdownTime(events, true);

  // Tab-driven visible slice:
  //   - all       → every event
  //   - upcoming  → events still in the future
  //   - releases  → events whose actual figure has printed
  const visibleEvents = useMemo(() => {
    if (hubTab === 'releases') return events.filter(isReleaseEvent);
    if (hubTab === 'upcoming') {
      const nowMs = currentTime.getTime();
      return events.filter((e) => {
        try {
          return parseISO(e.time_utc).getTime() >= nowMs;
        } catch {
          return false;
        }
      });
    }
    return events;
  }, [events, hubTab, currentTime]);

  const { pins: userPins, pin, unpin, pinningEventId } = useUserPinnedEvents();
  const { getCountForEvent } = useUserTradeEventCounts();

  // Match by event_id with cleaned-name fallback so pins captured in older
  // weeks (where the data-source rotated event ids) still resolve. Mirrors
  // EconomicEventListItem's `isEventPinned` helper.
  const isPinnedFor = (ev: EconomicEvent) => isEventPinned(ev, userPins);
  const getPinnedNotesFor = (ev: EconomicEvent) =>
    userPins.find((p) =>
      p.event_id
        ? p.event_id === ev.id
        : p.event.toLowerCase() === ev.event_name.toLowerCase(),
    )?.notes;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const ev of visibleEvents) {
      const list = map.get(ev.event_date);
      if (list) list.push(ev);
      else map.set(ev.event_date, [ev]);
    }
    for (const list of Array.from(map.values())) {
      list.sort((a, b) => a.time_utc.localeCompare(b.time_utc));
    }
    return map;
  }, [visibleEvents]);

  const selectedDayKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayEvents = eventsByDate.get(selectedDayKey) || [];

  const highImpactCount = useMemo(
    () => visibleEvents.filter((e) => e.impact === 'High').length,
    [visibleEvents]
  );

  const impactDistribution = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    for (const ev of visibleEvents) {
      if (ev.impact === 'High') counts.High += 1;
      else if (ev.impact === 'Medium') counts.Medium += 1;
      else if (ev.impact === 'Low') counts.Low += 1;
    }
    const max = Math.max(counts.High, counts.Medium, counts.Low, 1);
    return { counts, max };
  }, [visibleEvents]);

  // Detail dialog
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const handleEventClick = (ev: EconomicEvent) => {
    if (isLargeScreen) {
      pushPanel({ id: 'event-detail', event: ev });
      setOpen(true);
    } else {
      setSelectedEvent(ev);
      setDetailOpen(true);
    }
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedEvent(null);
  };

  useEffect(() => {
    if (!selectedEvent) return;
    const next = events.find((e) => e.id === selectedEvent.id);
    if (next && next !== selectedEvent) setSelectedEvent(next);
  }, [events, selectedEvent]);

  // Drawer state — only used on smaller screens. lg+ uses SidePanel.
  const [allPinnedOpen, setAllPinnedOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const {
    tradeOps,
    zoomedImages,
    setZoomedImage,
    closeZoom,
    galleryMode,
    openGalleryMode,
    closeGalleryMode,
  } = useEventPageTradeOps();

  const handleViewAllPinned = () => {
    if (isLargeScreen) {
      pushPanel({ id: 'all-pinned-events' });
      setOpen(true);
    } else {
      setAllPinnedOpen(true);
    }
  };

  const handleOpenNotes = () => {
    if (isLargeScreen) {
      pushPanel({ id: 'notes' });
      setOpen(true);
    } else {
      setNotesOpen(true);
    }
  };

  // When the SidePanel is showing event-detail, keep the panel's event in
  // sync with the latest live data from the events feed. Otherwise stale
  // values (e.g. forecast updates) won't appear in the open panel.
  useEffect(() => {
    if (currentView.id !== 'event-detail') return;
    const detail = currentView as EventDetailView;
    const fresh = events.find((e) => e.id === detail.event.id);
    if (fresh && fresh !== detail.event) {
      pushPanel({ id: 'event-detail', event: fresh });
    }
  }, [currentView, events, pushPanel]);

  const weekRangeLabel = `${format(weekStart, 'MMM d')} – ${format(
    endOfWeek(weekStart, { weekStartsOn: 0 }),
    'MMM d, yyyy'
  )}`;

  const renderView = useCallback(
    (view: SidePanelView) => {
      switch (view.id) {
        case 'event-detail': {
          const v = view as EventDetailView;
          // When reached from the main events list, the X close + the list on
          // the left handle navigation, so the back-arrow is visual noise. But
          // when reached from the pinned-events panel, the back-arrow is the
          // only way back to that list — surface it so the user isn't stranded.
          const cameFromPinned =
            stack[stack.length - 2]?.id === 'all-pinned-events';
          return {
            title: 'Event details',
            icon: <EventsIcon fontSize="small" />,
            hideBack: !cameFromPinned,
            component: (
              <EconomicEventDetailPanel
                event={v.event}
                tradeOperations={tradeOps}
                isReadOnly={false}
              />
            ),
          };
        }
        case 'all-pinned-events':
          return {
            title: `Pinned events · ${userPins.length}`,
            icon: <PinIcon fontSize="small" />,
            hideBack: true,
            component: (
              <AllPinnedEventsContent
                pins={userPins}
                allEvents={events}
                getTradeCount={getCountForEvent}
                onClickEvent={(ev) =>
                  pushPanel({ id: 'event-detail', event: ev })
                }
              />
            ),
          };
        case 'notes':
          return {
            title: 'Gameplan',
            icon: <NotesIcon fontSize="small" />,
            hideBack: true,
            component: (
              <NotesContent
                isActive={isPanelOpen && currentView.id === 'notes'}
                pinnedEvents={userPins}
                showFooter
              />
            ),
          };
        case 'events-home':
        default:
          return {
            title: 'Events',
            icon: <EventsIcon fontSize="small" />,
            hideBack: true,
            component: (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 4,
                  textAlign: 'center',
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
                    Pick an event
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    Click any event to see trades, AI analysis, and pin notes.
                  </Typography>
                </Box>
              </Box>
            ),
          };
      }
    },
    [userPins, events, getCountForEvent, pushPanel, stack, tradeOps, isPanelOpen, currentView.id]
  );

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        height: { xs: 'auto', md: `calc(100vh - ${APP_VIEWPORT_OFFSET}px)` },
        width: '100%',
        overflow: { md: 'hidden' },
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 2, sm: 3 },
          // maxWidth removed: when SidePanel renders alongside, the main
          // content should fill remaining width. The flex parent already
          // bounds the page to the viewport.
          // Pin to viewport on md+ so internal panels scroll, not the page.
          overflow: { md: 'hidden' },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      {/* Page head — PerformanceHeader pattern: eyebrow + display title + subtitle + right actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={EYEBROW_SX}>Macro calendar</Typography>
          <Typography
            component="h1"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '1.85rem' },
              letterSpacing: '-0.025em',
              color: 'text.primary',
              mt: '6px',
              mb: 0,
              lineHeight: 1.15,
            }}
          >
            Economic events
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.875rem',
              mt: '6px',
              lineHeight: 1.4,
            }}
          >
            {weekRangeLabel}
            {visibleEvents.length > 0
              ? ` · ${visibleEvents.length} event${
                  visibleEvents.length === 1 ? '' : 's'
                }`
              : ''}
            {highImpactCount > 0 ? ` · ${highImpactCount} high-impact` : ''}
            {userPins.length > 0 ? ` · ${userPins.length} pinned` : ''}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1}>
          <FilterPill
            selected={selectedImpacts}
            onToggle={toggleImpact}
            theme={theme}
          />
          <Tooltip
            title={
              calendarIsReadOnly
                ? 'Notification settings are read-only for shared calendars'
                : notificationsEnabled
                ? 'Disable event notifications'
                : 'Enable event notifications'
            }
            placement="top"
          >
            <span>
              <IconButton
                size="small"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                disabled={calendarIsReadOnly}
                sx={{
                  color: notificationsEnabled ? 'primary.main' : 'text.disabled',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {notificationsEnabled ? (
                  <NotificationsIcon />
                ) : (
                  <NotificationsOffIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Currency chips + upcoming toggle (user-persisted) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        flexWrap="wrap"
        sx={{ mb: 1.75, rowGap: 1 }}
      >
        <CurrencyChips
          selected={selectedCurrencies}
          onToggle={toggleCurrency}
          onClear={clearCurrencies}
          theme={theme}
        />
      </Stack>

      {/* Hub tabs + date controls */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        flexWrap="wrap"
        sx={{ mb: 2.75, rowGap: 1 }}
      >
        <HubTabs value={hubTab} onChange={setHubTab} theme={theme} />

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.25} alignItems="center">
          <IconButton
            size="small"
            onClick={() => goToWeek(-1)}
            aria-label="Previous week"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <ButtonBase
            onClick={goToThisWeek}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Today
          </ButtonBase>
          <IconButton
            size="small"
            onClick={() => goToWeek(1)}
            aria-label="Next week"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>

        <DatePicker
          value={selectedDay}
          onChange={handleDatePick}
          slots={{ field: DatePickerTrigger }}
          slotProps={{
            field: { weekRangeLabel } as any,
          }}
        />
      </Stack>

      {/* Body grid: day-rail | event list | sidebar — flexes to fill remaining
          viewport on md+ so the cards inside scroll, not the page. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '200px 1fr',
            lg: '200px 1fr 320px',
          },
          gap: { xs: 2, md: 3 },
          alignItems: 'stretch',
          flex: { md: 1 },
          minHeight: 0,
        }}
      >
        <DayRail
          days={weekDays}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
          eventsByDate={eventsByDate}
          theme={theme}
        />

        <EventList
          label={format(selectedDay, 'EEE, MMM d')}
          events={selectedDayEvents}
          loading={loading}
          error={error}
          currentTime={currentTime}
          isPinned={isPinnedFor}
          getTradeCount={getCountForEvent}
          getPinnedNotes={getPinnedNotesFor}
          pinningEventId={pinningEventId}
          onPin={pin}
          onUnpin={unpin}
          onClickRow={handleEventClick}
          theme={theme}
        />

        <Stack
          spacing={2}
          sx={{
            gridColumn: { xs: '1', md: '1 / -1', lg: 'auto' },
            display: 'flex',
            flexDirection: 'column',
            // Fill the grid cell on lg+; let stacks expand naturally below.
            height: { xs: 'auto', lg: '100%' },
            minHeight: 0,
          }}
        >
          <ImpactDistributionCard
            counts={impactDistribution.counts}
            max={impactDistribution.max}
            theme={theme}
          />
          <Box
            sx={{
              flex: { xs: 'none', lg: 1 },
              minHeight: { lg: 0 },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PinnedEventsCard
              pins={userPins}
              allEvents={events}
              currentTime={currentTime}
              getTradeCount={getCountForEvent}
              onClickEvent={handleEventClick}
              onViewAll={handleViewAllPinned}
              theme={theme}
            />
          </Box>
        </Stack>

      </Box>

      {!isLargeScreen && selectedEvent && (
        <EconomicEventDetailDialog
          open={detailOpen}
          onClose={handleDetailClose}
          event={selectedEvent}
          tradeOperations={tradeOps}
          isReadOnly={false}
        />
      )}

      {!isLargeScreen && (
        <AllPinnedEventsDrawer
          open={allPinnedOpen}
          onClose={() => setAllPinnedOpen(false)}
          pins={userPins}
          allEvents={events}
          currentTime={currentTime}
          getTradeCount={getCountForEvent}
          onClickEvent={handleEventClick}
        />
      )}

      {!isLargeScreen && (
        <NotesDrawer
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          pinnedEvents={userPins}
          showFooter
        />
      )}
      </Box>

      <TradeGalleryDialog
        open={galleryMode.open}
        onClose={closeGalleryMode}
        trades={galleryMode.trades}
        initialTradeId={galleryMode.initialTradeId}
        title={galleryMode.title}
        aiOnlyMode={galleryMode.aiOnlyMode}
        setZoomedImage={setZoomedImage}
        tradeOperations={tradeOps}
        isReadOnly={true}
      />

      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={closeZoom}
          imageProp={zoomedImages}
        />
      )}

      {/* AI Chat is mounted once at App level via GlobalAIChat — pages
          dispatch through `useAIChat()` when they need to open it. */}

      {/* SidePanel sibling — lg+ only. Mirrors TradeCalendarPage. */}
      {isLargeScreen && <SidePanel renderView={renderView} />}

      {/* Re-open tab when panel collapsed (lg+ only). */}
      {isLargeScreen && !isPanelOpen && (
        <IconButton
          onClick={() => setOpen(true)}
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          aria-label="Expand panel"
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

const EconomicEventsPage: React.FC = () => (
  <SidePanelProvider defaultView={{ id: 'events-home' }} defaultOpen={false}>
    <EconomicEventsPageInner />
  </SidePanelProvider>
);

// ──────────────────────────────────────────────
// Filter pill — multi-select High / Med / Low
// ──────────────────────────────────────────────
const FilterPill: React.FC<{
  selected: ImpactLevel[];
  onToggle: (v: ImpactLevel) => void;
  theme: Theme;
}> = ({ selected, onToggle, theme }) => {
  const impactButtonSx = (active: boolean, color: string) => ({
    px: 1.5,
    py: 0.75,
    borderRadius: 0.875,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: active ? '#fff' : color,
    bgcolor: active ? color : 'transparent',
    transition: 'background 150ms, color 150ms',
    '&:hover': {
      color: active ? '#fff' : color,
      bgcolor: active ? alpha(color, 0.85) : alpha(color, 0.12),
    },
  });

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        p: 0.5,
        borderRadius: 1.25,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.4),
      }}
    >
      {IMPACT_LEVELS.map((opt) => {
        const active = selected.includes(opt.value);
        const color = impactColor(opt.value, theme);
        return (
          <ButtonBase
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            sx={impactButtonSx(active, color)}
          >
            {opt.label}
          </ButtonBase>
        );
      })}
    </Stack>
  );
};

// ──────────────────────────────────────────────
// Currency chips — multi-select, persisted to user
// ──────────────────────────────────────────────
const CurrencyChips: React.FC<{
  selected: Currency[];
  onToggle: (c: Currency) => void;
  onClear: () => void;
  theme: Theme;
}> = ({ selected, onToggle, onClear, theme }) => {
  const allOff = selected.length === 0;
  return (
    <Stack
      direction="row"
      spacing={0.625}
      flexWrap="wrap"
      sx={{ rowGap: 0.625 }}
    >
      {CURRENCY_OPTIONS.map((c) => {
        const active = selected.includes(c);
        // When nothing is selected we show every currency in muted "all"
        // state — visually distinct from the active selection.
        const showAsActive = !allOff && active;
        return (
          <ButtonBase
            key={c}
            onClick={() => onToggle(c)}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
              border: `1px solid ${
                showAsActive
                  ? alpha(theme.palette.primary.main, 0.45)
                  : theme.palette.divider
              }`,
              bgcolor: showAsActive
                ? alpha(theme.palette.primary.main, 0.16)
                : 'transparent',
              color: showAsActive
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
              transition: 'background 150ms, color 150ms, border-color 150ms',
              '&:hover': {
                color: theme.palette.text.primary,
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            }}
          >
            {c}
          </ButtonBase>
        );
      })}
      {!allOff && (
        <ButtonBase
          onClick={onClear}
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 999,
            fontSize: '0.72rem',
            fontWeight: 600,
            color: theme.palette.text.disabled,
            '&:hover': { color: theme.palette.text.primary },
          }}
        >
          Clear
        </ButtonBase>
      )}
    </Stack>
  );
};

// ──────────────────────────────────────────────
// Hub tabs — All / Upcoming / Releases
// ──────────────────────────────────────────────
const HubTabs: React.FC<{
  value: HubTab;
  onChange: (v: HubTab) => void;
  disabled?: Partial<Record<HubTab, boolean>>;
  theme: Theme;
}> = ({ value, onChange, disabled, theme }) => (
  <Stack
    direction="row"
    spacing={0.5}
    sx={{
      p: 0.5,
      borderRadius: 1.5,
      border: `1px solid ${theme.palette.divider}`,
      bgcolor: alpha(theme.palette.background.paper, 0.4),
    }}
  >
    {HUB_TABS.map((opt) => {
      const active = opt.value === value;
      const isDisabled = disabled?.[opt.value] ?? false;
      const button = (
        <ButtonBase
          key={opt.value}
          onClick={isDisabled ? undefined : () => onChange(opt.value)}
          disabled={isDisabled}
          sx={{
            px: 2,
            py: 1,
            borderRadius: 1,
            fontSize: '0.85rem',
            fontWeight: 600,
            color: active
              ? theme.palette.primary.contrastText
              : isDisabled
                ? theme.palette.text.disabled
                : theme.palette.text.secondary,
            bgcolor: active ? 'primary.main' : 'transparent',
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 150ms, color 150ms',
            '&:hover': {
              color: active
                ? theme.palette.primary.contrastText
                : isDisabled
                  ? theme.palette.text.disabled
                  : theme.palette.text.primary,
              bgcolor: active
                ? theme.palette.primary.dark
                : isDisabled
                  ? 'transparent'
                  : theme.palette.action.hover,
            },
          }}
        >
          {opt.label}
        </ButtonBase>
      );
      if (isDisabled) {
        return (
          <Tooltip
            key={opt.value}
            title="Releases is only available for today"
            placement="top"
          >
            <span>{button}</span>
          </Tooltip>
        );
      }
      return button;
    })}
  </Stack>
);

// ──────────────────────────────────────────────
// DatePicker custom trigger — small ghost button "May 5 – May 11"
// ──────────────────────────────────────────────
const DatePickerTrigger: React.FC<any> = (props) => {
  const { weekRangeLabel, InputProps, inputProps, ...rest } = props;
  const theme = useTheme();
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    InputProps?.endAdornment?.props?.children?.props?.onClick?.(e);
    // fall back to the slot's open handler (props.onClick on rest)
    rest.onClick?.(e);
  };
  return (
    <ButtonBase
      ref={InputProps?.ref}
      onClick={handleClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.875,
        px: 1.5,
        py: 0.875,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        color: 'text.secondary',
        fontSize: '0.8rem',
        fontWeight: 600,
        transition: 'border-color 150ms, color 150ms',
        '&:hover': {
          color: 'text.primary',
          borderColor: alpha(theme.palette.primary.main, 0.4),
        },
      }}
    >
      <DateRangeIcon sx={{ fontSize: 16 }} />
      {weekRangeLabel}
    </ButtonBase>
  );
};

// ──────────────────────────────────────────────
// Day rail — Sun–Sat with active state, event count, impact dot
// ──────────────────────────────────────────────
const DayRail: React.FC<{
  days: Date[];
  selectedDay: Date;
  onSelect: (d: Date) => void;
  eventsByDate: Map<string, EconomicEvent[]>;
  theme: Theme;
}> = ({ days, selectedDay, onSelect, eventsByDate, theme }) => {
  return (
    <Stack
      component="aside"
      spacing={0.5}
      sx={{
        flexDirection: { xs: 'row', md: 'column' },
        overflowX: { xs: 'auto', md: 'visible' },
        pb: { xs: 1, md: 0 },
      }}
      direction={{ xs: 'row', md: 'column' }}
    >
      {days.map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        const dayEvents = eventsByDate.get(key) || [];
        const isActive = isSameDay(d, selectedDay);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        const hasHigh = dayEvents.some((e) => e.impact === 'High');
        const hasMed = dayEvents.some((e) => e.impact === 'Medium');
        const hasLow = dayEvents.some((e) => e.impact === 'Low');
        const dotColor = hasHigh
          ? theme.palette.error.main
          : hasMed
            ? theme.palette.warning.main
            : hasLow
              ? theme.palette.success.main
              : null;

        return (
          <ButtonBase
            key={key}
            onClick={() => onSelect(d)}
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1.25,
              px: 1.25,
              py: 1.125,
              borderRadius: 1.25,
              minWidth: { xs: 152, md: 'auto' },
              flexShrink: 0,
              opacity: isWeekend && dayEvents.length === 0 ? 0.45 : 1,
              bgcolor: isActive
                ? alpha(theme.palette.primary.main, 0.16)
                : 'transparent',
              transition: 'background 150ms',
              '&:hover': {
                bgcolor: isActive
                  ? alpha(theme.palette.primary.main, 0.2)
                  : theme.palette.action.hover,
              },
              justifyContent: 'flex-start',
            }}
          >
            <Typography
              sx={{
                fontSize: '1.3rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                minWidth: 32,
                textAlign: 'center',
                fontFeatureSettings: "'tnum' on",
                color: isActive ? 'primary.main' : 'text.primary',
                lineHeight: 1,
              }}
            >
              {format(d, 'd')}
            </Typography>
            <Box sx={{ flex: 1, textAlign: 'left' }}>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  lineHeight: 1.2,
                }}
              >
                {format(d, 'EEE')}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                  fontFeatureSettings: "'tnum' on",
                  lineHeight: 1.3,
                }}
              >
                {dayEvents.length === 0
                  ? '—'
                  : `${dayEvents.length} event${
                      dayEvents.length === 1 ? '' : 's'
                    }`}
              </Typography>
            </Box>
            {dotColor && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: dotColor,
                  opacity: 0.8,
                  flexShrink: 0,
                }}
              />
            )}
          </ButtonBase>
        );
      })}
    </Stack>
  );
};

// ──────────────────────────────────────────────
// Event list card
// ──────────────────────────────────────────────
const EventList: React.FC<{
  label: string;
  events: EconomicEvent[];
  loading: boolean;
  error: string | null;
  currentTime: Date;
  isPinned: (e: EconomicEvent) => boolean;
  getTradeCount: (e: EconomicEvent) => number;
  /** Optional — surfaces user notes attached to a pinned event as a
   *  tooltip-icon in the row's time stack. */
  getPinnedNotes?: (e: EconomicEvent) => string | undefined;
  pinningEventId: string | null;
  onPin: (e: EconomicEvent) => Promise<void> | void;
  onUnpin: (e: EconomicEvent) => Promise<void> | void;
  onClickRow: (e: EconomicEvent) => void;
  theme: Theme;
}> = ({
  label,
  events,
  loading,
  error,
  currentTime,
  isPinned,
  getTradeCount,
  getPinnedNotes,
  pinningEventId,
  onPin,
  onUnpin,
  onClickRow,
  theme,
}) => {
  const highCount = events.filter((e) => e.impact === 'High').length;

  const nowEventId = useMemo(() => {
    const now = currentTime.getTime();
    const upcoming = events
      .filter((e) => parseISO(e.time_utc).getTime() >= now - 30 * 60_000)
      .sort(
        (a, b) =>
          parseISO(a.time_utc).getTime() - parseISO(b.time_utc).getTime()
      );
    return upcoming[0]?.id ?? null;
  }, [events, currentTime]);

  const headEyebrow = loading
    ? 'Loading…'
    : events.length === 0
      ? 'No events'
      : `${events.length} event${events.length === 1 ? '' : 's'}${
          highCount > 0 ? ` · ${highCount} high` : ''
        }`;

  return (
    <CardShell
      head={{
        icon: <EventsIcon sx={{ fontSize: 16 }} />,
        title: label,
        eyebrow: headEyebrow,
      }}
      radius="lg"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Fill grid cell. Parent caps height to viewport so rows scroll
        // internally and the main page never grows past the screen.
        height: { xs: 'auto', md: '100%' },
        minHeight: { xs: 360, md: 0 },
      }}
    >
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          // Light scrollbar that matches the divider weight.
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.primary, 0.12),
            borderRadius: 8,
            border: `2px solid ${theme.palette.background.paper}`,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.22),
          },
        }}
      >
        {error && (
          <Box
            sx={{ px: 2.25, py: 2, color: 'error.main', fontSize: '0.85rem' }}
          >
            {error}
          </Box>
        )}

        {loading && events.length === 0 && (
          <EconomicEventShimmer count={6} />
        )}

        {!loading && events.length === 0 && (
          <Box
            sx={{
              px: 2.25,
              py: 5,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            No events on this day.
          </Box>
        )}

        {events.map((ev, idx) => {
          const pinned = isPinned(ev);
          const isNow = ev.id === nowEventId;
          const busy = pinningEventId === ev.id;
          return (
            <EconomicEventRow
              key={ev.id}
              event={ev}
              firstRow={idx === 0}
              isNow={isNow}
              pinned={pinned}
              busy={busy}
              tradeCount={getTradeCount(ev)}
              pinnedNotes={getPinnedNotes?.(ev)}
              currentTime={currentTime}
              onTogglePin={(e) => {
                e.stopPropagation();
                if (pinned) onUnpin(ev);
                else onPin(ev);
              }}
              onClick={() => onClickRow(ev)}
              theme={theme}
            />
          );
        })}
      </Box>
    </CardShell>
  );
};


// ──────────────────────────────────────────────
// Sidebar — Impact distribution
// ──────────────────────────────────────────────
const ImpactDistributionCard: React.FC<{
  counts: Record<'High' | 'Medium' | 'Low', number>;
  max: number;
  theme: Theme;
}> = ({ counts, max, theme }) => {
  const rows: Array<{
    key: 'High' | 'Medium' | 'Low';
    label: string;
    color: string;
  }> = [
    { key: 'High', label: 'High', color: theme.palette.error.main },
    { key: 'Medium', label: 'Medium', color: theme.palette.warning.main },
    { key: 'Low', label: 'Low', color: theme.palette.success.main },
  ];
  return (
    <CardShell
      radius="lg"
      head={{
        icon: <EventsIcon sx={{ fontSize: 16 }} />,
        title: 'Impact distribution',
        eyebrow: 'This week',
      }}
      innerSx={{ p: 1.75, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}
    >
      {rows.map((row) => {
        const count = counts[row.key];
        const pct = Math.max(4, Math.round((count / max) * 100));
        return (
          <StatTile
            key={row.key}
            size="sm"
            label={row.label}
            value={count}
            valueColor={row.color}
            footer={<CompareBar value={pct} pct color={row.color} />}
          />
        );
      })}
    </CardShell>
  );
};

// ──────────────────────────────────────────────
// Sidebar — Pinned events
// ──────────────────────────────────────────────
const PINNED_VISIBLE_LIMIT = 5;

// Construct a minimal EconomicEvent from stored pin data so a pinned row
// remains clickable even when the event isn't in the current week's feed.
const pinnedEventToEconomicEvent = (pin: PinnedEvent): EconomicEvent => ({
  id: pin.event_id,
  event_name: pin.event,
  currency: (pin.currency ?? 'USD') as Currency,
  impact: (pin.impact ?? 'High') as ImpactLevel,
  actual_result_type: '',
  event_time: '',
  time_utc: '',
  actual_value: '',
  forecast_value: '',
  previous_value: '',
  event_date: '',
  flag_url: pin.flag_url,
  country: pin.country,
  is_all_day: true,
});

const PinnedEventsCard: React.FC<{
  pins: PinnedEvent[];
  allEvents: EconomicEvent[];
  currentTime: Date;
  getTradeCount: (e: EconomicEvent) => number;
  onClickEvent: (e: EconomicEvent) => void;
  onViewAll: () => void;
  theme: Theme;
}> = ({ pins, allEvents, currentTime, getTradeCount, onClickEvent, onViewAll, theme }) => {
  // Prefer a live event from the current week; fall back to a synthetic
  // EconomicEvent built from the pin's stored fields so the row is always
  // clickable and the detail dialog can load AI analysis / notes.
  const rows = useMemo(() => {
    return pins.map((p) => {
      const liveEvent = allEvents.find((e) => e.id === p.event_id);
      const event: EconomicEvent = liveEvent ?? pinnedEventToEconomicEvent(p);
      return { pin: p, event };
    });
  }, [pins, allEvents]);

  const visibleRows = rows.slice(0, PINNED_VISIBLE_LIMIT);
  const overflow = Math.max(0, pins.length - PINNED_VISIBLE_LIMIT);

  const headRight = (
    <Typography
      sx={{
        fontSize: '0.72rem',
        color: 'text.secondary',
        fontFeatureSettings: TNUM,
        fontWeight: 600,
      }}
    >
      {pins.length}
    </Typography>
  );

  return (
    <CardShell
      radius="lg"
      head={{
        icon: <PinIcon sx={{ fontSize: 14 }} />,
        title: 'Pinned events',
        eyebrow: pins.length === 0 ? 'None yet' : `${pins.length} tracked`,
        right: headRight,
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: { xs: 'none', lg: 1 },
        minHeight: 0,
      }}
    >
      {pins.length === 0 ? (
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: 'text.secondary',
            px: 2.25,
            py: 2,
          }}
        >
          Pin events you want to track here from any row in the list.
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: 2.25,
              '&::-webkit-scrollbar': { width: 8 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: alpha(theme.palette.text.primary, 0.12),
                borderRadius: 8,
                border: `2px solid ${theme.palette.background.paper}`,
              },
              '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.22),
              },
            }}
          >
            <Stack divider={<Box sx={{ height: 1, bgcolor: 'divider' }} />}>
              {visibleRows.map(({ pin, event }) => (
                <PinnedRow
                  key={pin.event_id}
                  pin={pin}
                  event={event}
                  currentTime={currentTime}
                  tradeCount={getTradeCount(event)}
                  onClick={() => onClickEvent(event)}
                  theme={theme}
                />
              ))}
            </Stack>
          </Box>
          {pins.length > 0 && (
            <Box
              sx={{
                px: 2.25,
                py: 1.25,
                borderTop: `1px solid ${theme.palette.divider}`,
                flexShrink: 0,
              }}
            >
              <ButtonBase
                onClick={onViewAll}
                sx={{
                  width: '100%',
                  py: 0.75,
                  borderRadius: 1,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                View all {pins.length} pinned events
              </ButtonBase>
            </Box>
          )}
        </>
      )}
    </CardShell>
  );
};

// Single pinned-event row, reused inside the sidebar card, the inline
// panel, and the drawer. `event` is always provided (live or synthetic).
const PinnedRow: React.FC<{
  pin: PinnedEvent;
  event: EconomicEvent;
  currentTime: Date;
  tradeCount: number;
  onClick: () => void;
  theme: Theme;
}> = ({ pin, event, currentTime, tradeCount, onClick, theme }) => {
  const hasTime = !event.is_all_day && event.time_utc;
  return (
    <Box
      onClick={onClick}
      sx={{
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 1.5,
        alignItems: 'center',
        cursor: 'pointer',
        borderRadius: 1,
        transition: 'background 120ms',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.84rem',
            fontWeight: 600,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.event_name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.secondary',
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {hasTime
              ? `${formatTime(event.time_utc)} · ${formatRelativeTime(event.time_utc, currentTime)}`
              : pin.currency ?? '—'}
          </Typography>
          {tradeCount > 0 && (
            <Tooltip
              title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''}`}
              placement="top"
              arrow
            >
              <Box
                sx={{
                  px: 0.625,
                  py: 0.125,
                  borderRadius: 0.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  color: theme.palette.primary.main,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                {tradeCount}×
              </Box>
            </Tooltip>
          )}
        </Stack>
      </Box>
      {event.impact && <ImpactBars impact={event.impact as ImpactLevel} theme={theme} />}
    </Box>
  );
};

// ──────────────────────────────────────────────
// All-pinned drawer — full list, mirrors EconomicCalendarDrawer chrome.
// Right-anchored on sm+; full-width temporary drawer on xs (default MUI
// behaviour with width: { xs: '100%', sm: 420 }). Small screens only.
// ──────────────────────────────────────────────
const AllPinnedEventsDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  pins: PinnedEvent[];
  allEvents: EconomicEvent[];
  currentTime: Date;
  getTradeCount: (e: EconomicEvent) => number;
  onClickEvent: (e: EconomicEvent) => void;
}> = ({ open, onClose, pins, allEvents, currentTime, getTradeCount, onClickEvent }) => {
  const theme = useTheme();

  const rows = useMemo(() => {
    return pins.map((p) => {
      const event = allEvents.find((e) => e.id === p.event_id) ?? pinnedEventToEconomicEvent(p);
      return { pin: p, event };
    });
  }, [pins, allEvents]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        zIndex: Z_INDEX.ECONOMIC_CALENDAR_DRAWER,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 420 },
          maxWidth: '100vw',
          backgroundColor: theme.palette.background.paper,
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow:
            isDarkMode(theme)
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PinIcon sx={{ fontSize: 16 }} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Pinned events
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {pins.length} {pins.length === 1 ? 'event' : 'events'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          px: 2.5,
        }}
      >
        {pins.length === 0 ? (
          <Typography
            sx={{
              fontSize: '0.85rem',
              color: 'text.secondary',
              py: 3,
              textAlign: 'center',
            }}
          >
            No pinned events.
          </Typography>
        ) : (
          <Stack divider={<Box sx={{ height: 1, bgcolor: 'divider' }} />}>
            {rows.map(({ pin, event }) => (
              <PinnedRow
                key={pin.event_id}
                pin={pin}
                event={event}
                currentTime={currentTime}
                tradeCount={getTradeCount(event)}
                onClick={() => {
                  onClose();
                  onClickEvent(event);
                }}
                theme={theme}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default EconomicEventsPage;
