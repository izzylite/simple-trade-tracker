import { styled, alpha } from '@mui/material/styles';
import { Paper, Box, Typography, Button, IconButton, Chip, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { MONO_FONT, TNUM } from 'styles/designTokens';
import { isDarkMode } from 'utils/themeMode';

export type DayStatus = 'win' | 'loss' | 'neutral' | 'breakeven';

// Calendar day styled component
export const StyledCalendarDay = styled(Box, {
  shouldForwardProp: (prop) => !['$isCurrentMonth', '$isCurrentDay', '$dayStatus'].includes(prop as string)
})<{
  $isCurrentMonth: boolean;
  $isCurrentDay: boolean,
  $dayStatus: DayStatus;
}>(({ theme, $isCurrentMonth, $isCurrentDay, $dayStatus }) => {
  const isDark = isDarkMode(theme);
  const winBg = isDark
    ? alpha(theme.palette.success.main, 0.12)
    : alpha(theme.palette.success.main, 0.15);
  const winHoverBg = isDark
    ? alpha(theme.palette.success.main, 0.18)
    : alpha(theme.palette.success.main, 0.22);
  const lossBg = isDark
    ? alpha(theme.palette.error.main, 0.1)
    : alpha(theme.palette.error.main, 0.15);
  const lossHoverBg = isDark
    ? alpha(theme.palette.error.main, 0.16)
    : alpha(theme.palette.error.main, 0.22);
  const breakevenBg = alpha(theme.palette.text.secondary, 0.08);
  const breakevenHoverBg = alpha(theme.palette.text.secondary, 0.13);

  return {
    padding: theme.spacing(1),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    borderRadius: `${theme.palette.custom.radius.md}px`,
    transition: 'all 0.1s ease-in-out',
    opacity: $isCurrentMonth ? 1 : 0.4,
    minHeight: '100px',
    [theme.breakpoints.down('md')]: { minHeight: '84px' },
    [theme.breakpoints.down('sm')]: { minHeight: '60px', padding: theme.spacing(0.75) },
    backgroundColor:
      $dayStatus === 'win'
        ? winBg
        : $dayStatus === 'loss'
          ? lossBg
          : $dayStatus === 'breakeven'
            ? breakevenBg
            : theme.palette.background.paper,
    border: isDark ? 'none' : `1px solid ${theme.palette.divider}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
      backgroundColor:
        $dayStatus === 'win'
          ? winHoverBg
          : $dayStatus === 'loss'
            ? lossHoverBg
            : $dayStatus === 'breakeven'
              ? breakevenHoverBg
              : alpha(theme.palette.background.paper, 0.85),
    },
    ...(!$isCurrentMonth && {
      opacity: 0.4,
      '&:hover': {
        opacity: 0.6,
      },
    }),
    ...($isCurrentDay && {
      border: `3px solid ${alpha(theme.palette.primary.main, 0.4)}`,
      boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
    })
  };
});

export const CalendarCell = styled(Box)(({ theme }) => ({
  borderRadius: `${theme.palette.custom.radius.md}px`,
  overflow: 'hidden',
  backgroundColor: 'transparent',
  border: !isDarkMode(theme) ? `1px solid ${theme.palette.divider}` : 'none',
}));

export const WeekdayHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  backgroundColor: 'transparent',
  borderRadius: `${theme.palette.custom.radius.md}px`,
}));

// Day number styled component
export const DayNumber = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$isCurrentMonth'
})<{ $isCurrentMonth: boolean }>(({ theme, $isCurrentMonth }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  fontSize: '0.875rem',
  fontWeight: 500,
  color: $isCurrentMonth ? theme.palette.text.primary : theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5)
}));

// Trade amount styled component
export const TradeAmount = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$dayStatus'
})<{ $dayStatus: 'win' | 'loss' | 'neutral' | 'breakeven' }>(({ theme, $dayStatus }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  fontSize: '0.875rem',
  fontWeight: 600,
  color: $dayStatus === 'win'
    ? theme.palette.success.main
    : $dayStatus === 'loss'
      ? theme.palette.error.main
      : theme.palette.text.primary
}));

// Trade count styled component
export const TradeCount = styled(Typography)(({ theme }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}));

// Action button styled component
export const ActionButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: isDarkMode(theme)
    ? alpha(theme.palette.common.white, 0.1)
    : alpha(theme.palette.common.black, 0.05),
  '&:hover': {
    backgroundColor: isDarkMode(theme)
      ? alpha(theme.palette.common.white, 0.2)
      : alpha(theme.palette.common.black, 0.1),
  },
  width: 32,
  height: 32,
}));

// Status chip styled component
export const StatusChip = styled(Chip)(({ theme }) => ({
  fontWeight: 600,
  borderRadius: theme.palette.custom.radius.pill,
  '&.win': {
    backgroundColor: alpha(theme.palette.success.main, 0.1),
    color: theme.palette.success.main,
    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  },
  '&.loss': {
    backgroundColor: alpha(theme.palette.error.main, 0.1),
    color: theme.palette.error.main,
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
  },
}));

// Card container styled component
export const CardContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: `${theme.palette.custom.radius.lg}px`,
  boxShadow: 'none',
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  transition: `border-color 180ms ${theme.palette.custom.easing.smooth}, transform 180ms ${theme.palette.custom.easing.smooth}`,
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    transform: 'translateY(-2px)',
  },
}));

// Stats container styled component
export const StatsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: `${theme.palette.custom.radius.lg}px`,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}));

// Stat item styled component
export const StatItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: `${theme.palette.custom.radius.md}px`,
  backgroundColor: isDarkMode(theme)
    ? 'rgba(255,255,255,0.03)'
    : alpha(theme.palette.text.primary, 0.03),
  border: `1px solid ${theme.palette.divider}`,
}));

// Stat label styled component
export const StatLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.secondary,
}));

// Stat value styled component
export const StatValue = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  color: theme.palette.text.primary,
}));

// Primary button styled component
export const PrimaryButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1, 2),
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
}));

// Secondary button styled component
export const SecondaryButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1, 2),
  fontWeight: 600,
  textTransform: 'none',
  borderWidth: 2,
  '&:hover': {
    borderWidth: 2,
  },
}));

// Dialog title styled component
export const DialogTitleStyled = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`
}));

// Dialog content styled component
export const DialogContentStyled = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2)
}));

