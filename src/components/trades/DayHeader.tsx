import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  useTheme
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { format } from 'date-fns';
import { alpha } from '@mui/material/styles';

interface DayHeaderProps {
  formInputVisible: boolean;
  accountBalance: number;
  title:string,
  totalPnL: number;
  onPrevDay: () => void;
  onNextDay: () => void;
}

const DayHeader: React.FC<DayHeaderProps> = ({
  accountBalance,
  formInputVisible,
  totalPnL,
  title,
  onPrevDay,
  onNextDay
}) => {
  const theme = useTheme();
  
   
  
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        {!formInputVisible && <IconButton onClick={onPrevDay} size="small">
          <ChevronLeft />
        </IconButton>}
        
        
        {title && <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>}
        
        {!formInputVisible && <IconButton onClick={onNextDay} size="small">
          <ChevronRight />
        </IconButton>
        }
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
       
        
        <Box
          sx={{
            flex: 1,
            p: 2,
            borderRadius: 1,
            bgcolor: totalPnL >= 0
              ? alpha(theme.palette.success.main, 0.1)
              : alpha(theme.palette.error.main, 0.1),
            border: '1px solid',
            borderColor: totalPnL >= 0
              ? alpha(theme.palette.success.main, 0.2)
              : alpha(theme.palette.error.main, 0.2)
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Day P&L
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: totalPnL >= 0
                ? theme.palette.success.main
                : theme.palette.error.main
            }}
          >
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()}
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            p: 2,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.2)
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Balance Of The Day
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            ${accountBalance.toLocaleString()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DayHeader;
