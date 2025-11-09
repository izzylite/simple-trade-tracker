import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Divider,
  Tooltip,
  Theme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  BarChart as ChartIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Delete as TrashIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  InfoOutlined,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Calendar, CalendarWithUIState } from '../types/calendar';
import { CalendarStats } from '../services/calendarService';
import ShareButton from './sharing/ShareButton';

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
  calendar: CalendarWithUIState;
  stats: CalendarStats;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent, calendarId: string) => void;
  onCalendarClick: (calendarId: string) => void;
  onViewCharts: (e: React.MouseEvent, calendar: CalendarWithUIState) => void;
  onEditCalendar: (calendar: CalendarWithUIState) => void;
  onDuplicateCalendar: (calendar: CalendarWithUIState) => void;
  onDeleteCalendar: (calendarId: string) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: CalendarWithUIState) => Calendar) => Promise<Calendar | undefined>;
  formatCurrency: (amount: number) => string;
}

const CalendarCard: React.FC<CalendarCardProps> = ({
  calendar,
  stats,
  isExpanded = false,
  onToggleExpand,
  onCalendarClick,
  onViewCharts,
  onEditCalendar,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendarProperty,
  formatCurrency
}) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null);

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleMenuItemClick = (action: () => void) => {
    handleMenuClose();
    action();
  };

  function renderAccountGrowth(
    stats: CalendarStats,
    theme: Theme,
    formatCurrency: (amount: number) => string
  ): React.ReactNode {
    const growth = stats.growth_percentage;
    if (isNaN(growth)) return null;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mt: 1,
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          bgcolor: stats.total_pnl > 0
            ? alpha(theme.palette.success.main, 0.1)
            : stats.total_pnl < 0
              ? alpha(theme.palette.error.main, 0.1)
              : alpha(theme.palette.grey[500], 0.1),
          border: `1px solid ${stats.total_pnl > 0
            ? alpha(theme.palette.success.main, 0.2)
            : stats.total_pnl < 0
              ? alpha(theme.palette.error.main, 0.2)
              : alpha(theme.palette.grey[500], 0.2)}`,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: stats.total_pnl > 0
              ? alpha(theme.palette.success.main, 0.1)
              : stats.total_pnl < 0
                ? alpha(theme.palette.error.main, 0.1)
                : alpha(theme.palette.grey[500], 0.1)
          }}
        >
          <TrendingUp sx={{
            fontSize: '1.2rem',
            color: stats.total_pnl > 0
              ? theme.palette.success.main
              : stats.total_pnl < 0
                ? theme.palette.error.main
                : theme.palette.grey[500]
          }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{
            color: stats.total_pnl > 0
              ? 'success.main'
              : stats.total_pnl < 0
                ? 'error.main'
                : 'text.secondary',
            fontWeight: 600
          }}>
            {formatCurrency(stats.total_pnl)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Growth: {stats.growth_percentage.toFixed(2)}%
          </Typography>
        </Box>
      </Box>
    );
  }
  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 'auto',
        borderRadius: 1,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.1),
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
          : `linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)`,
        backdropFilter: 'blur(10px)',
        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.3 : 0.08)}`,
        '&:hover': {
          transform: 'translateY(-8px) scale(1.02)',
          boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.4 : 0.15)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
          '& .hero-image': {
            transform: 'scale(1.05)'
          }
        }
      }}
      onClick={() => onCalendarClick(calendar.id)}
    >
      {/* Hero Image Section - Always rendered for consistent layout */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          height: { xs: 160, sm: 200 },
          flexShrink: 0
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
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
              color: alpha(theme.palette.text.secondary, 0.6)
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

        {/* Attribution overlay - only show for actual images */}
        {/* {calendar.hero_image_url && calendar.hero_image_attribution && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              background: `linear-gradient(135deg, ${alpha(theme.palette.common.black, 0.8)} 0%, ${alpha(theme.palette.common.black, 0.6)} 100%)`,
              backdropFilter: 'blur(8px)',
              color: 'white',
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              zIndex: 2,
              border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              transition: 'opacity 0.3s ease'
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', fontWeight: 500 }}>
              📸{' '}
              <a
                href={calendar.hero_image_attribution.photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.3)',
                  transition: 'border-color 0.2s ease'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {calendar.hero_image_attribution.photographer}
              </a>
              {' '}on{' '}
              <a
                href={calendar.hero_image_attribution.unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.3)',
                  transition: 'border-color 0.2s ease'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Unsplash
              </a>
            </Typography>
          </Box>
        )} */}
      </Box>

      {/* Content Section */}
      <CardContent sx={{
        p: 3,
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
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 0.5,
                fontSize: '1.4rem',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              {calendar.name}
              {stats.total_pnl > 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                }}>
                  <TrendingUp sx={{ fontSize: '1rem', color: 'success.main' }} />
                </Box>
              )}
              {stats.total_pnl < 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
                }}>
                  <TrendingDown sx={{ fontSize: '1rem', color: 'error.main' }} />
                </Box>
              )}
            </Typography>
            {/* Account Growth */}
            {!isExpanded && renderAccountGrowth(stats, theme, formatCurrency)}
          </Box>
        </Box>




        {/* Metadata section */}
        <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.primary.main, 0.1)
            }}>
              <CalendarIcon sx={{ fontSize: '0.8rem', color: 'primary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
              Created {safeFormatDate(calendar.created_at, 'MMM d, yyyy')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.secondary.main, 0.1)
            }}>
              <EditIcon sx={{ fontSize: '0.8rem', color: 'secondary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
              Updated {safeFormatDate(calendar.updated_at, 'MMM d, yyyy')}
            </Typography>
          </Box>
        </Stack>

        {/* Divider - only show when expanded */}
        {isExpanded && <Divider sx={{ my: 1, opacity: 0.6 }} />}

        {/* Detailed stats section */}
        {isExpanded && (
          <Stack spacing={2} sx={{
            flexGrow: 0,
            mb: 2
          }}>
            {renderAccountGrowth(stats, theme, formatCurrency)}

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 2
            }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Initial Balance
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatCurrency(stats.initial_balance)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current: {formatCurrency(stats.initial_balance + stats.total_pnl)}
                </Typography>
              </Box>

              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Win Rate
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {stats.win_rate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.win_count}W - {stats.loss_count}L
                </Typography>
              </Box>
            </Box>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 2
            }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Profit Factor
                </Typography>
                <Tooltip
                  title={
                    <Box sx={{ p: 1, maxWidth: 300 }}>
                      <Typography variant="body2" gutterBottom>
                        Profit Factor is the ratio of gross profit to gross loss. A value greater than 1 indicates profitable trading.
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        • Value &gt; 3: Excellent
                      </Typography>
                      <Typography variant="body2">
                        • Value 2-3: Very Good
                      </Typography>
                      <Typography variant="body2">
                        • Value 1.5-2: Good
                      </Typography>
                      <Typography variant="body2">
                        • Value 1-1.5: Marginal
                      </Typography>
                      <Typography variant="body2">
                        • Value &lt; 1: Unprofitable
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                    <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                    {stats.profit_factor.toFixed(2)}
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Avg Win: {formatCurrency(stats.avg_win)}
                </Typography>
              </Box>

              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Max Drawdown
                </Typography>
                <Tooltip
                  title={
                    <Box sx={{ p: 1, maxWidth: 300 }}>
                      <Typography variant="body2" gutterBottom>
                        Maximum drawdown represents the largest peak-to-trough decline in your account balance.
                      </Typography>
                      {stats.max_drawdown > 0 && (
                        <>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Recovery needed: {stats.drawdown_recovery_needed.toFixed(1)}%
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Duration: {stats.drawdown_duration} days
                          </Typography>
                          {stats.drawdown_start_date && stats.drawdown_end_date && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Period: {safeFormatDate(stats.drawdown_start_date, 'MMM d')} - {safeFormatDate(stats.drawdown_end_date, 'MMM d')}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                    <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                    {stats.max_drawdown.toFixed(1)}%
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                  Avg Loss: {formatCurrency(stats.avg_loss)}
                </Typography>
              </Box>
            </Box>

            {/* Target Progress Section */}
            {(calendar.weekly_target || calendar.monthly_target || calendar.yearly_target) && (
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.6)
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Target Progress
                </Typography>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: calendar.weekly_target && calendar.monthly_target && calendar.yearly_target
                    ? 'repeat(3, 1fr)'
                    : (calendar.weekly_target && calendar.monthly_target) || (calendar.weekly_target && calendar.yearly_target) || (calendar.monthly_target && calendar.yearly_target)
                      ? 'repeat(2, 1fr)'
                      : '1fr',
                  gap: 2
                }}>
                  {calendar.weekly_target && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Weekly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.weekly_progress ?? 0, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {calendar.monthly_target && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Monthly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.monthly_progress ?? 0, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {calendar.yearly_target && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Yearly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.yearly_progress ?? 0, 100).toFixed(1)}%
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
              <Typography variant="body2" color="text.secondary" gutterBottom>
                PnL Performance
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2
              }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Weekly
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(stats.weekly_pnl_percentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.weekly_pnl_percentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.weekly_pnl_percentage)) > 0 ? '+' : ''}{parseFloat(String(stats.weekly_pnl_percentage)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Monthly
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(stats.monthly_pnl_percentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.monthly_pnl_percentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.monthly_pnl_percentage)) > 0 ? '+' : ''}{parseFloat(String(stats.monthly_pnl_percentage)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Yearly
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: parseFloat(String(stats.yearly_pnl_percentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.yearly_pnl_percentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.yearly_pnl_percentage)) > 0 ? '+' : ''}{parseFloat(String(stats.yearly_pnl_percentage)).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Stack>
        )}
      </CardContent>

      {/* Card Actions */}
      <CardActions sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
      }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ChartIcon />}
          onClick={(e) => onViewCharts(e, calendar)}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          View Charts
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>


          {onToggleExpand && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(e, calendar.id);
              }}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main'
                }
              }}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}

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
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
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
      </CardActions>
    </Card>
  );
};

export default CalendarCard;
