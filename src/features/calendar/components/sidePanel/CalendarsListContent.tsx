import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CalendarToday,
  DeleteOutline as TrashIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Restore as RestoreIcon,
  Link as LinkIcon,
  Add as AddIcon,
  KeyboardArrowDown as ChevronDownIcon,
} from '@mui/icons-material';
import { format, isValid, differenceInDays } from 'date-fns';
import { Calendar } from '../../types/calendar';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import ShareButton from '../sharing/ShareButton';
import {
  useCalendars,
  useTrashCalendars,
} from '../../hooks/useCalendars';
import { useAuthState } from 'contexts/AuthStateContext';
import RoundedTabs, { TabPanel } from 'components/common/RoundedTabs';
import CalendarsPanelShimmer from './CalendarsPanelShimmer';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import PnlValue from 'components/common/PnlValue';
import InfoStrip from 'components/common/InfoStrip';
import {
  EYEBROW_SX,
  TNUM,
  getInsetSurface,
  getCardShellSx,
} from 'styles/designTokens';
import { isDarkMode } from 'utils/themeMode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared tabular-numeric sx used for every stacked number in this panel. */
const tnumSx = {
  fontFeatureSettings: TNUM,
  fontWeight: 600,
} as const;

const safeFormatDate = (
  date: Date | string | undefined | null,
  formatStr: string,
  fallback: string = 'N/A'
): string => {
  if (!date) return fallback;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(dateObj)) return fallback;
  try {
    return format(dateObj, formatStr);
  } catch {
    return fallback;
  }
};

const getDaysUntilDeletion = (
  autoDeleteAt: Date | string | undefined | null
): number => {
  if (!autoDeleteAt) return 30;
  const deleteDate =
    typeof autoDeleteAt === 'string'
      ? new Date(autoDeleteAt)
      : autoDeleteAt;
  if (!isValid(deleteDate)) return 30;
  return Math.max(0, differenceInDays(deleteDate, new Date()));
};

