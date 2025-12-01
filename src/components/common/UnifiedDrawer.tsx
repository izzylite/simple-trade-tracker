import React, { ReactNode } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  SxProps,
  Theme
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface UnifiedDrawerProps {
  // Basic drawer props
  open: boolean;
  onClose: () => void;
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  keepMounted?: boolean; // Keep drawer mounted when closed to preserve state

  // Header configuration
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerActions?: ReactNode; // Additional actions in header (badges, buttons, etc.)

  // Content
  children: ReactNode;

  // Styling options
  width?: { xs?: string | number; sm?: string | number };
  maxWidth?: string;
  zIndex?: number;

  // Header styling variants
  headerVariant?: 'default' | 'enhanced'; // enhanced = gradient background with blur

  // Custom styles
  sx?: SxProps<Theme>;
  headerSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
}

const UnifiedDrawer: React.FC<UnifiedDrawerProps> = ({
  open,
  onClose,
  anchor = 'right',
  keepMounted = false,
  title,
  subtitle,
  icon,
  headerActions,
  children,
  width = { xs: '100%', sm: 450 },
  maxWidth = '100vw',
  zIndex = 1300,
  headerVariant = 'enhanced',
  sx,
  headerSx,
  contentSx
}) => {
  const theme = useTheme();

  // Enhanced styling (used by SearchDrawer and EconomicCalendarDrawer)
  const enhancedDrawerStyles = {
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
    backdropFilter: 'blur(20px)',
    borderLeft: anchor === 'right' ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : undefined,
    borderRight: anchor === 'left' ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : undefined,
    boxShadow: theme.palette.mode === 'dark'
      ? '0 8px 32px rgba(0, 0, 0, 0.4)'
      : '0 8px 32px rgba(0, 0, 0, 0.12)'
  };

  // Enhanced header styling
  const enhancedHeaderStyles = {
    p: 3,
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    background: alpha(theme.palette.background.paper, 0.8),
    backdropFilter: 'blur(10px)'
  };

  // Default header styling (used by PinnedTradesDrawer)
  const defaultHeaderStyles = {
    p: 2,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    gap: 2
  };

  const headerStyles = headerVariant === 'enhanced' ? enhancedHeaderStyles : defaultHeaderStyles;

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted }}
      sx={{
        zIndex,
        '& .MuiDrawer-paper': {
          width,
          maxWidth,
          zIndex,
          ...(headerVariant === 'enhanced' ? enhancedDrawerStyles : {})
        },
        ...sx
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ ...headerStyles, ...headerSx }}>
          {/* Icon */}
          {icon && (
            <Box sx={{
              p: headerVariant === 'enhanced' ? 1.5 : 1,
              borderRadius: headerVariant === 'enhanced' ? 2 : 1,
              background: headerVariant === 'enhanced'
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`
                : alpha(theme.palette.primary.main, 0.1),
              border: headerVariant === 'enhanced' 
                ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {React.isValidElement(icon) && typeof icon.type !== 'string'
                ? React.cloneElement(icon as React.ReactElement<any>, {
                    sx: {
                      color: 'primary.main',
                      fontSize: headerVariant === 'enhanced' ? 22 : 20
                    }
                  })
                : React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<any>, {
                    style: {
                      color: 'var(--mui-palette-primary-main)',
                      fontSize: headerVariant === 'enhanced' ? 22 : 20
                    }
                  })
                : icon
              }
            </Box>
          )}

          {/* Title and Subtitle */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: headerVariant === 'enhanced' ? 700 : 600,
              mb: subtitle ? 0.5 : 0
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Header Actions */}
          {headerActions}

          {/* Close Button */}
          <IconButton
            onClick={onClose}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          ...contentSx 
        }}>
          {children}
        </Box>
      </Box>
    </Drawer>
  );
};

export default UnifiedDrawer;
