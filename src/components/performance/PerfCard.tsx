import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { perfTokens as t } from './performanceTokens';

interface PerfCardHeadProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
}

const PerfCardHead: React.FC<PerfCardHeadProps> = ({ icon, title, sub }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 2.25,
      py: 1.5,
      borderBottom: `1px solid ${t.hair}`,
    }}
  >
    {icon && (
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: '8px',
          bgcolor: t.violetSoft,
          color: t.violet,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {icon}
      </Box>
    )}
    <Box sx={{ fontWeight: 600, fontSize: '0.95rem', color: t.fg }}>{title}</Box>
    {sub !== undefined && (
      <Box
        sx={{
          ml: 'auto',
          fontSize: '0.75rem',
          color: t.fgLow,
          fontFeatureSettings: t.fontFeatures.tabular,
        }}
      >
        {sub}
      </Box>
    )}
  </Box>
);

interface PerfCardProps extends BoxProps {
  head?: PerfCardHeadProps;
  innerSx?: BoxProps['sx'];
}

const PerfCard: React.FC<PerfCardProps> = ({ head, children, innerSx, sx, ...rest }) => (
  <Box
    sx={{
      bgcolor: t.bgAlt,
      border: `1px solid ${t.hair}`,
      borderRadius: `${t.radius.card}px`,
      overflow: 'hidden',
      color: t.fg,
      ...sx,
    }}
    {...rest}
  >
    {head && <PerfCardHead {...head} />}
    {innerSx ? <Box sx={innerSx}>{children}</Box> : children}
  </Box>
);

export default PerfCard;
