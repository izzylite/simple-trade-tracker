import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export const CalendarGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
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
}));

export const WeekdayHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
})); 