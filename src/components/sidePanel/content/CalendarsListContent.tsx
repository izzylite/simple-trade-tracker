import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  useTheme,
  alpha,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CalendarToday,
  DeleteOutline as TrashIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Restore as RestoreIcon,
  InfoOutlined,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format, isValid, differenceInDays } from 'date-fns';
import { Calendar } from '../../../types/calendar';
import { formatCurrency } from '../../../utils/formatters';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import ShareButton from '../../sharing/ShareButton';
import {
  useCalendars,
  useTrashCalendars,
} from '../../../hooks/useCalendars';
import { useAuthState } from '../../../contexts/AuthStateContext';
import RoundedTabs, { TabPanel } from '../../common/RoundedTabs';
import Shimmer from '../../Shimmer';

const safeFormatDate = (
  date: Date | string | undefined | null,
  formatStr: string,
  fallback: string = 'N/A'
): string => {
  if (!date) return fallback;
  const dateObj =
    typeof date === 'string' ? new Date(date) : date;
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

export interface CalendarsListContentProps {
  isActive?: boolean;
  initialTab?: number;
  onCalendarClick: (calendarId: string) => void;
  onEditCalendar?: (calendar: Calendar) => void;
  onDuplicateCalendar?: (calendar: Calendar) => void;
  onLinkCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar?: (calendarId: string) => void;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  onRestoreCalendar?: (calendarId: string) => Promise<void>;
  onPermanentDeleteCalendar?: (
    calendarId: string
  ) => Promise<void>;
}

interface CalendarItemProps {
  calendar: Calendar;
  onClick: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onLink?: () => void;
  onDelete?: () => void;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
}

const CalendarItem: React.FC<CalendarItemProps> = ({
  calendar,
  onClick,
  onEdit,
  onDuplicate,
  onLink,
  onDelete,
  onUpdateCalendarProperty,
}) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const pnl = calendar.total_pnl || 0;
  const isPositive = pnl >= 0;
  const winRate = calendar.win_rate || 0;
  const totalTrades = calendar.total_trades || 0;

  return (
    <Box
      sx={{
        borderRadius: 1,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.4)
            : alpha(theme.palette.background.default, 0.6),
        border: `1px solid ${alpha(
          theme.palette.divider,
          0.1
        )}`,
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.6)
              : alpha(
                  theme.palette.background.default,
                  0.9
                ),
          borderColor: alpha(
            theme.palette.primary.main,
            0.3
          ),
        },
      }}
    >
      {/* Header row */}
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          cursor: 'pointer',
        }}
      >
        <Avatar
          src={calendar.hero_image_url || undefined}
          variant="rounded"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            '& img': { objectFit: 'cover' },
          }}
        >
          <CalendarToday
            sx={{
              color: theme.palette.primary.main,
              fontSize: 18,
            }}
          />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              mb: 0.25,
            }}
          >
            {calendar.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalTrades} trades
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="flex-end"
            spacing={0.5}
          >
            {isPositive ? (
              <TrendingUp
                sx={{ fontSize: 14, color: 'success.main' }}
              />
            ) : (
              <TrendingDown
                sx={{ fontSize: 14, color: 'error.main' }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: isPositive
                  ? 'success.main'
                  : 'error.main',
              }}
            >
              {formatCurrency(pnl)}
            </Typography>
          </Stack>
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          spacing={0.25}
          sx={{ flexShrink: 0 }}
        >
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
              setMenuAnchorEl(e.currentTarget);
            }}
            sx={{ color: 'text.secondary', p: 0.5 }}
          >
            <MoreVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Menu
            anchorEl={menuAnchorEl}
            open={menuOpen}
            onClose={() => setMenuAnchorEl(null)}
            onClick={(e) => e.stopPropagation()}
            transformOrigin={{
              horizontal: 'right',
              vertical: 'top',
            }}
            anchorOrigin={{
              horizontal: 'right',
              vertical: 'bottom',
            }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchorEl(null);
                onEdit?.();
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchorEl(null);
                onDuplicate?.();
              }}
            >
              <ListItemIcon>
                <DuplicateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Duplicate</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchorEl(null);
                onLink?.();
              }}
            >
              <ListItemIcon>
                <LinkIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Link Calendar</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchorEl(null);
                onDelete?.();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon
                  fontSize="small"
                  sx={{ color: 'error.main' }}
                />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
      </Box>

      {/* Details — always visible */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Divider sx={{ mb: 1.5, opacity: 0.6 }} />
        <Stack spacing={1}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Initial Balance
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {formatCurrency(
                  calendar.account_balance || 0
                )}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Current:{' '}
                {formatCurrency(
                  (calendar.account_balance || 0) + pnl
                )}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Win Rate
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {winRate.toFixed(1)}%
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {calendar.win_count || 0}W -{' '}
                {calendar.loss_count || 0}L
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Profit Factor
              </Typography>
              <Tooltip
                title="Ratio of gross profit to gross loss"
                arrow
                placement="top"
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'help',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <InfoOutlined
                    sx={{ fontSize: '0.75rem' }}
                  />
                  {(
                    calendar.profit_factor || 0
                  ).toFixed(2)}
                </Typography>
              </Tooltip>
            </Box>
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Max Drawdown
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {(calendar.max_drawdown || 0).toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

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
  const pnl = calendar.total_pnl || 0;
  const isPositive = pnl >= 0;
  const winRate = calendar.win_rate || 0;
  const totalTrades = calendar.total_trades || 0;
  const daysLeft = getDaysUntilDeletion(
    calendar.auto_delete_at
  );

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRestoring(true);
    try {
      await onRestore(calendar.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onPermanentDelete(calendar.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 1,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.4)
            : alpha(theme.palette.background.default, 0.6),
        border: `1px solid ${alpha(
          theme.palette.divider,
          0.1
        )}`,
        opacity: 0.85,
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
        }}
      >
        <Avatar
          src={calendar.hero_image_url || undefined}
          variant="rounded"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            opacity: 0.7,
            '& img': { objectFit: 'cover' },
          }}
        >
          <CalendarToday
            sx={{
              color: theme.palette.text.secondary,
              fontSize: 18,
            }}
          />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              mb: 0.25,
            }}
          >
            {calendar.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalTrades} trades
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="flex-end"
            spacing={0.5}
          >
            {isPositive ? (
              <TrendingUp
                sx={{ fontSize: 14, color: 'success.main' }}
              />
            ) : (
              <TrendingDown
                sx={{ fontSize: 14, color: 'error.main' }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: isPositive
                  ? 'success.main'
                  : 'error.main',
              }}
            >
              {formatCurrency(pnl)}
            </Typography>
          </Stack>
        </Box>
      </Box>

      {/* Details */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Divider sx={{ mb: 1.5, opacity: 0.6 }} />
        <Stack spacing={1}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Win Rate
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {winRate.toFixed(1)}%
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {calendar.win_count || 0}W -{' '}
                {calendar.loss_count || 0}L
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.background.default,
                  0.6
                ),
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
              >
                Deleted
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: 'error.main',
                }}
              >
                {safeFormatDate(
                  calendar.deleted_at,
                  'MMM d, yyyy'
                )}
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
              >
                <ScheduleIcon
                  sx={{
                    fontSize: 12,
                    color: 'text.secondary',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  {daysLeft} days left
                </Typography>
              </Stack>
            </Box>
          </Box>

          {/* Actions */}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                isRestoring ? (
                  <CircularProgress size={14} />
                ) : (
                  <RestoreIcon sx={{ fontSize: 16 }} />
                )
              }
              onClick={handleRestore}
              disabled={isRestoring || isDeleting}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                flex: 1,
                borderColor: alpha(
                  theme.palette.primary.main,
                  0.3
                ),
              }}
            >
              Restore
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                isDeleting ? (
                  <CircularProgress size={14} />
                ) : (
                  <DeleteIcon sx={{ fontSize: 16 }} />
                )
              }
              onClick={handleDelete}
              disabled={isRestoring || isDeleting}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                flex: 1,
                color: 'error.main',
                borderColor: alpha(
                  theme.palette.error.main,
                  0.3
                ),
                '&:hover': {
                  borderColor: theme.palette.error.main,
                  bgcolor: alpha(
                    theme.palette.error.main,
                    0.08
                  ),
                },
              }}
            >
              Delete
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

