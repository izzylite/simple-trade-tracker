import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  useTheme
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { format } from 'date-fns';
import { alpha } from '@mui/material/styles';

interface DayHeaderProps {
  formInputVisible: boolean;
  account_balance: number;
  title: string;
  total_pnl: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  loading?: boolean;
  /** Compact mode for side panel — smaller text */
  compact?: boolean;
}

const DayHeader: React.FC<DayHeaderProps> = ({
  account_balance,
  formInputVisible,
  total_pnl,
  title,
  onPrevDay,
  onNextDay,
  loading = false,
  compact = false
}) => {
  const theme = useTheme();
  
   
  
  return (
    <Box sx={{ mb: compact ? 2 : 3 }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: compact ? 1.5 : 2
      }}>
        {!formInputVisible && <IconButton onClick={onPrevDay} size="small">
          <ChevronLeft fontSize={compact ? 'small' : 'medium'} />
        </IconButton>}

        {title && <Typography
          variant={compact ? 'subtitle2' : 'h6'}
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>}

        {!formInputVisible && <IconButton onClick={onNextDay} size="small">
          <ChevronRight fontSize={compact ? 'small' : 'medium'} />
        </IconButton>
        }
      </Box>

      <Box sx={{ display: 'flex', gap: compact ? 1.5 : 2 }}>
        <Box
          sx={{
            flex: 1,
            p: compact ? 1.5 : 2,
            borderRadius: 1,
            bgcolor: total_pnl >= 0
              ? alpha(theme.palette.success.main, 0.1)
              : alpha(theme.palette.error.main, 0.1),
            border: '1px solid',
            borderColor: total_pnl >= 0
              ? alpha(theme.palette.success.main, 0.2)
              : alpha(theme.palette.error.main, 0.2)
          }}
        >
          <Typography
            variant={compact ? 'caption' : 'body2'}
            color="text.secondary"
          >
            Day P&L
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={compact ? 80 : 100}
              sx={{ fontSize: compact ? '0.95rem' : '1.25rem' }}
            />
          ) : (
            <Typography
              variant={compact ? 'body1' : 'h6'}
              sx={{
                fontWeight: 600,
                color: total_pnl >= 0
                  ? theme.palette.success.main
                  : theme.palette.error.main
              }}
            >
              {total_pnl >= 0 ? '+' : ''}{total_pnl.toLocaleString()}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            p: compact ? 1.5 : 2,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.2)
          }}
        >
          <Typography
            variant={compact ? 'caption' : 'body2'}
            color="text.secondary"
          >
            Balance Of The Day
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={compact ? 90 : 120}
              sx={{ fontSize: compact ? '0.95rem' : '1.25rem' }}
            />
          ) : (
            <Typography
              variant={compact ? 'body1' : 'h6'}
              sx={{ fontWeight: 600 }}
            >
              ${account_balance.toLocaleString()}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DayHeader;
