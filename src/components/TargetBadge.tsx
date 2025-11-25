import React from 'react';
import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircle, Flag } from '@mui/icons-material';

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
      bgcolor: isMet ? alpha(theme.palette.success.main, 0.9) : alpha(theme.palette.primary.main, 0.1),
      color: isMet ? 'white' : 'primary.main',
      borderRadius: '12px',
      width: 'auto',
      height: 22,
      px: 0.8,
      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
    }}>
      {isMet ? (
        <CheckCircle sx={{ fontSize: '0.875rem', mr: 0.3 }} />
      ) : (
        <Flag sx={{ fontSize: '0.875rem', mr: 0.3 }} />
      )}
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: isMet ? '0.5rem' : '0.7rem' }}>
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
