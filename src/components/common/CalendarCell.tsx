import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DayStatus, StyledCalendarDay } from '../StyledComponents';
import { Trade } from '../../types/trade';
import { calculateTotalPnL } from '../../utils/statsUtils';
import { formatCurrency } from '../../utils/formatters';

interface CalendarCellProps {
  day: Date;
  trades: Trade[];
  isCurrentMonth: boolean;
  isToday?: boolean;
  onClick: () => void;
}

const CalendarCell: React.FC<CalendarCellProps> = ({
  day,
  trades,
  isCurrentMonth,
  isToday = false,
  onClick
}) => {
  const theme = useTheme();
  
  // Calculate day stats
  const totalPnL = calculateTotalPnL(trades);
  const dayStatus: DayStatus = 
    totalPnL > 0 ? 'win' : 
    totalPnL < 0 ? 'loss' : 
    'neutral';

  return (
    <StyledCalendarDay
      onClick={onClick}
      $isCurrentMonth={isCurrentMonth}
      $dayStatus={dayStatus}
      sx={[
        {
          backgroundColor: dayStatus === 'win'
            ? alpha(theme.palette.success.light, 0.3)
            : dayStatus === 'loss'
              ? alpha(theme.palette.error.light, 0.3)
              : theme.palette.background.paper,
          transition: 'all 0.2s ease-in-out',
          border: `1px solid ${isToday 
            ? theme.palette.primary.main 
            : theme.palette.divider}`,
          boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.05)}`,
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: dayStatus === 'win'
              ? alpha(theme.palette.success.light, 0.25)
              : dayStatus === 'loss'
                ? alpha(theme.palette.error.light, 0.25)
                : alpha(theme.palette.primary.light, 0.1)
          }
        },
        isToday && {
          borderWidth: 2,
          borderColor: theme.palette.primary.main
        }
      ]}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        opacity: isCurrentMonth ? 1 : 0.4 
      }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: isToday ? 700 : 500,
            color: isToday ? theme.palette.primary.main : 'inherit'
          }}
        >
          {day.getDate()}
        </Typography>
        
        {trades.length > 0 && (
          <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 700,
                color: totalPnL > 0 
                  ? theme.palette.success.main 
                  : totalPnL < 0 
                    ? theme.palette.error.main 
                    : theme.palette.text.secondary
              }}
            >
              {formatCurrency(totalPnL)}
            </Typography>
            
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ fontSize: '0.65rem' }}
            >
              {trades.length} trade{trades.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </Box>
    </StyledCalendarDay>
  );
};

export default CalendarCell;
