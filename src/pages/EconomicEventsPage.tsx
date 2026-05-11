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
  PushPinOutlined as UnpinIcon,
  EventNote as EventsIcon,
  CalendarMonth as DateRangeIcon,
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Close as CloseIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  addDays,
  addWeeks,
  differenceInMilliseconds,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns';

import { useEconomicEvents } from '../hooks/useEconomicEvents';
import { useEventCountdownTime } from '../hooks/useCurrentTime';
import { useUserPinnedEvents } from '../contexts/UserPinnedEventsContext';
import { useUserEconomicFilters } from '../contexts/UserEconomicFiltersContext';
import { useUserTradeEventCounts } from '../hooks/useUserTradeEventCounts';
import {
  SidePanelProvider,
  useSidePanel,
  SidePanelView,
  EventDetailView,
} from '../contexts/SidePanelContext';
import { usePublishPageSidePanelCloser } from '../contexts/PanelMutexContext';
import SidePanel from '../components/sidePanel/SidePanel';
import { Currency, EconomicEvent, ImpactLevel } from '../types/economicCalendar';
import { isEventPinned } from '../utils/eventNameUtils';
import { PinnedEvent } from '../types/dualWrite';
import EconomicEventDetailDialog from '../components/economicCalendar/EconomicEventDetailDialog';
import EconomicEventDetailPanel from '../components/economicCalendar/EconomicEventDetailPanel';
import TradeGalleryDialog from '../components/TradeGalleryDialog';
import ImageZoomDialog from '../components/ImageZoomDialog';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import NotesContent from '../components/sidePanel/content/NotesContent';
import NotesDrawer from '../components/notes/NotesDrawer';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useOrionTasks } from '../hooks/useOrionTasks';
import { useEventPageTradeOps } from '../hooks/useEventPageTradeOps';
import AllPinnedEventsContent from '../components/economicCalendar/AllPinnedEventsContent';
import EconomicEventShimmer from '../components/economicCalendar/EconomicEventShimmer';
import { Z_INDEX } from '../styles/zIndex';
import { ImpactFilter } from '../services/userEconomicFiltersService';

const APP_HEADER_HEIGHT = 64;
// App.tsx sets pb: 0 for /events (isViewportLockedPage) so the page can
// fill the full visible content area — only the AppHeader (pt:8 = 64px)
// must be subtracted from 100vh.
const APP_VIEWPORT_OFFSET = APP_HEADER_HEIGHT;

type HubTab = 'calendar' | 'releases';

const IMPACT_FILTERS: Array<{ value: ImpactFilter; label: string }> = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Med' },
  { value: 'Low', label: 'Low' },
  { value: 'all', label: 'All' },
];

