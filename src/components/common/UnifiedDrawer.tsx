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

  // Header styling variants (kept for backward compatibility, no visual difference)
  headerVariant?: 'default' | 'enhanced';

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
  headerVariant: _headerVariant = 'enhanced', // kept for API compatibility
  sx,
  headerSx,
  contentSx
}) => {
  const theme = useTheme();

  const drawerPaperStyles = {
    backgroundColor: 'background.paper',
    borderLeft: anchor === 'right' ? `1px solid ${theme.palette.divider}` : undefined,
    borderRight: anchor === 'left' ? `1px solid ${theme.palette.divider}` : undefined,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
  };

  const headerStyles = {
    p: '16px 20px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    gap: 2
  };

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
          ...drawerPaperStyles
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
              p: 1,
              borderRadius: 1,
              background: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {React.isValidElement(icon) && typeof icon.type !== 'string'
                ? React.cloneElement(icon as React.ReactElement<any>, {
                    sx: {
                      color: 'primary.main',
                      fontSize: 20
                    }
                  })
                : React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<any>, {
                    style: {
                      color: 'var(--mui-palette-primary-main)',
                      fontSize: 20
                    }
                  })
                : icon
              }
            </Box>
          )}

          {/* Title and Subtitle */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
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
