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
  alpha,
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
  const isDark = theme.palette.mode === 'dark';

  const accent =
    confirmColor === 'primary'
      ? theme.palette.primary.main
      : theme.palette[confirmColor].main;
  const accentDark =
    confirmColor === 'primary'
      ? theme.palette.primary.dark
      : theme.palette[confirmColor].dark;
  const accentSoft = alpha(accent, isDark ? 0.18 : 0.14);
  const accentBorder = alpha(accent, isDark ? 0.35 : 0.28);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const Icon = ICONS[confirmColor];

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG, ...sx }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: `1px solid ${hairline}`,
            boxShadow: theme.shadows[10],
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      }}
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
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accentSoft,
            color: accent,
            border: `1px solid ${accentBorder}`,
            flexShrink: 0,
          }}
        >
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
        }}
      >
        <Button
          onClick={onCancel}
          disabled={isSubmitting}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: theme.palette.text.secondary,
            '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
          }}
        >
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
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            backgroundColor: accent,
            color: '#fff',
            borderRadius: 1.25,
            px: 1.75,
            py: 0.75,
            boxShadow: 'none',
            '&:hover': { backgroundColor: accentDark, boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: alpha(accent, 0.35),
              color: alpha('#fff', 0.7),
            },
          }}
        >
          {confirmText}
        </Button>
      </Box>
    </Dialog>
  );
};

export default ConfirmationDialog;
