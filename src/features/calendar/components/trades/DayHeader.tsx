import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

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
  const { isDark, violet, monoLabelSx } = useDialogTokens();

  const isPositive = total_pnl >= 0;
  const pnlColor = isPositive ? theme.palette.success.main : theme.palette.error.main;
  const pnlBg = alpha(pnlColor, isDark ? 0.12 : 0.08);
  const pnlBorder = alpha(pnlColor, isDark ? 0.3 : 0.22);

  const balanceBg = alpha(violet, isDark ? 0.12 : 0.08);
  const balanceBorder = alpha(violet, isDark ? 0.3 : 0.22);

  const tileSectionLabelSx = {
    ...monoLabelSx,
    fontSize: '0.6rem',
    letterSpacing: '0.14em',
  };

  const numberSx = {
    fontFamily: MONO_FONT,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    fontSize: compact ? '1rem' : '1.25rem',
  };

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
          <IconButton onClick={onPrevDay} size="small" sx={{ color: theme.palette.text.secondary }}>
            <ChevronLeft fontSize={compact ? 'small' : 'medium'} />
          </IconButton>
        )}

        {title && (
          <Typography
            variant={compact ? 'subtitle2' : 'h6'}
            sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            {title}
          </Typography>
        )}

        {!formInputVisible && (
          <IconButton onClick={onNextDay} size="small" sx={{ color: theme.palette.text.secondary }}>
            <ChevronRight fontSize={compact ? 'small' : 'medium'} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: compact ? 1.25 : 1.5 }}>
        {/* Day P&L tile */}
        <Box
          sx={{
            flex: 1,
            p: compact ? 1.25 : 1.5,
            borderRadius: 1.5,
            backgroundColor: pnlBg,
            border: `1px solid ${pnlBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography sx={tileSectionLabelSx}>Day P&amp;L</Typography>
          {loading ? (
            <Skeleton
              variant="text"
              width={compact ? 80 : 100}
              sx={{ fontSize: compact ? '1rem' : '1.25rem' }}
            />
          ) : (
            <Typography sx={{ ...numberSx, color: pnlColor }}>
              {isPositive ? '+' : ''}
              {total_pnl.toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Balance tile */}
        <Box
          sx={{
            flex: 1,
            p: compact ? 1.25 : 1.5,
            borderRadius: 1.5,
            backgroundColor: balanceBg,
            border: `1px solid ${balanceBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography sx={tileSectionLabelSx}>Balance of the day</Typography>
          {loading ? (
            <Skeleton
              variant="text"
              width={compact ? 90 : 120}
              sx={{ fontSize: compact ? '1rem' : '1.25rem' }}
            />
          ) : (
            <Typography sx={{ ...numberSx, color: theme.palette.text.primary }}>
              ${account_balance.toLocaleString()}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DayHeader;