const HUB_TABS: Array<{ value: HubTab; label: string }> = [
  { value: 'calendar', label: 'Calendar' },
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

const formatTime = (timeUtc: string): string => {
  try {
    return format(parseISO(timeUtc), 'h:mm a');
  } catch {
    return '--:--';
  }
};

interface TimeInfo {
  countdown: string | null;
  isUpcoming: boolean;
  isImminent: boolean;
  isPassed: boolean;
}

/**
 * Mirrors the countdown semantics in EconomicEventListItem so the new
 * surface stays drop-in compatible when we eventually retire the old item.
 * <60min = imminent (red, pulses); <24h = hours; otherwise days.
 */
const computeTimeInfo = (timeUtc: string, currentTime: Date): TimeInfo => {
  try {
    const target = parseISO(timeUtc);
    if (!isAfter(target, currentTime)) {
      return {
        countdown: null,
        isUpcoming: false,
        isImminent: false,
        isPassed: true,
      };
    }
    const totalSeconds = Math.floor(
      (target.getTime() - currentTime.getTime()) / 1000
    );
    const minutesDiff = Math.floor(totalSeconds / 60);
    const hoursDiff = Math.floor(totalSeconds / 3600);
    const daysDiff = Math.floor(hoursDiff / 24);

    let countdown = '';
    let isImminent = false;
    if (minutesDiff < 60) {
      isImminent = true;
      if (minutesDiff < 5) {
        const remM = Math.floor(totalSeconds / 60);
        const remS = totalSeconds % 60;
        countdown = remM > 0 ? `${remM}m ${remS}s` : `${remS}s`;
      } else {
        countdown = `${minutesDiff} min`;
      }
    } else if (hoursDiff < 24) {
      countdown = `${hoursDiff}h`;
    } else if (daysDiff === 1) {
      countdown = '1 day';
    } else {
      countdown = `${daysDiff} days`;
    }

    return { countdown, isUpcoming: true, isImminent, isPassed: false };
  } catch {
    return {
      countdown: null,
      isUpcoming: false,
      isImminent: false,
      isPassed: false,
    };
  }
};

const getActualResultStyle = (
  actualResultType: string | undefined,
  theme: Theme
): { bg: string; border: string; color: string } => {
  switch (actualResultType) {
    case 'good':
      return {
        bg: alpha(theme.palette.success.main, 0.15),
        border: alpha(theme.palette.success.main, 0.3),
        color: theme.palette.success.light,
      };
    case 'bad':
      return {
        bg: alpha(theme.palette.error.main, 0.15),
        border: alpha(theme.palette.error.main, 0.3),
        color: theme.palette.error.light,
      };
    case 'neutral':
      return {
        bg: alpha(theme.palette.info.main, 0.1),
        border: alpha(theme.palette.info.main, 0.2),
        color: theme.palette.info.light,
      };
    default:
      return {
        bg: alpha(theme.palette.success.main, 0.1),
        border: alpha(theme.palette.success.main, 0.2),
        color: theme.palette.text.primary,
      };
  }
};

const isReleaseEvent = (e: EconomicEvent): boolean =>
  Boolean(
    (e.forecast_value && e.forecast_value.trim() !== '') ||
      (e.previous_value && e.previous_value.trim() !== '')
  );

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
interface EconomicEventsPageInnerProps {
  /** Mutex partner — collapses the app-level SidePanel when a local panel
   *  opens on this page. */
  closeGlobalPanel: () => void;
}

const EconomicEventsPageInner: React.FC<EconomicEventsPageInnerProps> = ({
  closeGlobalPanel,
}) => {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const { pushPanel, currentView, setOpen, isOpen: isPanelOpen } = useSidePanel();

  // Panel mutex: publish a local-closer + close the global panel when this
  // page's local panel opens. See PanelMutexContext.
  const closeLocalPanel = useCallback(() => setOpen(false), [setOpen]);
  usePublishPageSidePanelCloser(closeLocalPanel);
  const prevLocalOpenRef = React.useRef(isPanelOpen);
  useEffect(() => {
    if (isPanelOpen && !prevLocalOpenRef.current) {
      closeGlobalPanel();
    }
    prevLocalOpenRef.current = isPanelOpen;
  }, [isPanelOpen, closeGlobalPanel]);

  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const {
    impactFilter,
    currencies: selectedCurrencies,
    onlyUpcoming,
    setImpactFilter,
    toggleCurrency,
    setOnlyUpcoming,
  } = useUserEconomicFilters();
  const [hubTab, setHubTab] = useState<HubTab>('calendar');

  // Releases tab is only relevant for today — actuals print today, forecasts
  // for past days are stale and future days haven't released yet. Force the
  // tab back to Calendar whenever the user navigates off today.
  const isSelectedDayToday = useMemo(
    () => isSameDay(selectedDay, new Date()),
    [selectedDay]
  );
  useEffect(() => {
    if (!isSelectedDayToday && hubTab === 'releases') {
      setHubTab('calendar');
    }
  }, [isSelectedDayToday, hubTab]);

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

  const impactsForFetch: ImpactLevel[] = useMemo(() => {
    if (impactFilter === 'all') return ['High', 'Medium', 'Low'];
    return [impactFilter];
  }, [impactFilter]);

  // pageSize bumped: a full week with All impacts can return 150+ events.
  // Default 50 was clipping the list to Mon/Tue only.
  const { events, loading, error } = useEconomicEvents({
    viewType: 'week',
    currentDate: weekStart,
    currencies: selectedCurrencies,
    impacts: impactsForFetch,
    onlyUpcoming,
    enabled: true,
    pageSize: 300,
  });

  // Apply hub-tab filter (Releases narrows to events with forecast/prior).
  const visibleEvents = useMemo(() => {
    return hubTab === 'releases' ? events.filter(isReleaseEvent) : events;
  }, [events, hubTab]);

  const { currentTime } = useEventCountdownTime(visibleEvents, true);

  const { pins: userPins, pin, unpin, pinningEventId } = useUserPinnedEvents();
  const { getCountForEvent } = useUserTradeEventCounts();

  // Match by event_id with cleaned-name fallback so pins captured in older
  // weeks (where the data-source rotated event ids) still resolve. Mirrors
  // EconomicEventListItem's `isEventPinned` helper.
  const isPinnedFor = (ev: EconomicEvent) => isEventPinned(ev, userPins);

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
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  const { user } = useAuth();
  const aiTasks = useOrionTasks(user?.id);

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
          return {
            title: 'Event details',
            icon: <EventsIcon fontSize="small" />,
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
    [userPins, events, getCountForEvent, pushPanel, tradeOps, isPanelOpen, currentView.id]
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
      {/* Page head */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'primary.main',
              lineHeight: 1.1,
              mb: 0.75,
            }}
          >
            Economic
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.85rem' },
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            Macro &amp; events
          </Typography>
          <Typography
            sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}
          >
            All economic data feeding your calendar · {weekRangeLabel}
            {visibleEvents.length > 0
              ? ` · ${visibleEvents.length} event${
                  visibleEvents.length === 1 ? '' : 's'
                }`
              : ''}
            {highImpactCount > 0 ? ` · ${highImpactCount} high-impact` : ''}
            {userPins.length > 0 ? ` · ${userPins.length} pinned` : ''}
          </Typography>
        </Box>

        <FilterPill
          value={impactFilter}
          onChange={setImpactFilter}
          theme={theme}
        />
      </Stack>

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
          theme={theme}
        />
        <Box sx={{ flex: 1 }} />
        <UpcomingToggle
          value={onlyUpcoming}
          onChange={setOnlyUpcoming}
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
        <HubTabs
          value={hubTab}
          onChange={setHubTab}
          disabled={{ releases: !isSelectedDayToday }}
          theme={theme}
        />

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

      <AIChatDrawer
        open={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        tradeOperations={tradeOps}
        aiTasks={aiTasks}
      />

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

const EconomicEventsPage: React.FC = () => {
  // Resolves to the GLOBAL SidePanelProvider — the local one is declared
  // inside the JSX below, so this body sits outside it.
  const { setOpen: setGlobalSidePanelOpen } = useSidePanel();
  const closeGlobalPanel = useCallback(
    () => setGlobalSidePanelOpen(false),
    [setGlobalSidePanelOpen]
  );
  return (
    <SidePanelProvider defaultView={{ id: 'events-home' }} defaultOpen={false}>
      <EconomicEventsPageInner closeGlobalPanel={closeGlobalPanel} />
    </SidePanelProvider>
  );
};

// ──────────────────────────────────────────────
// Filter pill — High / Med / Low / All
// ──────────────────────────────────────────────
const FilterPill: React.FC<{
  value: ImpactFilter;
  onChange: (v: ImpactFilter) => void;
  theme: Theme;
}> = ({ value, onChange, theme }) => (
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
    {IMPACT_FILTERS.map((opt) => {
      const active = opt.value === value;
      return (
        <ButtonBase
          key={opt.value}
          onClick={() => onChange(opt.value)}
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 0.875,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: active
              ? theme.palette.primary.contrastText
              : theme.palette.text.secondary,
            bgcolor: active ? 'primary.main' : 'transparent',
            transition: 'background 150ms, color 150ms',
            '&:hover': {
              color: active
                ? theme.palette.primary.contrastText
                : theme.palette.text.primary,
              bgcolor: active
                ? theme.palette.primary.dark
                : theme.palette.action.hover,
            },
          }}
        >
          {opt.label}
        </ButtonBase>
      );
    })}
  </Stack>
);

