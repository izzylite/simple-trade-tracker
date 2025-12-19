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
  CircularProgress
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
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Calendar } from '../../types/calendar';
import { formatCurrency } from '../../utils/formatters';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import ShareButton from '../sharing/ShareButton';
import TrashCalendarItem from '../trash/TrashCalendarItem';
import { useCalendars, useTrashCalendars } from '../../hooks/useCalendars';
import { useAuth } from '../../contexts/SupabaseAuthContext';

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
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
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
  const { user } = useAuth();

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
              ...scrollbarStyles(theme)
            }}
          >
            {calendars.map((calendar) => (
              <CompactCalendarItem
                key={calendar.id}
                calendar={calendar}
                isTrash={isTrash}
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
