import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Theme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Delete as TrashIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Calendar } from '../types/calendar';
import { CalendarStats } from '../services/calendarService';
import ShareButton from './sharing/ShareButton';
import { EYEBROW_SX, TNUM, getCardShellSx, getInsetTileSx } from 'styles/designTokens';
import PnlValue from 'components/common/PnlValue';

/**
 * Safely format a date value, returning a fallback string for invalid dates
 */
const safeFormatDate = (date: Date | undefined | null, formatStr: string, fallback: string = 'N/A'): string => {
  if (!date || !isValid(date)) return fallback;
  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
};

interface CalendarCardProps {
  calendar: Calendar;
  onCalendarClick: (calendarId: string) => void;
  onEditCalendar: (calendar: Calendar) => void;
  onDuplicateCalendar: (calendar: Calendar) => void;
  onLinkCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar: (calendarId: string) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  formatCurrency: (amount: number) => string;
}

const CalendarCard: React.FC<CalendarCardProps> = ({
  calendar,
  onCalendarClick,
  onEditCalendar,
  onDuplicateCalendar,
  onLinkCalendar,
  onDeleteCalendar,
  onUpdateCalendarProperty,
  formatCurrency
}) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null);

  const handleMenuClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  const handleMenuItemClick = useCallback((action: () => void) => {
    handleMenuClose();
    action();
  }, [handleMenuClose]);


  const stats: CalendarStats = useMemo(() => {
    return {  // Extract stats from calendar object (stats are auto-calculated by Supabase)
      total_pnl: calendar.total_pnl || 0,
      win_rate: calendar.win_rate || 0,
      total_trades: calendar.total_trades || 0,
      growth_percentage: calendar.pnl_performance || 0,
      avg_win: calendar.avg_win || 0,
      avg_loss: calendar.avg_loss || 0,
      profit_factor: calendar.profit_factor || 0,
      max_drawdown: calendar.max_drawdown || 0,
      drawdown_recovery_needed: calendar.drawdown_recovery_needed || 0,
      drawdown_duration: calendar.drawdown_duration || 0,
      drawdown_start_date: calendar.drawdown_start_date || null,
      drawdown_end_date: calendar.drawdown_end_date || null,
      target_progress: calendar.target_progress || 0,
      pnl_performance: calendar.pnl_performance || 0,
      win_count: calendar.win_count || 0,
      loss_count: calendar.loss_count || 0,
      current_balance: calendar.current_balance || calendar.account_balance,
      initial_balance: calendar.account_balance,
      weekly_pnl: calendar.weekly_pnl,
      monthly_pnl: calendar.monthly_pnl,
      yearly_pnl: calendar.yearly_pnl,
      weekly_pnl_percentage: calendar.weekly_pnl_percentage,
      monthly_pnl_percentage: calendar.monthly_pnl_percentage,
      yearly_pnl_percentage: calendar.yearly_pnl_percentage,
      weekly_progress: calendar.weekly_progress,
      monthly_progress: calendar.monthly_progress
    };
  }, [calendar])

  function renderAccountGrowth(
    stats: CalendarStats,
    theme: Theme,
    formatCurrency: (amount: number) => string
  ): React.ReactNode {
    const growth = stats.growth_percentage;
    if (isNaN(growth)) return null;

    const isWin = stats.total_pnl > 0;
    const isLoss = stats.total_pnl < 0;
    const accent = isWin
      ? theme.palette.success.main
      : isLoss
        ? theme.palette.error.main
        : theme.palette.text.secondary;

    return (
      <Box
        sx={{
          ...getInsetTileSx(theme),
          display: 'flex',
          alignItems: 'center',
          mt: 1,
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: `${theme.palette.custom.radius.md}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(accent, 0.12),
            color: accent,
            flexShrink: 0,
          }}
        >
          <TrendingUp sx={{ fontSize: '1.1rem' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <PnlValue
            amount={stats.total_pnl}
            format={formatCurrency}
            size="lg"
            arrow={false}
          />
          <Typography
            sx={{
              ...EYEBROW_SX,
              mt: 0.25,
              color: 'text.tertiary',
              fontFeatureSettings: TNUM,
            }}
          >
            Growth · {stats.growth_percentage.toFixed(2)}%
          </Typography>
        </Box>
      </Box>
    );
  }
  return (
    <Box
      onClick={() => onCalendarClick(calendar.id)}
      sx={{
        ...getCardShellSx(theme, 'lg'),
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: 'auto',
        transition: `border-color 180ms ${theme.palette.custom.easing.smooth}, transform 180ms ${theme.palette.custom.easing.smooth}`,
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.4),
          transform: 'translateY(-2px)',
          '& .hero-image': {
            transform: 'scale(1.05)'
          }
        }
      }}
    >
      {/* Hero Image Section - Always rendered for consistent layout */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          height: { xs: 160, sm: 200 },
          flexShrink: 0,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          className="hero-image"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...(calendar.hero_image_url ? {
              backgroundImage: `url(${calendar.hero_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            } : {
              // Gradient placeholder for calendars without hero images
              background: `linear-gradient(135deg,
                ${alpha(theme.palette.primary.main, 0.1)} 0%,
                ${alpha(theme.palette.secondary.main, 0.1)} 50%,
                ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            }),
            transition: `transform 400ms ${theme.palette.custom.easing.smooth}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: calendar.hero_image_url
                ? `linear-gradient(135deg, ${alpha(theme.palette.common.black, 0.2)} 0%, ${alpha(theme.palette.common.black, 0.1)} 50%, ${alpha(theme.palette.common.black, 0.4)} 100%)`
                : 'transparent',
              zIndex: 1,
              transition: 'background 0.4s ease'
            }
          }}
        />

        {/* Placeholder content for calendars without hero images */}
        {!calendar.hero_image_url && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              textAlign: 'center',
              color: 'text.tertiary'
            }}
          >
            <CalendarIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                opacity: 0.7,
                fontSize: '0.9rem'
              }}
            >
              {calendar.name}
            </Typography>
          </Box>
        )}

      </Box>

      {/* Content Section */}
      <Box sx={{
        p: 2.25,
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        position: 'relative',
        zIndex: 1
      }}>
        {/* Title section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="h5"
              component="div"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 0.5,
                fontSize: '1.25rem',
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
                minWidth: 0
              }}
            >
              <Box
                component="span"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1
                }}
              >
                {calendar.name}
              </Box>
              {stats.total_pnl > 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: `${theme.palette.custom.radius.md}px`,
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  color: 'success.main',
                  flexShrink: 0,
                }}>
                  <TrendingUp sx={{ fontSize: '1rem' }} />
                </Box>
              )}
              {stats.total_pnl < 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: `${theme.palette.custom.radius.md}px`,
                  bgcolor: alpha(theme.palette.error.main, 0.12),
                  color: 'error.main',
                  flexShrink: 0,
                }}>
                  <TrendingDown sx={{ fontSize: '1rem' }} />
                </Box>
              )}
            </Typography>
            {/* Account Growth */}
            {renderAccountGrowth(stats, theme, formatCurrency)}
          </Box>
        </Box>




        {/* Metadata section */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: `${theme.palette.custom.radius.sm}px`,
              bgcolor: theme.palette.custom.tintViolet.soft,
              color: 'primary.main',
            }}>
              <CalendarIcon sx={{ fontSize: '0.8rem' }} />
            </Box>
            <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary', fontFeatureSettings: TNUM }}>
              Created {safeFormatDate(calendar.created_at, 'MMM d, yyyy')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: `${theme.palette.custom.radius.sm}px`,
              bgcolor: alpha(theme.palette.secondary.main, 0.12),
              color: 'secondary.main',
            }}>
              <EditIcon sx={{ fontSize: '0.8rem' }} />
            </Box>
            <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary', fontFeatureSettings: TNUM }}>
              Updated {safeFormatDate(calendar.updated_at, 'MMM d, yyyy')}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Card Actions */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        px: 2.25,
        py: 1.25,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Share Calendar Button */}
          {onUpdateCalendarProperty && (
            <ShareButton
              type="calendar"
              item={calendar}
              onUpdateItemProperty={onUpdateCalendarProperty}
            />
          )}

          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{
              color: 'text.secondary',
              borderRadius: `${theme.palette.custom.radius.sm}px`,
              '&:hover': {
                bgcolor: theme.palette.custom.tintViolet.soft,
                color: 'primary.main'
              }
            }}
          >
            <MoreVertIcon />
          </IconButton>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            onClick={(e) => e.stopPropagation()}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => handleMenuItemClick(() => onEditCalendar(calendar))}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => handleMenuItemClick(() => onDuplicateCalendar(calendar))}>
              <ListItemIcon>
                <CopyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Duplicate</ListItemText>
            </MenuItem>

            {onLinkCalendar && (
              <MenuItem onClick={() => handleMenuItemClick(() => onLinkCalendar(calendar))}>
                <ListItemIcon>
                  <LinkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Link</ListItemText>
              </MenuItem>
            )}

            <MenuItem
              onClick={() => handleMenuItemClick(() => onDeleteCalendar(calendar.id))}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <TrashIcon fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(CalendarCard);