// ──────────────────────────────────────────────
// Currency chips — multi-select, persisted to user
// ──────────────────────────────────────────────
const CurrencyChips: React.FC<{
  selected: Currency[];
  onToggle: (c: Currency) => void;
  theme: Theme;
}> = ({ selected, onToggle, theme }) => {
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
          onClick={() => selected.forEach((c) => onToggle(c))}
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
// Upcoming-only toggle
// ──────────────────────────────────────────────
const UpcomingToggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  theme: Theme;
}> = ({ value, onChange, theme }) => (
  <ButtonBase
    onClick={() => onChange(!value)}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.875,
      px: 1.5,
      py: 0.625,
      borderRadius: 999,
      border: `1px solid ${
        value ? alpha(theme.palette.primary.main, 0.45) : theme.palette.divider
      }`,
      bgcolor: value ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
      color: value ? theme.palette.primary.main : theme.palette.text.secondary,
      fontSize: '0.78rem',
      fontWeight: 600,
      transition: 'background 150ms, color 150ms, border-color 150ms',
      '&:hover': {
        color: theme.palette.text.primary,
        borderColor: alpha(theme.palette.primary.main, 0.4),
      },
    }}
    role="switch"
    aria-checked={value}
  >
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: value
          ? theme.palette.primary.main
          : alpha(theme.palette.text.primary, 0.2),
        transition: 'background 150ms',
      }}
    />
    Upcoming only
  </ButtonBase>
);

