import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogProps,
  IconButton,
  Typography,
  Box,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import { useDialogTokens } from '../../styles/dialogTokens';

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
  const { paperSx, headerSx, iconAvatarSx, footerSx, primaryButtonSx, ghostButtonSx } = useDialogTokens();

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
          sx: { ...paperSx, maxHeight: '90vh' },
        },
      }}
      {...rest}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, flexShrink: 0 }}>
        {headerIcon && <Box sx={iconAvatarSx}>{headerIcon}</Box>}
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
        <Box sx={{ ...footerSx, flexShrink: 0 }}>
          {(!hideFooterCancelButton || cancelButtonAction) && (
            <Button
              onClick={cancelButtonAction || onClose}
              disabled={isSubmitting}
              sx={ghostButtonSx}
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
                  <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                ) : undefined
              }
              sx={primaryButtonSx}
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
