import React from 'react';
import { Box, BoxProps, useTheme } from '@mui/material';

interface PerfCardHeadProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
}

const PerfCardHead: React.FC<PerfCardHeadProps> = ({ icon, title, sub }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: `${theme.palette.custom.radius.md}px`,
            bgcolor: theme.palette.custom.tintViolet.strong,
            color: theme.palette.primary.main,
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
      <Box sx={{ fontWeight: 600, fontSize: '0.95rem', color: theme.palette.text.primary }}>{title}</Box>
      {sub !== undefined && (
        <Box
          sx={{
            ml: 'auto',
            fontSize: '0.75rem',
            color: theme.palette.text.tertiary,
            fontFeatureSettings: "'tnum' on, 'lnum' on",
          }}
        >
          {sub}
        </Box>
      )}
    </Box>
  );
};

interface PerfCardProps extends BoxProps {
  head?: PerfCardHeadProps;
  innerSx?: BoxProps['sx'];
}

const PerfCard: React.FC<PerfCardProps> = ({ head, children, innerSx, sx, ...rest }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.palette.custom.radius.xl}px`,
        overflow: 'hidden',
        color: theme.palette.text.primary,
        ...sx,
      }}
      {...rest}
    >
      {head && <PerfCardHead {...head} />}
      {innerSx ? <Box sx={innerSx}>{children}</Box> : children}
    </Box>
  );
};

export default PerfCard;
