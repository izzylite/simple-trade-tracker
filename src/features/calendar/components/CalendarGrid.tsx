import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { isDarkMode } from 'utils/themeMode';
import { getShadow } from 'styles/designTokens';

export const CalendarGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: getShadow(theme, 'md'),
  width: '100%',
  minHeight: '600px',
  alignContent: 'start'
}));

export const CalendarCell = styled(Box)(({ theme }) => ({
  aspectRatio: '1',

  minHeight: '30px',
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor: theme.palette.background.default,
  // Removed border to prevent double border with StyledCalendarDay
  [theme.breakpoints.down('sm')]: {
    aspectRatio: 'auto',
    minHeight: '56px'
  }
}));

export const WeekdayHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  border: !isDarkMode(theme) ? '1px solid #cbd5e1' : `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
})); 