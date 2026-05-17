import React from 'react';
import {
  Dialog,
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  SxProps,
  Theme,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  HelpOutlineOutlined as PrimaryIcon,
  WarningAmberOutlined as WarningIcon,
  CheckCircleOutline as SuccessIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
import { Z_INDEX } from '../../styles/zIndex';
import { useDialogTokens } from '../../styles/dialogTokens';

type ConfirmColor = 'primary' | 'error' | 'warning' | 'success' | 'info';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  confirmColor?: ConfirmColor;
  sx?: SxProps<Theme>;
}

const ICONS: Record<ConfirmColor, React.ElementType> = {
  primary: PrimaryIcon,
  error: WarningIcon,
  warning: WarningIcon,
  success: SuccessIcon,
  info: InfoIcon,
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isSubmitting = false,
  confirmColor = 'primary',
  sx,
}) => {
  const theme = useTheme();

  const accent =
    confirmColor === 'primary'
      ? theme.palette.primary.main
      : theme.palette[confirmColor].main;

  const {
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    primaryButtonSx,
    ghostButtonSx,
  } = useDialogTokens(accent);

  const Icon = ICONS[confirmColor];

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG, ...sx }}
      slotProps={{ paper: { sx: paperSx } }}
    >
      {/* Header */}
      <Box sx={headerSx}>
        <Box sx={iconAvatarSx}>
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Box>
        <IconButton
          onClick={onCancel}
          disabled={isSubmitting}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2.5, py: 2 }}>
        {typeof message === 'string' ? (
          <Typography
            sx={{
              fontSize: '0.88rem',
              lineHeight: 1.55,
              color: theme.palette.text.primary,
            }}
          >
            {message}
          </Typography>
        ) : (
          message
        )}
      </Box>

      {/* Footer */}
      <Box sx={footerSx}>
        <Button onClick={onCancel} disabled={isSubmitting} sx={ghostButtonSx}>
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isSubmitting}
          variant="contained"
          endIcon={
            isSubmitting ? (
              <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
            ) : undefined
          }
          sx={primaryButtonSx}
        >
          {confirmText}
        </Button>
      </Box>
    </Dialog>
  );
};

export default ConfirmationDialog;
