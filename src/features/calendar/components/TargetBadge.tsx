import React from 'react';
import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import { CheckCircle, Flag } from '@mui/icons-material';
import { TNUM } from 'styles/designTokens';

interface TargetBadgeProps {
  progress: number;
  isMet: boolean;
  tooltipText?: string;
}

const TargetBadge: React.FC<TargetBadgeProps> = ({
  progress,
  isMet,
  tooltipText = 'Shows progress towards your target goal'
}) => {
  const theme = useTheme();

  const badgeContent = (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: isMet
        ? theme.palette.success.main
        : theme.palette.custom.tintViolet.soft,
      color: isMet ? theme.palette.common.white : 'primary.main',
      borderRadius: `${theme.palette.custom.radius.lg}px`,
      width: 'auto',
      height: 22,
      px: 0.8,
      border: `1px solid ${
        isMet ? theme.palette.success.main : theme.palette.custom.tintViolet.strong
      }`,
    }}>
      {isMet ? (
        <CheckCircle sx={{ fontSize: '0.875rem', mr: 0.3 }} />
      ) : (
        <Flag sx={{ fontSize: '0.875rem', mr: 0.3 }} />
      )}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: isMet ? '0.5rem' : '0.7rem',
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.01em',
        }}
      >
        {Math.min(Math.max(progress, 0), 100).toFixed(0)}%
      </Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipText} arrow placement="top">
      {badgeContent}
    </Tooltip>
  );
};

export default TargetBadge;