/** Compact currency: $1.2M / $24k / $1,240 — matches the design's `fmtCurrency`. */
const fmtCurrencyCompact = (n: number | undefined | null): string => {
  if (!n) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000).toLocaleString()}k`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

/** Exact currency without cents: $7,552,661 — used for the hero PnL. */
const fmtCurrencyExact = (n: number | undefined | null): string => {
  if (!n) return '$0';
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
};

/** Derive a monotonic-ish equity curve from year_stats.monthly_stats. */
const buildEquityCurve = (calendar: Calendar): number[] | null => {
  const yearStats = calendar.year_stats;
  if (!yearStats) return null;
  const years = Object.keys(yearStats)
    .map(Number)
    .filter((y) => !isNaN(y))
    .sort((a, b) => a - b);
  if (years.length === 0) return null;

  const start = calendar.account_balance || 0;
  let running = start;
  const points: number[] = [start];

  for (const year of years) {
    const months = yearStats[String(year)]?.monthly_stats;
    if (!months) continue;
    const sorted = [...months].sort((a, b) => a.month_index - b.month_index);
    for (const m of sorted) {
      if (m.trade_count > 0) {
        running += m.month_pnl;
        points.push(running);
      }
    }
  }
  return points.length > 1 ? points : null;
};

/**
 * Stable per-calendar hero gradient when no hero image is set.
 *
 * Built from the violet brand at varying alphas + the neutral slate steps so
 * every calendar gets a unique-but-on-brand swatch instead of the previous
 * mix of warm/cold hardcoded hexes. Uses the canonical primary.main +
 * tintViolet.{soft,strong} so it follows theme dark/light mode automatically.
 */
const useHeroGradient = (): ((id: string) => string) => {
  const theme = useTheme();
  return (id: string): string => {
    const violet = theme.palette.primary.main;
    const violetSoft = theme.palette.custom.tintViolet.soft;
    const violetStrong = theme.palette.custom.tintViolet.strong;
    const surface = theme.palette.background.paper;
    const palettes = [
      `linear-gradient(135deg, ${violet} 0%, ${violetStrong} 50%, ${surface} 100%)`,
      `linear-gradient(135deg, ${violetStrong} 0%, ${violet} 50%, ${violetSoft} 100%)`,
      `linear-gradient(135deg, ${violet} 0%, ${violetSoft} 60%, ${surface} 100%)`,
      `linear-gradient(135deg, ${violetSoft} 0%, ${violet} 50%, ${violetStrong} 100%)`,
      `linear-gradient(135deg, ${violetStrong} 0%, ${violetSoft} 50%, ${surface} 100%)`,
      `linear-gradient(135deg, ${violet} 0%, ${violetStrong} 35%, ${violetSoft} 100%)`,
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return palettes[Math.abs(hash) % palettes.length];
  };
};

const heroLabel = (name: string): string => {
  const parts = name.trim().split(/[\s_\-—·.]+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

interface SparklineProps {
  data: number[] | null;
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  areaOpacity?: number;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  color,
  width = 100,
  height = 28,
  strokeWidth = 1.5,
  areaOpacity = 0.18,
}) => {
  const gradientId = useMemo(
    () => `spark-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  if (!data || data.length < 2) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ height: 1, width: width - 8, bgcolor: 'divider' }} />
      </Box>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 3;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    padY + (1 - (v - min) / range) * (height - padY * 2),
  ]);
  const linePath = pts
    .map(([x, y], i) =>
      i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`
    )
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={areaOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
};

// Sparkline wrapper that fills its parent's width. Measures via ResizeObserver
// and re-renders the SVG when the panel resizes (so the hero curve stays
// edge-to-edge as the side panel grows).
const ResponsiveSparkline: React.FC<Omit<SparklineProps, 'width'>> = (props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <Box ref={ref} sx={{ width: '100%' }}>
      {width > 0 && <Sparkline {...props} width={width} />}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Hero swatch (avatar)
// ---------------------------------------------------------------------------

interface HeroSwatchProps {
  calendar: Calendar;
  size?: number;
  radius?: number;
}

const HeroSwatch: React.FC<HeroSwatchProps> = ({
  calendar,
  size = 26,
  radius,
}) => {
  const theme = useTheme();
  const heroGradient = useHeroGradient();
  const radiusPx = radius ?? theme.palette.custom.radius.sm;
  const background = calendar.hero_image_url
    ? `center / cover no-repeat url(${calendar.hero_image_url})`
    : heroGradient(calendar.id);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${radiusPx}px`,
        background,
        display: 'grid',
        placeItems: 'center',
        color: 'rgba(255,255,255,0.9)',
        fontFeatureSettings: TNUM,
        fontWeight: 700,
        fontSize: size > 40 ? 14 : 11,
        letterSpacing: '0.02em',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        textShadow: '0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      {!calendar.hero_image_url && heroLabel(calendar.name)}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Hero (focused) card
// ---------------------------------------------------------------------------

interface FocusedCalendarCardProps {
  calendar: Calendar;
  isActive: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onLink?: () => void;
  onDelete?: () => void;
  onUpdateCalendarProperty?: CalendarsListContentProps['onUpdateCalendarProperty'];
}

const FocusedCalendarCard: React.FC<FocusedCalendarCardProps> = ({
  calendar,
  isActive,
  onClick,
  onEdit,
  onDuplicate,
  onLink,
  onDelete,
  onUpdateCalendarProperty,
}) => {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const pnl = calendar.total_pnl || 0;
  const trades = calendar.total_trades || 0;
  const empty = trades === 0;
  const positive = pnl >= 0;
  const initial = calendar.account_balance || 0;
  const current = initial + pnl;
  const pct = empty || initial === 0 ? 0 : (pnl / initial) * 100;

  const pnlColor = empty
    ? theme.palette.text.secondary
    : positive
      ? theme.palette.success.main
      : theme.palette.error.main;

  const curve = useMemo(() => buildEquityCurve(calendar), [calendar]);
  const isLight = !isDarkMode(theme);
  const insetSurface = getInsetSurface(theme);
  const divider = theme.palette.divider;

  return (
    <Box
      onClick={onClick}
      sx={{
        ...getCardShellSx(theme, 'lg'),
        bgcolor: isLight
          ? theme.palette.background.paper
          : insetSurface,
        borderColor: isActive
          ? alpha(theme.palette.primary.main, 0.45)
          : divider,
        p: 1.75,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: isActive
          ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.25)} inset, 0 8px 20px ${alpha(theme.palette.primary.main, 0.08)}`
          : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      {/* Header row */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ mb: 1.5 }}
      >
        <HeroSwatch calendar={calendar} size={28} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {calendar.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              color: 'text.secondary',
              mt: '2px',
            }}
          >
            <Box component="span" sx={tnumSx}>
              {trades}
            </Box>{' '}
            trades · {empty ? 'no activity' : 'active'}
          </Typography>
        </Box>
        {onUpdateCalendarProperty && (
          <ShareButton
            type="calendar"
            item={calendar}
            onUpdateItemProperty={onUpdateCalendarProperty}
            size="small"
          />
        )}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor(e.currentTarget);
          }}
          sx={{ color: 'text.secondary', p: 0.5 }}
        >
          <MoreVertIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          onClick={(e) => e.stopPropagation()}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onEdit?.();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDuplicate?.();
            }}
          >
            <ListItemIcon>
              <DuplicateIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onLink?.();
            }}
          >
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Link Calendar</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDelete?.();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </Stack>

      {/* PnL row */}
      <Stack
        direction="row"
        alignItems="baseline"
        spacing={1}
        sx={{ mb: 1.25 }}
      >
        {empty ? (
          <Typography
            sx={{
              ...tnumSx,
              fontSize: '1.5rem',
              color: pnlColor,
              lineHeight: 1,
              letterSpacing: '-0.015em',
            }}
          >
            $0
          </Typography>
        ) : (
          <PnlValue
            amount={pnl}
            format={fmtCurrencyExact}
            arrow={false}
            size="lg"
            sx={{ lineHeight: 1, letterSpacing: '-0.015em' }}
          />
        )}
        <Typography
          sx={{
            ...tnumSx,
            fontSize: '0.75rem',
            color: pnlColor,
          }}
        >
          {empty
            ? '0.00%'
            : `${positive ? '+' : ''}${pct.toFixed(2)}%`}
        </Typography>
      </Stack>

      {/* Sparkline */}
      {empty || !curve ? (
        <Box
          sx={{
            height: 72,
            display: 'grid',
            placeItems: 'center',
            color: 'text.secondary',
            fontSize: '0.6875rem',
          }}
        >
          {empty ? 'No trades yet' : 'Not enough data for a curve'}
        </Box>
      ) : (
        <ResponsiveSparkline
          data={curve}
          color={pnlColor}
          height={72}
          strokeWidth={1.6}
        />
      )}

      {/* Inline 3-stat row */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          mt: 1.25,
          pt: 1.25,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <InlineStat
          label="Win"
          value={empty ? '—' : `${(calendar.win_rate || 0).toFixed(0)}%`}
        />
        <Box sx={{ width: '1px', bgcolor: divider }} />
        <InlineStat
          label="PF"
          value={empty ? '—' : (calendar.profit_factor || 0).toFixed(2)}
          tooltip="Profit factor: gross profit / gross loss"
        />
        <Box sx={{ width: '1px', bgcolor: divider }} />
        <InlineStat
          label="DD"
          value={empty ? '—' : `${(calendar.max_drawdown || 0).toFixed(1)}%`}
          tooltip="Max drawdown"
        />
        <Box sx={{ width: '1px', bgcolor: divider }} />
        <InlineStat label="Bal" value={fmtCurrencyCompact(current)} />
      </Stack>
    </Box>
  );
};

interface InlineStatProps {
  label: string;
  value: string;
  tooltip?: string;
}

const InlineStat: React.FC<InlineStatProps> = ({ label, value, tooltip }) => {
  const inner = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          ...EYEBROW_SX,
          fontSize: '0.625rem',
          letterSpacing: '0.06em',
          mb: '2px',
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          ...tnumSx,
          fontSize: '0.75rem',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="top">
      {inner}
    </Tooltip>
  ) : (
    inner
  );
};

// ---------------------------------------------------------------------------
// Watchlist row
// ---------------------------------------------------------------------------

interface WatchRowProps {
  calendar: Calendar;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onLink?: () => void;
  onDelete?: () => void;
}

const WatchRow: React.FC<WatchRowProps> = ({
  calendar,
  isActive,
  isLast,
  onClick,
  onEdit,
  onDuplicate,
  onLink,
  onDelete,
}) => {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const pnl = calendar.total_pnl || 0;
  const trades = calendar.total_trades || 0;
  const empty = trades === 0;
  const positive = pnl >= 0;
  const initial = calendar.account_balance || 0;
  const pct = empty || initial === 0 ? 0 : (pnl / initial) * 100;
  const winRate = calendar.win_rate || 0;

  const pnlColor = empty
    ? theme.palette.text.secondary
    : positive
      ? theme.palette.success.main
      : theme.palette.error.main;

  const curve = useMemo(() => buildEquityCurve(calendar), [calendar]);

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1.125,
        cursor: 'pointer',
        bgcolor: isActive
          ? alpha(theme.palette.primary.main, 0.07)
          : 'transparent',
        borderBottom: isLast ? 0 : `1px solid ${theme.palette.divider}`,
        transition: 'background .12s',
        '&:hover': {
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.1)
            : getInsetSurface(theme),
          '& .row-actions': { opacity: 1 },
        },
      }}
    >
      {isActive && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            bgcolor: 'primary.main',
          }}
        />
      )}
      <HeroSwatch calendar={calendar} size={28} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.78125rem',
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {calendar.name}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.625rem',
            color: 'text.secondary',
            mt: '2px',
          }}
        >
          <Box component="span" sx={tnumSx}>
            {trades}
          </Box>{' '}
          trades
          {!empty && (
            <>
              {' · '}
              <Box component="span" sx={tnumSx}>
                {winRate.toFixed(0)}%
              </Box>
            </>
          )}
        </Typography>
      </Box>

      {/* Sparkline is decorative — hide on phones to free width for the
          name + pnl so the row fits at 360px. */}
      <Box sx={{ flexShrink: 0, opacity: 0.85, display: { xs: 'none', sm: 'block' } }}>
        <Sparkline
          data={empty ? null : curve}
          color={pnlColor}
          width={44}
          height={18}
          strokeWidth={1.25}
          areaOpacity={0.12}
        />
      </Box>

      <Box
        sx={{
          textAlign: 'right',
          flexShrink: 0,
          minWidth: { xs: 64, sm: 78 },
          px: 0.875,
          py: 0.5,
          borderRadius: `${theme.palette.custom.radius.sm}px`,
          bgcolor: empty
            ? 'transparent'
            : positive
              ? alpha(theme.palette.success.main, 0.1)
              : alpha(theme.palette.error.main, 0.1),
        }}
      >
        {empty ? (
          <Typography
            sx={{
              ...tnumSx,
              fontSize: '0.75rem',
              color: pnlColor,
              lineHeight: 1,
            }}
          >
            $0
          </Typography>
        ) : (
          <PnlValue
            amount={pnl}
            format={fmtCurrencyCompact}
            arrow={false}
            size="sm"
            sx={{ fontSize: '0.75rem', lineHeight: 1 }}
          />
        )}
        <Typography
          sx={{
            ...tnumSx,
            fontSize: '0.59375rem',
            color: pnlColor,
            mt: '2px',
            opacity: empty ? 0.5 : 1,
          }}
        >
          {empty ? '0.00%' : `${positive ? '+' : ''}${pct.toFixed(2)}%`}
        </Typography>
      </Box>

      <Box className="row-actions" sx={{ opacity: 0, transition: 'opacity .12s' }}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor(e.currentTarget);
          }}
          sx={{ color: 'text.secondary', p: 0.25 }}
        >
          <MoreVertIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onEdit?.();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDuplicate?.();
          }}
        >
          <ListItemIcon>
            <DuplicateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onLink?.();
          }}
        >
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Link Calendar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDelete?.();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Trash row (retained from previous design, lightly restyled)
// ---------------------------------------------------------------------------

interface TrashItemProps {
  calendar: Calendar;
  onRestore: (calendarId: string) => Promise<void>;
  onPermanentDelete: (calendarId: string) => Promise<void>;
}

const TrashCalendarPanelItem: React.FC<TrashItemProps> = ({
  calendar,
  onRestore,
  onPermanentDelete,
}) => {
  const theme = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pnl = calendar.total_pnl || 0;
  const trades = calendar.total_trades || 0;
  const daysLeft = getDaysUntilDeletion(calendar.auto_delete_at);

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoreOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const confirmRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(calendar.id);
      setRestoreOpen(false);
    } finally {
      setIsRestoring(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onPermanentDelete(calendar.id);
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${theme.palette.custom.radius.md}px`,
        bgcolor: getInsetSurface(theme),
        border: `1px solid ${theme.palette.divider}`,
        opacity: 0.92,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
        <HeroSwatch calendar={calendar} size={28} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {calendar.name}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
            <Box component="span" sx={tnumSx}>
              {trades}
            </Box>{' '}
            trades · deleted {safeFormatDate(calendar.deleted_at, 'MMM d')}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          {pnl === 0 ? (
            <Typography
              sx={{
                ...tnumSx,
                fontSize: '0.75rem',
                color: 'text.secondary',
                lineHeight: 1,
              }}
            >
              $0
            </Typography>
          ) : (
            <PnlValue
              amount={pnl}
              format={fmtCurrencyCompact}
              arrow={false}
              size="sm"
              sx={{ fontSize: '0.75rem', lineHeight: 1 }}
            />
          )}
          <Stack
            direction="row"
            spacing={0.25}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ mt: 0.5 }}
          >
            <ScheduleIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
              {daysLeft}d left
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
          onClick={handleRestoreClick}
          disabled={isRestoring || isDeleting}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            flex: 1,
            borderColor: alpha(theme.palette.primary.main, 0.3),
          }}
        >
          Restore
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
          onClick={handleDeleteClick}
          disabled={isRestoring || isDeleting}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            flex: 1,
            color: 'error.main',
            borderColor: alpha(theme.palette.error.main, 0.3),
            '&:hover': {
              borderColor: theme.palette.error.main,
              bgcolor: alpha(theme.palette.error.main, 0.08),
            },
          }}
        >
          Delete
        </Button>
      </Stack>

      <ConfirmationDialog
        open={restoreOpen}
        title="Restore calendar?"
        message={`"${calendar.name}" will be moved back to your active calendars.`}
        confirmText="Restore"
        confirmColor="primary"
        onConfirm={confirmRestore}
        onCancel={() => !isRestoring && setRestoreOpen(false)}
        isSubmitting={isRestoring}
      />
      <ConfirmationDialog
        open={deleteOpen}
        title="Delete permanently?"
        message={`"${calendar.name}" and all its trades will be deleted forever. This cannot be undone.`}
        confirmText="Delete forever"
        confirmColor="error"
        onConfirm={confirmDelete}
        onCancel={() => !isDeleting && setDeleteOpen(false)}
        isSubmitting={isDeleting}
      />
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Shimmer placeholder is now CalendarsPanelShimmer (own file) so the
// AppLayout Suspense fallback can render it without waiting for this
// chunk to download.
// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type SortMode = 'pnl' | 'name' | 'recent';

