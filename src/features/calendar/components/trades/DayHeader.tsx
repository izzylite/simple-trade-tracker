import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { EYEBROW_SX, TNUM, MONO_FONT, getInsetTileSx } from 'styles/designTokens';
import PnlValue from 'components/common/PnlValue';
import { formatCurrency } from 'utils/formatters';

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
  compact = false,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: compact ? 2 : 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: compact ? 1.5 : 2,
        }}
      >
        {!formInputVisible && (
          <IconButton
            onClick={onPrevDay}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ChevronLeft fontSize={compact ? 'small' : 'medium'} />
          </IconButton>
        )}

        {title && (
          <Typography
            variant={compact ? 'subtitle2' : 'h6'}
            sx={{
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
        )}

        {!formInputVisible && (
          <IconButton
            onClick={onNextDay}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ChevronRight fontSize={compact ? 'small' : 'medium'} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: compact ? 1.25 : 1.5 }}>
        {/* Day P&L tile */}
        <Box
          sx={{
            ...getInsetTileSx(theme),
            flex: 1,
            p: compact ? 1.25 : 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography sx={EYEBROW_SX}>Day P&amp;L</Typography>
          {loading ? (
            <Skeleton
              variant="text"
              width={compact ? 80 : 100}
              sx={{ fontSize: compact ? '1rem' : '1.25rem' }}
            />
          ) : (
            <PnlValue
              amount={total_pnl}
              format={formatCurrency}
              size={compact ? 'md' : 'lg'}
            />
          )}
        </Box>

        {/* Balance tile */}
        <Box
          sx={{
            ...getInsetTileSx(theme),
            flex: 1,
            p: compact ? 1.25 : 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            sx={{
              ...EYEBROW_SX,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Balance of the day
          </Typography>
          {loading ? (
            <Skeleton
              variant="text"
              width={compact ? 90 : 120}
              sx={{ fontSize: compact ? '1rem' : '1.25rem' }}
            />
          ) : (
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                fontSize: { xs: '1.1rem', sm: compact ? '1rem' : '1.5rem' },
                color: 'text.primary',
                fontFeatureSettings: TNUM,
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrency(account_balance)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DayHeader;