// ──────────────────────────────────────────────
// Hub tabs — Calendar / Releases
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

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Fill grid cell. Parent caps height to viewport so rows scroll
        // internally and the main page never grows past the screen.
        height: { xs: 'auto', md: '100%' },
        minHeight: { xs: 360, md: 0 },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EventsIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontFeatureSettings: "'tnum' on",
          }}
        >
          {loading
            ? 'Loading…'
            : events.length === 0
              ? 'No events'
              : `${events.length} event${events.length === 1 ? '' : 's'}${
                  highCount > 0 ? ` · ${highCount} high` : ''
                }`}
        </Typography>
      </Stack>

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
            <EventRow
              key={ev.id}
              event={ev}
              firstRow={idx === 0}
              isNow={isNow}
              pinned={pinned}
              busy={busy}
              tradeCount={getTradeCount(ev)}
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
    </Box>
  );
};

// ──────────────────────────────────────────────
// Single event row — flag + currency / time + countdown / name + values
// + impact bars + pin. Mirrors EconomicEventListItem visual treatment so
// this can eventually replace it.
// ──────────────────────────────────────────────
const EventRow: React.FC<{
  event: EconomicEvent;
  firstRow: boolean;
  isNow: boolean;
  pinned: boolean;
  busy: boolean;
  tradeCount: number;
  currentTime: Date;
  onTogglePin: (e: React.MouseEvent) => void;
  onClick: () => void;
  theme: Theme;
}> = ({
  event,
  firstRow,
  isNow,
  pinned,
  busy,
  tradeCount,
  currentTime,
  onTogglePin,
  onClick,
  theme,
}) => {
  const timeInfo = useMemo(
    () => computeTimeInfo(event.time_utc, currentTime),
    [event.time_utc, currentTime]
  );

  const actualStyle = getActualResultStyle(event.actual_result_type, theme);
  const hasAnyValue = Boolean(
    event.actual_value || event.forecast_value || event.previous_value
  );

  const nowDotSx = isNow
    ? {
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: theme.palette.primary.main,
          boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.8)}`,
          animation: 'eventNowPulse 2.4s ease-in-out infinite',
        },
        '@keyframes eventNowPulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before': { animation: 'none' },
        },
      }
    : {};

  // Imminent rows pick up a tinted background keyed off impact, identical
  // to the legacy item so traders get the same visual cue.
  const imminentBg = timeInfo.isImminent
    ? alpha(impactColor(event.impact, theme), 0.12)
    : null;

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto auto',
        gap: 1.5,
        alignItems: 'flex-start',
        px: 2.25,
        py: 1.75,
        borderTop: firstRow ? 'none' : `1px solid ${theme.palette.divider}`,
        bgcolor: isNow
          ? alpha(theme.palette.primary.main, 0.16)
          : imminentBg ?? 'transparent',
        opacity: timeInfo.isPassed ? 0.62 : 1,
        cursor: 'pointer',
        transition: 'background 180ms, opacity 180ms',
        '&:hover': {
          bgcolor: isNow
            ? alpha(theme.palette.primary.main, 0.2)
            : alpha(theme.palette.primary.main, 0.04),
        },
        ...nowDotSx,
      }}
    >
      {/* Flag + currency */}
      <Box
        sx={{
          minWidth: 36,
          mt: 0.25,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {event.flag_url ? (
          <Box
            component="img"
            src={event.flag_url}
            alt={event.country || event.currency || ''}
            sx={{
              width: 22,
              height: 16,
              borderRadius: 0.375,
              objectFit: 'cover',
              border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 22,
              height: 16,
              borderRadius: 0.375,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
            }}
          />
        )}
        <Typography
          sx={{
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: 'text.primary',
            lineHeight: 1,
          }}
        >
          {event.currency}
        </Typography>
      </Box>

      {/* Body — time row, name, values */}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: timeInfo.isUpcoming ? 'text.primary' : 'text.secondary',
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {event.is_all_day ? 'All day' : formatTime(event.time_utc)}
          </Typography>
          {timeInfo.isPassed ? (
            <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
          ) : timeInfo.countdown ? (
            <Typography
              sx={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: timeInfo.isImminent ? 'error.main' : 'warning.main',
                animation: timeInfo.isImminent
                  ? 'eventCountdownPulse 1s infinite'
                  : 'none',
                '@keyframes eventCountdownPulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none',
                },
              }}
            >
              {timeInfo.countdown}
            </Typography>
          ) : null}
        </Stack>

        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.event_name}
        </Typography>

        {hasAnyValue && (
          <Stack
            direction="row"
            spacing={0.875}
            alignItems="center"
            flexWrap="wrap"
            sx={{ mt: 0.625, rowGap: 0.5 }}
          >
            {event.actual_value ? (
              <ValuePill
                label={`A: ${event.actual_value}`}
                bg={actualStyle.bg}
                border={actualStyle.border}
                color={actualStyle.color}
              />
            ) : (
              (event.forecast_value || event.previous_value) && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'text.disabled',
                    }}
                  >
                    A:
                  </Typography>
                  <HourglassEmptyIcon
                    sx={{ fontSize: 12, color: 'warning.main' }}
                  />
                </Stack>
              )
            )}
            {event.forecast_value && (
              <ValuePill
                label={`F: ${event.forecast_value}`}
                bg={alpha(theme.palette.info.main, 0.1)}
                border={alpha(theme.palette.info.main, 0.2)}
                color={theme.palette.text.secondary}
              />
            )}
            {event.previous_value && (
              <ValuePill
                label={`P: ${event.previous_value}`}
                bg={alpha(theme.palette.grey[500], 0.1)}
                border={alpha(theme.palette.grey[500], 0.2)}
                color={theme.palette.text.disabled}
              />
            )}
            {tradeCount > 0 && (
              <Tooltip
                title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''} across all calendars`}
                placement="top"
                arrow
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.375,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: alpha(theme.palette.primary.main, 0.14),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                    color: theme.palette.primary.main,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    lineHeight: 1.4,
                  }}
                >
                  {tradeCount}×
                </Box>
              </Tooltip>
            )}
          </Stack>
        )}
        {!hasAnyValue && tradeCount > 0 && (
          <Tooltip
            title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''} across all calendars`}
            placement="top"
            arrow
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                mt: 0.5,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                color: theme.palette.primary.main,
                fontSize: '0.68rem',
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              {tradeCount}×
            </Box>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ pt: 0.5 }}>
        <ImpactBars impact={event.impact} theme={theme} />
      </Box>

      <Tooltip title={pinned ? 'Unpin event' : 'Pin event'} placement="left">
        <span>
          <IconButton
            size="small"
            onClick={onTogglePin}
            disabled={busy}
            sx={{
              color: pinned ? 'primary.main' : 'text.disabled',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            {busy ? (
              <CircularProgress size={14} />
            ) : pinned ? (
              <PinIcon sx={{ fontSize: 16 }} />
            ) : (
              <UnpinIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

const ValuePill: React.FC<{
  label: string;
  bg: string;
  border: string;
  color: string;
}> = ({ label, bg, border, color }) => (
  <Box
    sx={{
      px: 0.875,
      py: 0.25,
      borderRadius: 0.75,
      bgcolor: bg,
      border: `1px solid ${border}`,
      color,
      fontSize: '0.7rem',
      fontWeight: 700,
      fontFeatureSettings: "'tnum' on, 'lnum' on",
      lineHeight: 1.4,
    }}
  >
    {label}
  </Box>
);

const impactColor = (impact: ImpactLevel, theme: Theme): string => {
  switch (impact) {
    case 'High':
      return theme.palette.error.main;
    case 'Medium':
      return theme.palette.warning.main;
    case 'Low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

const ImpactBars: React.FC<{
  impact: ImpactLevel;
  theme: Theme;
}> = ({ impact, theme }) => {
  const filledCount =
    impact === 'High' ? 3 : impact === 'Medium' ? 2 : impact === 'Low' ? 1 : 0;
  const filledColor =
    impact === 'High'
      ? theme.palette.error.main
      : impact === 'Medium'
        ? theme.palette.warning.main
        : impact === 'Low'
          ? theme.palette.success.main
          : alpha(theme.palette.text.primary, 0.18);
  const dim = alpha(theme.palette.text.primary, 0.12);
  return (
    <Stack direction="row" spacing={0.375} aria-label={`${impact} impact`}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 12,
            borderRadius: '1.5px',
            bgcolor: i < filledCount ? filledColor : dim,
          }}
        />
      ))}
    </Stack>
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
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        p: 2.25,
      }}
    >
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '0.85rem',
          letterSpacing: '-0.005em',
          mb: 1.5,
        }}
      >
        Impact distribution · this week
      </Typography>
      <Stack spacing={1.25}>
        {rows.map((row) => {
          const count = counts[row.key];
          const pct = Math.max(4, Math.round((count / max) * 100));
          return (
            <Box
              key={row.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 30px',
                gap: 1.25,
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                {row.label}
              </Typography>
              <Box
                sx={{
                  height: 6,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${pct}%`,
                    bgcolor: row.color,
                    transition: 'width 200ms',
                  }}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textAlign: 'right',
                  fontFeatureSettings: "'tnum' on",
                }}
              >
                {count}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
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

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        flex: { xs: 'none', lg: 1 },
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          px: 2.25,
          py: 1.625,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 0.875,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PinIcon sx={{ fontSize: 13 }} />
        </Box>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '-0.005em',
          }}
        >
          Pinned events
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            fontFeatureSettings: "'tnum' on",
            fontWeight: 600,
          }}
        >
          {pins.length}
        </Typography>
      </Stack>

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
    </Box>
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
            theme.palette.mode === 'dark'
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
