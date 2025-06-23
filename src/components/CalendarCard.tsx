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
import { format } from 'date-fns';
import { Calendar } from '../types/calendar';

interface CalendarStats {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  growthPercentage: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  drawdownRecoveryNeeded: number;
  drawdownDuration: number;
  drawdownStartDate: Date | null;
  drawdownEndDate: Date | null;
  weeklyProgress: number;
  monthlyProgress: number;
  yearlyProgress: number;
  weeklyPnLPercentage: number;
  monthlyPnLPercentage: number;
  yearlyPnLPercentage: number;
  winCount: number;
  lossCount: number;
  currentBalance: number;
  initialBalance: number;
}

interface CalendarCardProps {
  calendar: Calendar;
  stats: CalendarStats;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent, calendarId: string) => void;
  onCalendarClick: (calendarId: string) => void;
  onViewCharts: (e: React.MouseEvent, calendar: Calendar) => void;
  onEditCalendar: (calendar: Calendar) => void;
  onDuplicateCalendar: (calendar: Calendar) => void;
  onDeleteCalendar: (calendarId: string) => void;
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
    const growth = stats.growthPercentage;
    if (isNaN(growth)) return null;

    let color: string;
    let Icon: typeof TrendingUp | typeof TrendingDown | null = null;
    if (growth > 0) {
      color = theme.palette.success.main;
      Icon = TrendingUp;
    } else if (growth < 0) {
      color = theme.palette.error.main;
      Icon = TrendingDown;
    } else {
      color = theme.palette.text.secondary;
      Icon = null;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mt: 1,
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          bgcolor: stats.totalPnL > 0
            ? alpha(theme.palette.success.main, 0.1)
            : stats.totalPnL < 0
              ? alpha(theme.palette.error.main, 0.1)
              : alpha(theme.palette.grey[500], 0.1),
          border: `1px solid ${stats.totalPnL > 0
            ? alpha(theme.palette.success.main, 0.2)
            : stats.totalPnL < 0
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
            bgcolor: stats.totalPnL > 0
              ? alpha(theme.palette.success.main, 0.1)
              : stats.totalPnL < 0
                ? alpha(theme.palette.error.main, 0.1)
                : alpha(theme.palette.grey[500], 0.1)
          }}
        >
          <TrendingUp sx={{
            fontSize: '1.2rem',
            color: stats.totalPnL > 0
              ? theme.palette.success.main
              : stats.totalPnL < 0
                ? theme.palette.error.main
                : theme.palette.grey[500]
          }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{
            color: stats.totalPnL > 0
              ? 'success.main'
              : stats.totalPnL < 0
                ? 'error.main'
                : 'text.secondary',
            fontWeight: 600
          }}>
            {formatCurrency(stats.totalPnL)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Growth: {stats.growthPercentage.toFixed(2)}%
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
          height: 200,
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
            ...(calendar.heroImageUrl ? {
              backgroundImage: `url(${calendar.heroImageUrl})`,
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
              background: calendar.heroImageUrl
                ? `linear-gradient(135deg, ${alpha(theme.palette.common.black, 0.2)} 0%, ${alpha(theme.palette.common.black, 0.1)} 50%, ${alpha(theme.palette.common.black, 0.4)} 100%)`
                : 'transparent',
              zIndex: 1,
              transition: 'background 0.4s ease'
            }
          }}
        />

        {/* Placeholder content for calendars without hero images */}
        {!calendar.heroImageUrl && (
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
        {/* {calendar.heroImageUrl && calendar.heroImageAttribution && (
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
                href={calendar.heroImageAttribution.photographerUrl}
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
                {calendar.heroImageAttribution.photographer}
              </a>
              {' '}on{' '}
              <a
                href={calendar.heroImageAttribution.unsplashUrl}
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
              {stats.totalPnL > 0 && (
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
              {stats.totalPnL < 0 && (
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
              Created {format(calendar.createdAt, 'MMM d, yyyy')}
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
              Updated {format(calendar.lastModified, 'MMM d, yyyy')}
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
                  {formatCurrency(stats.initialBalance)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current: {formatCurrency(stats.initialBalance + stats.totalPnL)}
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
                  {stats.winRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.winCount}W - {stats.lossCount}L
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
                    {stats.profitFactor.toFixed(2)}
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Avg Win: {formatCurrency(stats.avgWin)}
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
                      {stats.maxDrawdown > 0 && (
                        <>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Recovery needed: {stats.drawdownRecoveryNeeded.toFixed(1)}%
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Duration: {stats.drawdownDuration} days
                          </Typography>
                          {stats.drawdownStartDate && stats.drawdownEndDate && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Period: {format(stats.drawdownStartDate, 'MMM d')} - {format(stats.drawdownEndDate, 'MMM d')}
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
                    {stats.maxDrawdown.toFixed(1)}%
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                  Avg Loss: {formatCurrency(stats.avgLoss)}
                </Typography>
              </Box>
            </Box>

            {/* Target Progress Section */}
            {(calendar.weeklyTarget || calendar.monthlyTarget || calendar.yearlyTarget) && (
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
                  gridTemplateColumns: calendar.weeklyTarget && calendar.monthlyTarget && calendar.yearlyTarget
                    ? 'repeat(3, 1fr)'
                    : (calendar.weeklyTarget && calendar.monthlyTarget) || (calendar.weeklyTarget && calendar.yearlyTarget) || (calendar.monthlyTarget && calendar.yearlyTarget)
                      ? 'repeat(2, 1fr)'
                      : '1fr',
                  gap: 2
                }}>
                  {calendar.weeklyTarget && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Weekly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.weeklyProgress, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {calendar.monthlyTarget && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Monthly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.monthlyProgress, 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {calendar.yearlyTarget && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Yearly
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {Math.min(stats.yearlyProgress, 100).toFixed(1)}%
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
                      color: parseFloat(String(stats.weeklyPnLPercentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.weeklyPnLPercentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.weeklyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.weeklyPnLPercentage)).toFixed(1)}%
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
                      color: parseFloat(String(stats.monthlyPnLPercentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.monthlyPnLPercentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.monthlyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.monthlyPnLPercentage)).toFixed(1)}%
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
                      color: parseFloat(String(stats.yearlyPnLPercentage)) > 0
                        ? 'success.main'
                        : parseFloat(String(stats.yearlyPnLPercentage)) < 0
                          ? 'error.main'
                          : 'text.primary'
                    }}
                  >
                    {parseFloat(String(stats.yearlyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.yearlyPnLPercentage)).toFixed(1)}%
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