const CalendarItemShimmer: React.FC<{ count?: number }> = ({
  count = 3,
}) => {
  const theme = useTheme();
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          sx={{
            borderRadius: 1,
            bgcolor:
              theme.palette.mode === 'dark'
                ? alpha(
                    theme.palette.background.paper,
                    0.4
                  )
                : alpha(
                    theme.palette.background.default,
                    0.6
                  ),
            border: `1px solid ${alpha(
              theme.palette.divider,
              0.1
            )}`,
          }}
        >
          {/* Header row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
            }}
          >
            <Shimmer
              width={40}
              height={40}
              borderRadius={8}
              variant="wave"
            />
            <Box sx={{ flex: 1 }}>
              <Shimmer
                width="60%"
                height={14}
                borderRadius={4}
                variant="wave"
                sx={{ mb: 0.75 }}
              />
              <Shimmer
                width="30%"
                height={12}
                borderRadius={4}
                variant="wave"
                intensity="low"
              />
            </Box>
            <Shimmer
              width={80}
              height={14}
              borderRadius={4}
              variant="wave"
            />
          </Box>
          {/* Details */}
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <Divider sx={{ mb: 1.5, opacity: 0.6 }} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
                mb: 1,
              }}
            >
              {[0, 1].map((j) => (
                <Box
                  key={j}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(
                      theme.palette.background.default,
                      0.6
                    ),
                  }}
                >
                  <Shimmer
                    width="50%"
                    height={10}
                    borderRadius={3}
                    variant="wave"
                    intensity="low"
                    sx={{ mb: 0.75 }}
                  />
                  <Shimmer
                    width="40%"
                    height={14}
                    borderRadius={4}
                    variant="wave"
                    sx={{ mb: 0.5 }}
                  />
                  <Shimmer
                    width="65%"
                    height={10}
                    borderRadius={3}
                    variant="wave"
                    intensity="low"
                  />
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
              }}
            >
              {[0, 1].map((j) => (
                <Box
                  key={j}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(
                      theme.palette.background.default,
                      0.6
                    ),
                  }}
                >
                  <Shimmer
                    width="55%"
                    height={10}
                    borderRadius={3}
                    variant="wave"
                    intensity="low"
                    sx={{ mb: 0.75 }}
                  />
                  <Shimmer
                    width="35%"
                    height={14}
                    borderRadius={4}
                    variant="wave"
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

const CalendarsListContent: React.FC<
  CalendarsListContentProps
> = ({
  isActive = true,
  initialTab = 0,
  onCalendarClick,
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
  }, [isActive]);

  const handleTabChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setTabIndex(newValue);
  };

  const isLoading =
    tabIndex === 0 ? loadingCalendars : loadingTrash;
  const calendarList = calendars || [];
  const trashList = trashCalendars || [];
  const items = tabIndex === 0 ? calendarList : trashList;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <RoundedTabs
          tabs={[
            {
              label: 'All Calendars',
              icon: (
                <CalendarToday sx={{ fontSize: 16 }} />
              ),
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

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 2,
          ...scrollbarStyles(theme),
        }}
      >
        {isLoading ? (
          <CalendarItemShimmer count={3} />
        ) : items.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {tabIndex === 1 ? (
              <>
                <TrashIcon
                  sx={{
                    fontSize: 40,
                    color: 'text.secondary',
                    mb: 1.5,
                  }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  Trash is empty
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 240 }}
                >
                  Deleted calendars appear here for 30 days
                </Typography>
              </>
            ) : (
              <>
                <CalendarToday
                  sx={{
                    fontSize: 40,
                    color: 'text.secondary',
                    mb: 1.5,
                  }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  No calendars yet
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 240 }}
                >
                  Create your first calendar to start
                  tracking
                </Typography>
              </>
            )}
          </Box>
        ) : (
          <TabPanel value={tabIndex} index={0}>
            <Stack spacing={1}>
              {calendarList.map((cal) => (
                <CalendarItem
                  key={cal.id}
                  calendar={cal}
                  onClick={() => onCalendarClick(cal.id)}
                  onEdit={() => onEditCalendar?.(cal)}
                  onDuplicate={() =>
                    onDuplicateCalendar?.(cal)
                  }
                  onLink={() => onLinkCalendar?.(cal)}
                  onDelete={() =>
                    onDeleteCalendar?.(cal.id)
                  }
                  onUpdateCalendarProperty={
                    onUpdateCalendarProperty
                  }
                />
              ))}
            </Stack>
          </TabPanel>
        )}

        {!isLoading && items.length > 0 && (
          <TabPanel value={tabIndex} index={1}>
            <Stack spacing={1}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: alpha(
                    theme.palette.warning.main,
                    0.08
                  ),
                  border: `1px solid ${alpha(
                    theme.palette.warning.main,
                    0.2
                  )}`,
                  mb: 1,
                }}
              >
                <ScheduleIcon
                  sx={{
                    color: 'warning.main',
                    fontSize: 18,
                  }}
                />
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="warning.main"
                  >
                    Auto-deleted after 30 days
                  </Typography>
                </Box>
              </Box>
              {trashList.map((cal) => (
                <TrashCalendarPanelItem
                  key={cal.id}
                  calendar={cal}
                  onRestore={
                    onRestoreCalendar ||
                    (async () => {})
                  }
                  onPermanentDelete={
                    onPermanentDeleteCalendar ||
                    (async () => {})
                  }
                />
              ))}
            </Stack>
          </TabPanel>
        )}
      </Box>
    </Box>
  );
};

export default CalendarsListContent;
