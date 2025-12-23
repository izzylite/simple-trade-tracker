import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  Stack,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  DeleteOutline as TrashIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  ExpandMore,
  ExpandLess,
  InfoOutlined
} from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Calendar } from '../../types/calendar';
import { formatCurrency } from '../../utils/formatters';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import ShareButton from '../sharing/ShareButton';
import TrashCalendarItem from '../trash/TrashCalendarItem';
import { useCalendars, useTrashCalendars } from '../../hooks/useCalendars';
import { useAuthState } from '../../contexts/AuthStateContext';

interface CalendarListDialogProps {
  open: boolean;
  onClose: () => void;
  isTrash?: boolean;
  onCalendarClick: (calendarId: string) => void;
  onEditCalendar?: (calendar: Calendar) => void;
  onDuplicateCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar?: (calendarId: string) => void;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  onRestoreCalendar?: (calendarId: string) => Promise<void>;
  onPermanentDeleteCalendar?: (calendarId: string) => Promise<void>;
}

interface CompactCalendarItemProps {
  calendar: Calendar;
  isTrash?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
}

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

const CompactCalendarItem: React.FC<CompactCalendarItemProps> = ({
  calendar,
  isTrash,
  isExpanded = false,
  onToggleExpand,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
  onUpdateCalendarProperty
}) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);

  const pnl = calendar.total_pnl || 0;
  const isPositive = pnl >= 0;
  const winRate = calendar.win_rate || 0;
  const totalTrades = calendar.total_trades || 0;

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onEdit?.();
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onDuplicate?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onDelete?.();
  };

  return (
    <Box
      sx={{
        borderRadius: 1,
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.4)
          : alpha(theme.palette.background.default, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.2s',
        opacity: isTrash ? 0.8 : 1,
        '&:hover': {
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.6)
            : alpha(theme.palette.background.default, 0.9),
          borderColor: alpha(theme.palette.primary.main, 0.3)
        }
      }}
    >
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          cursor: 'pointer'
        }}
      >
        {/* Hero Image or Placeholder */}
        <Avatar
          src={calendar.hero_image_url || undefined}
          variant="rounded"
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            '& img': {
              objectFit: 'cover'
            }
          }}
        >
          <CalendarToday sx={{ color: theme.palette.primary.main }} />
        </Avatar>

        {/* Calendar Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 0.25
            }}
          >
            {calendar.name}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {totalTrades} trades
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {winRate.toFixed(1)}% win
            </Typography>
            {isTrash && calendar.deleted_at && (
              <Typography variant="caption" color="error.main">
                Deleted {safeFormatDate(calendar.deleted_at, 'MMM d')}
              </Typography>
            )}
          </Stack>
        </Box>

        {/* P&L */}
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
            {isPositive ? (
              <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: isPositive ? 'success.main' : 'error.main'
              }}
            >
              {formatCurrency(pnl)}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {safeFormatDate(calendar.updated_at, 'MMM d, yyyy')}
          </Typography>
        </Box>

        {/* Actions */}
        {!isTrash && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
            {onToggleExpand && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                sx={{ color: 'text.secondary' }}
              >
                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            )}
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
              onClick={handleMenuClick}
              sx={{ color: 'text.secondary' }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchorEl}
              open={menuOpen}
              onClose={() => handleMenuClose()}
              onClick={(e) => e.stopPropagation()}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleEdit}>
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleDuplicate}>
                <ListItemIcon>
                  <DuplicateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Duplicate</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </Menu>
          </Stack>
        )}
      </Box>

      {/* Expanded Content */}
      {isExpanded && !isTrash && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Divider sx={{ mb: 1.5, opacity: 0.6 }} />
          <Stack spacing={1.5}>
            {/* Initial Balance and Win Rate */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5
            }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Initial Balance
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(calendar.account_balance || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current: {formatCurrency((calendar.account_balance || 0) + pnl)}
                </Typography>
              </Box>

              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Win Rate
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {winRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {calendar.win_count || 0}W - {calendar.loss_count || 0}L
                </Typography>
              </Box>
            </Box>

            {/* Profit Factor and Max Drawdown */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5
            }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Profit Factor
                </Typography>
                <Tooltip
                  title={
                    <Box sx={{ p: 1, maxWidth: 300 }}>
                      <Typography variant="caption" gutterBottom>
                        Profit Factor is the ratio of gross profit to gross loss. A value greater than 1 indicates profitable trading.
                      </Typography>
                      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                        • Value &gt; 3: Excellent
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        • Value 2-3: Very Good
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        • Value 1.5-2: Good
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        • Value 1-1.5: Marginal
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        • Value &lt; 1: Unprofitable
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'help', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoOutlined sx={{ fontSize: '0.875rem' }} />
                    {(calendar.profit_factor || 0).toFixed(2)}
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Avg Win: {formatCurrency(calendar.avg_win || 0)}
                </Typography>
              </Box>

              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Max Drawdown
                </Typography>
                <Tooltip
                  title={
                    <Box sx={{ p: 1, maxWidth: 300 }}>
                      <Typography variant="caption" gutterBottom>
                        Maximum drawdown represents the largest peak-to-trough decline in your account balance.
                      </Typography>
                      {(calendar.max_drawdown || 0) > 0 && (
                        <>
                          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                            Recovery needed: {(calendar.drawdown_recovery_needed || 0).toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                            Duration: {calendar.drawdown_duration || 0} days
                          </Typography>
                          {calendar.drawdown_start_date && calendar.drawdown_end_date && (
                            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                              Period: {safeFormatDate(calendar.drawdown_start_date, 'MMM d')} - {safeFormatDate(calendar.drawdown_end_date, 'MMM d')}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'help', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoOutlined sx={{ fontSize: '0.875rem' }} />
                    {(calendar.max_drawdown || 0).toFixed(1)}%
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Avg Loss: {formatCurrency(calendar.avg_loss || 0)}
                </Typography>
              </Box>
            </Box>

            {/* Target Progress Section */}
            {(calendar.weekly_target || calendar.monthly_target) && (
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Target Progress
                </Typography>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: calendar.weekly_target && calendar.monthly_target
                    ? 'repeat(2, 1fr)'
                    : '1fr',
                  gap: 1.5
                }}>
                  {calendar.weekly_target && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Weekly
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {Math.min(calendar.weekly_progress ?? 0, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {calendar.monthly_target && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Monthly
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {Math.min(calendar.monthly_progress ?? 0, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* PnL Performance Section */}
            <Box sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.default, 0.6)
            }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                PnL Performance
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.5
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Weekly
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(calendar.weekly_pnl_percentage || 0)) > 0
                        ? 'success.main'
                        : parseFloat(String(calendar.weekly_pnl_percentage || 0)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(calendar.weekly_pnl_percentage || 0)) > 0 ? '+' : ''}{parseFloat(String(calendar.weekly_pnl_percentage || 0)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Monthly
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(calendar.monthly_pnl_percentage || 0)) > 0
                        ? 'success.main'
                        : parseFloat(String(calendar.monthly_pnl_percentage || 0)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(calendar.monthly_pnl_percentage || 0)) > 0 ? '+' : ''}{parseFloat(String(calendar.monthly_pnl_percentage || 0)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Yearly
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(calendar.yearly_pnl_percentage || 0)) > 0
                        ? 'success.main'
                        : parseFloat(String(calendar.yearly_pnl_percentage || 0)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(calendar.yearly_pnl_percentage || 0)) > 0 ? '+' : ''}{parseFloat(String(calendar.yearly_pnl_percentage || 0)).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
};

const CalendarListDialog: React.FC<CalendarListDialogProps> = ({
  open,
  onClose,
  isTrash = false,
  onCalendarClick,
  onEditCalendar,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendarProperty,
  onRestoreCalendar,
  onPermanentDeleteCalendar
}) => {
  const theme = useTheme();
  const { user } = useAuthState();
  const [expandedCalendarIds, setExpandedCalendarIds] = useState<Set<string>>(new Set());

  // Fetch fresh data when dialog opens
  const {
    calendars: fetchedCalendars,
    isLoading: loadingCalendars,
    refresh: refreshCalendars
  } = useCalendars(open && !isTrash ? user?.uid : undefined);

  const {
    trashCalendars: fetchedTrashCalendars,
    isLoading: loadingTrash,
    refresh: refreshTrash
  } = useTrashCalendars(open && isTrash ? user?.uid : undefined);

  // Refresh data when dialog opens
  useEffect(() => {
    if (open) {
      if (isTrash) {
        refreshTrash();
      } else {
        refreshCalendars();
      }
    }
  }, [open, isTrash, refreshCalendars, refreshTrash]);

  // Get the appropriate data and loading state
  const calendars = isTrash ? fetchedTrashCalendars : (fetchedCalendars || []);
  const isLoading = isTrash ? loadingTrash : loadingCalendars;
  const title = isTrash ? 'Trash' : 'All Calendars';

  const handleCalendarClick = (calendarId: string) => {
    onCalendarClick(calendarId);
    onClose();
  };

  const handleToggleExpand = (calendarId: string) => {
    setExpandedCalendarIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(calendarId)) {
        newSet.delete(calendarId);
      } else {
        newSet.add(calendarId);
      }
      return newSet;
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {isTrash ? (
            <TrashIcon sx={{ color: 'text.secondary' }} />
          ) : (
            <CalendarToday sx={{ color: 'primary.main' }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({calendars.length})
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, overflowX: 'hidden' }}>
        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 6
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : calendars.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {isTrash ? (
              <>
                <TrashIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Trash is empty
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                  Deleted calendars will appear here for 30 days before being permanently removed
                </Typography>
              </>
            ) : (
              <>
                <CalendarToday sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  No calendars yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                  Create your first trading calendar to start tracking your trades
                </Typography>
              </>
            )}
          </Box>
        ) : isTrash ? (
          <Stack
            spacing={1.5}
            sx={{
              maxHeight: '60vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              ...scrollbarStyles(theme)
            }}
          >
            {/* Trash Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
              }}
            >
              <ScheduleIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={600} color="warning.main">
                  Items will be permanently deleted after 30 days
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Restore calendars before they're automatically removed
                </Typography>
              </Box>
            </Box>

            {/* Trash Items */}
            {calendars.map((calendar) => (
              <TrashCalendarItem
                key={calendar.id}
                calendar={calendar}
                onRestore={onRestoreCalendar || (async () => {})}
                onPermanentDelete={onPermanentDeleteCalendar || (async () => {})}
              />
            ))}
          </Stack>
        ) : (
          <Stack
            spacing={1}
            sx={{
              maxHeight: '60vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              p:1,
              ...scrollbarStyles(theme)
            }}
          >
            {calendars.map((calendar) => (
              <CompactCalendarItem
                key={calendar.id}
                calendar={calendar}
                isTrash={isTrash}
                isExpanded={expandedCalendarIds.has(calendar.id)}
                onToggleExpand={() => handleToggleExpand(calendar.id)}
                onClick={() => handleCalendarClick(calendar.id)}
                onEdit={() => onEditCalendar?.(calendar)}
                onDuplicate={() => onDuplicateCalendar?.(calendar)}
                onDelete={() => onDeleteCalendar?.(calendar.id)}
                onUpdateCalendarProperty={onUpdateCalendarProperty}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CalendarListDialog;