export interface CalendarsListContentProps {
  isActive?: boolean;
  initialTab?: number;
  activeCalendarId?: string;
  onCalendarClick: (calendarId: string) => void;
  onCreateCalendar?: () => void;
  onEditCalendar?: (calendar: Calendar) => void;
  onDuplicateCalendar?: (calendar: Calendar) => void;
  onLinkCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar?: (calendarId: string) => void;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  onRestoreCalendar?: (calendarId: string) => Promise<void>;
  onPermanentDeleteCalendar?: (calendarId: string) => Promise<void>;
}

const CalendarsListContent: React.FC<CalendarsListContentProps> = ({
  isActive = true,
  initialTab = 0,
  activeCalendarId,
  onCalendarClick,
  onCreateCalendar,
  onEditCalendar,
  onDuplicateCalendar,
  onLinkCalendar,
  onDeleteCalendar,
  onUpdateCalendarProperty,
  onRestoreCalendar,
  onPermanentDeleteCalendar,
}) => {
  const theme = useTheme();
  const { user } = useAuthState();
  const [tabIndex, setTabIndex] = useState(initialTab);
  const [sortMode, setSortMode] = useState<SortMode>('pnl');
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const {
    calendars,
    isLoading: loadingCalendars,
    refresh: refreshCalendars,
  } = useCalendars(isActive ? user?.uid : undefined);

  const {
    trashCalendars,
    isLoading: loadingTrash,
    refresh: refreshTrash,
  } = useTrashCalendars(
    isActive && tabIndex === 1 ? user?.uid : undefined
  );

  useEffect(() => {
    if (isActive) {
      if (tabIndex === 0) refreshCalendars();
      else refreshTrash();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const calendarList = calendars || [];
  const trashList = trashCalendars || [];

  const sortedCalendars = useMemo(() => {
    const list = [...calendarList];
    if (sortMode === 'pnl') {
      list.sort((a, b) => (b.total_pnl || 0) - (a.total_pnl || 0));
    } else if (sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'recent') {
      list.sort((a, b) => {
        const aT = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bT = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bT - aT;
      });
    }
    return list;
  }, [calendarList, sortMode]);

  const focusedCalendar = useMemo(() => {
    if (calendarList.length === 0) return null;
    return (
      calendarList.find((c) => c.id === activeCalendarId) || calendarList[0]
    );
  }, [calendarList, activeCalendarId]);

  const combinedPnl = useMemo(
    () => calendarList.reduce((sum, c) => sum + (c.total_pnl || 0), 0),
    [calendarList]
  );

  const insetSurface = getInsetSurface(theme);
  const isDark = isDarkMode(theme);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const isLoading = tabIndex === 0 ? loadingCalendars : loadingTrash;
  const sortLabelMap: Record<SortMode, string> = {
    pnl: 'P&L',
    name: 'Name',
    recent: 'Recent',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header summary */}
      <Box sx={{ px: 2, pt: 1.75, pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: 'text.secondary',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.5,
                flexWrap: 'wrap',
              }}
              component="div"
            >
              <Box component="span" sx={tnumSx}>
                {calendarList.length}
              </Box>
              <Box component="span">
                {calendarList.length === 1 ? 'calendar' : 'calendars'}
              </Box>
              {calendarList.length > 0 && (
                <>
                  <Box component="span">· combined</Box>
                  <PnlValue
                    amount={combinedPnl}
                    format={fmtCurrencyCompact}
                    arrow={false}
                    size="sm"
                    sx={{ fontSize: '0.6875rem' }}
                  />
                </>
              )}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ px: 2, pb: 1 }}>
        <RoundedTabs
          tabs={[
            {
              label: 'All Calendars',
              icon: <CalendarToday sx={{ fontSize: 16 }} />,
            },
            {
              label: 'Trash',
              icon: <TrashIcon sx={{ fontSize: 16 }} />,
            },
          ]}
          activeTab={tabIndex}
          onTabChange={handleTabChange}
          variant="contained"
          fullWidth
        />
      </Box>

      {/* Scroll body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 1,
          ...scrollbarStyles(theme),
        }}
      >
        {isLoading ? (
          <CalendarsPanelShimmer />
        ) : tabIndex === 0 ? (
          <TabPanel value={tabIndex} index={0}>
            {calendarList.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <CalendarToday
                  sx={{ fontSize: 40, color: 'text.secondary', mb: 1.5 }}
                />
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                  No calendars yet
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 240 }}
                >
                  Create your first calendar to start tracking
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {/* Focused / hero card */}
                {focusedCalendar && (
                  <FocusedCalendarCard
                    calendar={focusedCalendar}
                    isActive={focusedCalendar.id === activeCalendarId}
                    onClick={() => onCalendarClick(focusedCalendar.id)}
                    onEdit={() => onEditCalendar?.(focusedCalendar)}
                    onDuplicate={() => onDuplicateCalendar?.(focusedCalendar)}
                    onLink={() => onLinkCalendar?.(focusedCalendar)}
                    onDelete={() => onDeleteCalendar?.(focusedCalendar.id)}
                    onUpdateCalendarProperty={onUpdateCalendarProperty}
                  />
                )}

                {/* Section header + sort dropdown */}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ px: 0.5, mt: 0.5 }}
                >
                  <Typography sx={{ ...EYEBROW_SX, letterSpacing: '0.08em' }}>
                    All calendars
                  </Typography>
                  <Button
                    size="small"
                    onClick={(e) => setSortAnchor(e.currentTarget)}
                    endIcon={<ChevronDownIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: `${theme.palette.custom.radius.sm}px`,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                      },
                    }}
                  >
                    {sortLabelMap[sortMode]}
                  </Button>
                  <Menu
                    anchorEl={sortAnchor}
                    open={Boolean(sortAnchor)}
                    onClose={() => setSortAnchor(null)}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  >
                    {(['pnl', 'name', 'recent'] as SortMode[]).map((mode) => (
                      <MenuItem
                        key={mode}
                        selected={mode === sortMode}
                        onClick={() => {
                          setSortMode(mode);
                          setSortAnchor(null);
                        }}
                      >
                        <ListItemText>{sortLabelMap[mode]}</ListItemText>
                      </MenuItem>
                    ))}
                  </Menu>
                </Stack>

                {/* Watchlist */}
                <Box
                  sx={{
                    bgcolor: isDark
                      ? insetSurface
                      : theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: `${theme.palette.custom.radius.md}px`,
                    overflow: 'hidden',
                  }}
                >
                  {sortedCalendars.map((cal, i) => (
                    <WatchRow
                      key={cal.id}
                      calendar={cal}
                      isActive={cal.id === activeCalendarId}
                      isLast={i === sortedCalendars.length - 1}
                      onClick={() => onCalendarClick(cal.id)}
                      onEdit={() => onEditCalendar?.(cal)}
                      onDuplicate={() => onDuplicateCalendar?.(cal)}
                      onLink={() => onLinkCalendar?.(cal)}
                      onDelete={() => onDeleteCalendar?.(cal.id)}
                    />
                  ))}
                </Box>
              </Stack>
            )}
          </TabPanel>
        ) : (
          <TabPanel value={tabIndex} index={1}>
            {trashList.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <TrashIcon
                  sx={{ fontSize: 40, color: 'text.secondary', mb: 1.5 }}
                />
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                  Trash is empty
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 240 }}
                >
                  Deleted calendars appear here for 30 days
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                <InfoStrip
                  tone="warning"
                  icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                  sx={{ mb: 0.5 }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="warning.main"
                  >
                    Auto-deleted after 30 days
                  </Typography>
                </InfoStrip>
                {trashList.map((cal) => (
                  <TrashCalendarPanelItem
                    key={cal.id}
                    calendar={cal}
                    onRestore={onRestoreCalendar || (async () => {})}
                    onPermanentDelete={
                      onPermanentDeleteCalendar || (async () => {})
                    }
                  />
                ))}
              </Stack>
            )}
          </TabPanel>
        )}
      </Box>

      {/* Footer */}
      {tabIndex === 0 && onCreateCalendar && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            gap: 0.75,
          }}
        >
          <Button
            onClick={onCreateCalendar}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              flex: 1,
              height: 36,
              border: `1px dashed ${theme.palette.divider}`,
              borderRadius: `${theme.palette.custom.radius.md}px`,
              color: 'text.secondary',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              bgcolor: 'transparent',
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.5),
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.05),
              },
            }}
          >
            New calendar
          </Button>
          <IconButton
            onClick={() => setTabIndex(1)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: `${theme.palette.custom.radius.md}px`,
              bgcolor: isDark
                ? insetSurface
                : theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                borderColor: alpha(theme.palette.primary.main, 0.3),
              },
            }}
          >
            <TrashIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default CalendarsListContent;