// Dialog actions styled component
export const DialogActionsStyled = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`
}));

// Form field styled component
export const FormField = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2)
}));

// Trade list item styled component
//
// Two-layer shadow gives the row real thickness. Resting shadow uses a
// hairline base (1px) + a wider ambient drop so the card looks lifted off
// the surface without floating. Hover steps one tier up per the DESIGN.md
// Hover Lift Rule (-2px max, single shadow step up).
export const TradeListItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$type'
})<{ $type?: 'win' | 'loss' | 'breakeven' }>(({ theme, $type }) => {
  const isDark = isDarkMode(theme);

  const restingShadow = isDark
    ? '0 1px 2px rgba(0,0,0,0.45), 0 6px 14px rgba(0,0,0,0.32), 0 2px 4px rgba(0,0,0,0.20)'
    : '0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)';

  const hoverShadow = isDark
    ? '0 2px 4px rgba(0,0,0,0.55), 0 12px 28px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.28)'
    : '0 2px 4px rgba(15,23,42,0.08), 0 10px 24px rgba(15,23,42,0.14), 0 4px 8px rgba(15,23,42,0.06)';

  const winBg = isDark
    ? alpha(theme.palette.success.main, 0.1)
    : alpha(theme.palette.success.main, 0.08);
  const lossBg = isDark
    ? alpha(theme.palette.error.main, 0.1)
    : alpha(theme.palette.error.main, 0.08);
  const breakevenBg = isDark
    ? alpha(theme.palette.text.secondary, 0.1)
    : alpha(theme.palette.text.secondary, 0.08);

  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    borderRadius: theme.palette.custom.radius.lg,
    backgroundColor: $type === 'win'
      ? winBg
      : $type === 'loss'
        ? lossBg
        : $type === 'breakeven'
          ? breakevenBg
          : theme.palette.background.paper,
    border: '1px solid',
    borderColor: $type === 'win'
      ? alpha(theme.palette.success.main, 0.22)
      : $type === 'loss'
        ? alpha(theme.palette.error.main, 0.22)
        : $type === 'breakeven'
          ? alpha(theme.palette.text.secondary, 0.22)
          : theme.palette.divider,
    boxShadow: restingShadow,
    transition: 'box-shadow 180ms ease-out, transform 180ms ease-out, border-color 180ms ease-out',
    '&:hover': {
      boxShadow: hoverShadow,
    },
  };
});

// Trade info styled component
export const TradeInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  alignItems: 'center',
  gap: theme.spacing(2)
}));

// Trade actions styled component
export const TradeActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1)
}));

// Calendar header styled component
export const CalendarHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

// Calendar grid styled component
export const CalendarGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
}));

// Calendar weekday header styled component
export const CalendarWeekdayHeader = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

// Calendar weekday styled component
export const CalendarWeekday = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  fontWeight: 500,
  color: theme.palette.text.secondary,
}));

// Account balance card styled component
export const AccountBalanceCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: `${theme.palette.custom.radius.lg}px`,
  boxShadow: 'none',
  border: `1px solid ${theme.palette.divider}`,
  transition: `border-color 180ms ${theme.palette.custom.easing.smooth}, transform 180ms ${theme.palette.custom.easing.smooth}`,
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    transform: 'translateY(-2px)',
  },
}));

// Account balance title styled component
export const AccountBalanceTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

// Account balance amount styled component
export const AccountBalanceAmount = styled(Typography)(({ theme }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  letterSpacing: '-0.015em',
  fontSize: '2rem',
  fontWeight: 700,
  color: theme.palette.text.primary,
  textAlign: 'center',
  marginBottom: theme.spacing(0.5),
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.5rem',
  },
}));

// Account balance change styled component
export const AccountBalanceChange = styled(Typography)(({ theme }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  fontSize: '1rem',
  fontWeight: 500,
  textAlign: 'center',
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.875rem',
  },
}));

// Monthly stats card styled component
export const MonthlyStatsCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: `${theme.palette.custom.radius.lg}px`,
  boxShadow: 'none',
  border: `1px solid ${theme.palette.divider}`,
}));

// Monthly stats title styled component
export const MonthlyStatsTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2),
}));

// Monthly stats grid styled component
export const MonthlyStatsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: theme.spacing(2),
}));

// Monthly stat item styled component
export const MonthlyStatItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  backgroundColor: isDarkMode(theme)
    ? 'rgba(255,255,255,0.03)'
    : alpha(theme.palette.text.primary, 0.03),
  borderRadius: `${theme.palette.custom.radius.md}px`,
  boxShadow: 'none',
  border: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

// Monthly stat label styled component
export const MonthlyStatLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
  textAlign: 'center',
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.75rem',
  },
}));

// Monthly stat value styled component
export const MonthlyStatValue = styled(Typography)(({ theme }) => ({
  fontFamily: MONO_FONT,
  fontFeatureSettings: TNUM,
  letterSpacing: '-0.01em',
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  textAlign: 'center',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
  },
}));

// Journal link styled component
export const JournalLink = styled('a')(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  fontSize: '0.875rem',
  '&:hover': {
    textDecoration: 'underline'
  }
}));

// Animated pulse styled component
export const AnimatedPulse = styled(Box)(({ theme }) => ({
  animation: `pulse 2s ${theme.transitions.easing.easeInOut} infinite`
}));
