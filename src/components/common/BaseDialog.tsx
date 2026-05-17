import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogProps,
  IconButton,
  Typography,
  Box,
  Button,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';

export interface BaseDialogProps extends Omit<DialogProps, 'title'> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional icon rendered in the violet header avatar. */
  headerIcon?: ReactNode;
  /** Optional second line in the header (e.g. subtitle / hint copy). */
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  hideCloseButton?: boolean;
  hideFooterCancelButton?: boolean;
  cancelButtonText?: string;
  cancelButtonAction?: () => void;
  primaryButtonText?: string;
  primaryButtonAction?: (e?: React.FormEvent) => void;
  isSubmitting?: boolean;
  contentSx?: any;
}

const BaseDialog: React.FC<BaseDialogProps> = ({
  open,
  onClose,
  title,
  headerIcon,
  subtitle,
  actions,
  children,
  maxWidth = 'sm',
  fullWidth = true,
  hideCloseButton = false,
  hideFooterCancelButton = false,
  cancelButtonText = 'Cancel',
  cancelButtonAction,
  primaryButtonText = 'Save',
  primaryButtonAction,
  isSubmitting = false,
  contentSx = {},
  ...rest
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const showFooter = !!(actions || !hideFooterCancelButton || primaryButtonAction);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: `1px solid ${hairline}`,
            boxShadow: theme.shadows[10],
            backgroundImage: 'none',
            maxHeight: '90vh',
            overflow: 'hidden',
          },
        },
      }}
      {...rest}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${hairline}`,
          flexShrink: 0,
        }}
      >
        {headerIcon && (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: violetSoft,
              color: violet,
              border: `1px solid ${violetBorder}`,
              flexShrink: 0,
            }}
          >
            {headerIcon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {typeof title === 'string' ? (
            <Typography
              sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}
            >
              {title}
            </Typography>
          ) : (
            title
          )}
          {subtitle && (
            typeof subtitle === 'string' ? (
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: theme.palette.text.secondary,
                  lineHeight: 1.3,
                }}
              >
                {subtitle}
              </Typography>
            ) : (
              subtitle
            )
          )}
        </Box>
        {!hideCloseButton && (
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: theme.palette.text.secondary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          overflowY: 'auto',
          ...scrollbarStyles(theme),
          ...contentSx,
        }}
      >
        {children}
      </Box>

      {/* Footer */}
      {showFooter && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${hairline}`,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : alpha(theme.palette.text.primary, 0.02),
            flexShrink: 0,
          }}
        >
          {(!hideFooterCancelButton || cancelButtonAction) && (
            <Button
              onClick={cancelButtonAction || onClose}
              disabled={isSubmitting}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.text.primary, 0.04),
                },
              }}
            >
              {cancelButtonText}
            </Button>
          )}

          {actions}

          {primaryButtonAction && (
            <Button
              onClick={primaryButtonAction}
              disabled={isSubmitting}
              variant="contained"
              endIcon={
                isSubmitting ? (
                  <CircularProgress
                    size={14}
                    thickness={5}
                    sx={{ color: 'inherit' }}
                  />
                ) : undefined
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: violet,
                color: '#fff',
                borderRadius: 1.25,
                px: 1.75,
                py: 0.75,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                  boxShadow: 'none',
                },
                '&.Mui-disabled': {
                  backgroundColor: alpha(violet, 0.35),
                  color: alpha('#fff', 0.7),
                },
              }}
            >
              {primaryButtonText}
            </Button>
          )}
        </Box>
      )}
    </Dialog>
  );
};

export default BaseDialog;
