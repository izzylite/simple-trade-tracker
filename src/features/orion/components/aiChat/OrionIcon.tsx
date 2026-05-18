import React from 'react';
import { Box, useTheme } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

interface OrionIconProps {
  size?: number | string;
  sx?: SxProps<Theme>;
  alt?: string;
}

const OrionIcon: React.FC<OrionIconProps> = ({ size = 36, sx, alt = 'Orion' }) => {
  const theme = useTheme();
  const src = theme.palette.mode === 'dark'
    ? '/asset/orion-icon.svg'
    : '/asset/orion-icon-bg.svg';

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block', ...sx }}
    />
  );
};

export default OrionIcon;
