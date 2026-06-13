import React from 'react';
import {
  Dialog,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { Calendar } from '../../types/calendar';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens } from 'styles/dialogTokens';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';

interface DuplicateCalendarDialogProps {
  open: boolean;
  calendar: Calendar | null;
  isDuplicating: boolean;
  onClose: () => void;
  onDuplicate: (withContent: boolean) => void;
}

export const DuplicateCalendarDialog: React.FC<DuplicateCalendarDialogProps> = ({
  open,
  calendar,
  isDuplicating,
  onClose,
  onDuplicate,
}) => {
  const theme = useTheme();
  const {
    violet, violetSofter, violetBorder,
    surfaceInset, hairline,
    paperSx, headerSx, iconAvatarSx, footerSx,
    monoSectionLabelSx, ghostButtonSx,
  } = useDialogTokens();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();

  const monoLabelSx = monoSectionLabelSx;

  const choiceButtonSx = {
    width: '100%',
    textTransform: 'none' as const,
    textAlign: 'left' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1.5,
    px: 1.75,
    py: 1.5,
    borderRadius: 1.5,
    border: `1px solid ${hairline}`,
    backgroundColor: surfaceInset,
    color: theme.palette.text.primary,
    transition: 'all 120ms ease',
    '&:hover': {
      borderColor: violetBorder,
      backgroundColor: violetSofter,
    },
    '&.Mui-disabled': {
      opacity: 0.6,
    },
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isDuplicating && onClose()}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: { ...paperSx, ...fullScreenPaperSx },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
          <CopyIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Duplicate calendar
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {calendar?.name ? `Copying "${calendar.name}"` : 'Choose what to copy'}
          </Typography>
        </Box>
        <IconButton
          onClick={() => !isDuplicating && onClose()}
          disabled={isDuplicating}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2.5, py: 2 }}>
        {isDuplicating ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
              gap: 1.5,
            }}
          >
            <CircularProgress size={32} thickness={4} sx={{ color: violet }} />
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: theme.palette.text.secondary,
              }}
            >
              Duplicating calendar…
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography sx={monoLabelSx}>Choose an option</Typography>

            <Button
              onClick={() => onDuplicate(false)}
              disabled={isDuplicating}
              sx={choiceButtonSx}
              endIcon={
                <ArrowIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              }
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: theme.palette.text.primary,
                    mb: 0.25,
                  }}
                >
                  Settings only
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.4,
                  }}
                >
                  Copy calendar structure and settings without trades
                </Typography>
              </Box>
            </Button>

            <Button
              onClick={() => onDuplicate(true)}
              disabled={isDuplicating}
              sx={choiceButtonSx}
              endIcon={
                <ArrowIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              }
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: theme.palette.text.primary,
                    mb: 0.25,
                  }}
                >
                  Settings & trades
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.4,
                  }}
                >
                  Copy everything including all logged trades
                </Typography>
              </Box>
            </Button>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ ...footerSx, pb: fullScreen ? SAFE_AREA_BOTTOM : undefined }}>
        <Button
          onClick={onClose}
          disabled={isDuplicating}
          sx={ghostButtonSx}
        >
          Cancel
        </Button>
      </Box>
    </Dialog>
  );
};
