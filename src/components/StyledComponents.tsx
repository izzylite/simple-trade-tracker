import { styled, alpha } from '@mui/material/styles';
import { Paper, Box, Typography, Button, IconButton, Chip, DialogTitle, DialogContent, DialogActions } from '@mui/material';

export type DayStatus = 'win' | 'loss' | 'neutral' | 'breakeven';

// Calendar day styled component
export const StyledCalendarDay = styled(Box)<{
  $isCurrentMonth: boolean;
  $dayStatus: DayStatus;
}>(({ theme, $isCurrentMonth, $dayStatus }) => ({
  padding: theme.spacing(1),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.1s ease-in-out',
  opacity: $isCurrentMonth ? 1 : 0.5,
  backgroundColor: $dayStatus === 'win'
    ? alpha(theme.palette.success.main, 0.1)
    : $dayStatus === 'loss'
      ? alpha(theme.palette.error.main, 0.1)
      : theme.palette.background.paper
}));

export const CalendarCell = styled(Box)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor: alpha(theme.palette.background.paper, 0.05),
  // Removed border to prevent double border with StyledCalendarDay
}));

export const WeekdayHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.background.paper, 0.05),
  borderRadius: theme.shape.borderRadius,
}));

// Day number styled component
export const DayNumber = styled(Typography)<{ $isCurrentMonth: boolean }>(({ theme, $isCurrentMonth }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: $isCurrentMonth ? theme.palette.text.primary : theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5)
}));

// Trade amount styled component
export const TradeAmount = styled(Typography)<{ $dayStatus: 'win' | 'loss' | 'neutral' | 'breakeven' }>(({ theme, $dayStatus }) => ({
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
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  fontWeight: 500
}));

// Action button styled component
export const ActionButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.1)
    : alpha(theme.palette.common.black, 0.05),
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.2)
      : alpha(theme.palette.common.black, 0.1),
  },
  width: 32,
  height: 32,
}));

// Status chip styled component
export const StatusChip = styled(Chip)(({ theme }) => ({
  fontWeight: 600,
  borderRadius: 16,
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
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.7)
    : theme.palette.background.paper,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    boxShadow: theme.shadows[4],
  },
}));

// Stats container styled component
export const StatsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.5)
    : alpha(theme.palette.background.default, 0.7),
  border: `1px solid ${theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.1)
    : alpha(theme.palette.common.black, 0.1)}`,
}));

// Stat item styled component
export const StatItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.7)
    : theme.palette.background.paper,
  boxShadow: theme.shadows[1],
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
export const TradeListItem = styled(Box)<{ $type?: 'win' | 'loss' | 'breakeven' }>(({ theme, $type }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $type === 'win'
    ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.05)
    : $type === 'loss'
      ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.1 : 0.05)
      : $type === 'breakeven'
        ? alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.1 : 0.05)
        : theme.palette.background.paper,
  border: '1px solid',
  borderColor: $type === 'win'
    ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
    : $type === 'loss'
      ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
      : $type === 'breakeven'
        ? alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
        : theme.palette.divider,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 2px 8px ${alpha(
      $type === 'win'
        ? theme.palette.success.main
        : $type === 'loss'
          ? theme.palette.error.main
          : theme.palette.primary.main,
      0.15
    )}`,
    borderColor: $type === 'win'
      ? theme.palette.success.main
      : $type === 'loss'
        ? theme.palette.error.main
        : theme.palette.primary.main
  }
}));

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
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.8)
    : theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

// Account balance title styled component
export const AccountBalanceTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

// Account balance amount styled component
export const AccountBalanceAmount = styled(Typography)(({ theme }) => ({
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
  background: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.8)
    : theme.palette.background.paper,
  backdropFilter: 'blur(10px)',
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[4],
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
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.6)
    : theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[3],
  },
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