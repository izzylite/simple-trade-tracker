import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Typography,
  Box,
  CircularProgress,
  Select,
  MenuItem,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { Calendar } from '../../types/dualWrite';
import { dialogProps } from '../../styles/dialogStyles';
import { Z_INDEX } from '../../styles/zIndex';

interface CalendarLinkDialogProps {
  open: boolean;
  calendar: Calendar | null;
  calendars: Calendar[];
  isLoading: boolean;
  onClose: () => void;
  onLink: (targetCalendarId: string) => Promise<void>;
  onUnlink: () => Promise<void>;
}

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

export const CalendarLinkDialog: React.FC<CalendarLinkDialogProps> = ({
  open,
  calendar,
  calendars,
  isLoading,
  onClose,
  onLink,
  onUnlink,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetSofter = alpha(violet, isDark ? 0.12 : 0.1);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const monoLabelSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
  };

  const availableCalendars = calendars.filter(
    (c) => c.id !== calendar?.id && c.linked_to_calendar_id !== calendar?.id,
  );

  const linkedCalendar = calendar?.linked_to_calendar_id
    ? calendars.find((c) => c.id === calendar.linked_to_calendar_id)
    : null;

  useEffect(() => {
    if (open) {
      setSelectedCalendarId('');
      setError(null);
    }
  }, [open]);

  const handleLink = async () => {
    if (!selectedCalendarId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onLink(selectedCalendarId);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link calendar';
      if (message.toLowerCase().includes('circular')) {
        setError('Cannot link: this would create a circular link chain.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setIsSubmitting(true);
    try {
      await onUnlink();
      onClose();
    } catch {
      // swallow — error reflected upstream
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = isLoading || isSubmitting;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
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
            backgroundColor: violetSoft,
            color: violet,
            border: `1px solid ${violetBorder}`,
            flexShrink: 0,
          }}
        >
          <LinkIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {linkedCalendar ? 'Linked calendar' : 'Link calendar'}
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
            {calendar?.name ? `Source · ${calendar.name}` : 'Pick a target calendar'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={isProcessing}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2.5, py: 2 }}>
        {isProcessing && !linkedCalendar && !selectedCalendarId ? (
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
            <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
              {isSubmitting ? 'Updating link…' : 'Loading…'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Explainer */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                px: 1.25,
                py: 1,
                borderRadius: 1.25,
                border: `1px solid ${hairline}`,
                backgroundColor: surfaceInset,
              }}
            >
              <InfoIcon sx={{ fontSize: 14, color: violet, mt: 0.25, flexShrink: 0 }} />
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: theme.palette.text.secondary,
                  lineHeight: 1.5,
                }}
              >
                New trades in <strong>{calendar?.name || 'this calendar'}</strong> copy
                to the target automatically. Updates and deletes sync for 24h after
                creation.
              </Typography>
            </Box>

            {error && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.875,
                  borderRadius: 1.25,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                  backgroundColor: alpha(theme.palette.error.main, 0.08),
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    color: theme.palette.error.main,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </Typography>
              </Box>
            )}

            {linkedCalendar ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Currently linked to</Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1.5,
                    border: `1px solid ${violetBorder}`,
                    backgroundColor: violetSofter,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: violet,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {linkedCalendar.name}
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.74rem', color: theme.palette.text.secondary }}
                    >
                      Trades sync to this calendar
                    </Typography>
                  </Box>
                  <Button
                    onClick={handleUnlink}
                    disabled={isProcessing}
                    startIcon={<UnlinkIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      color: theme.palette.error.main,
                      backgroundColor: alpha(theme.palette.error.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                      borderRadius: 1.25,
                      px: 1.25,
                      py: 0.5,
                      flexShrink: 0,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.error.main, 0.16),
                      },
                    }}
                  >
                    Unlink
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>
                  Target calendar
                  <Box
                    component="span"
                    sx={{
                      color: theme.palette.error.main,
                      fontFamily: 'inherit',
                      ml: 0.25,
                    }}
                  >
                    *
                  </Box>
                </Typography>
                <Select
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  disabled={isProcessing || availableCalendars.length === 0}
                  displayEmpty
                  size="small"
                  renderValue={(val) => {
                    if (!val) {
                      return (
                        <Typography
                          sx={{ fontSize: '0.88rem', color: theme.palette.text.disabled }}
                        >
                          Choose a calendar…
                        </Typography>
                      );
                    }
                    const sel = availableCalendars.find((c) => c.id === val);
                    return sel?.name || '';
                  }}
                  sx={{
                    borderRadius: 1.5,
                    backgroundColor: surfaceInset,
                    '& fieldset': { borderColor: hairline },
                    '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
                    '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
                    '& .MuiSelect-select': {
                      py: 1.1,
                      fontSize: '0.88rem',
                      fontWeight: 500,
                    },
                  }}
                >
                  {availableCalendars.length === 0 ? (
                    <MenuItem value="" disabled>
                      No available calendars
                    </MenuItem>
                  ) : (
                    availableCalendars.map((c) => (
                      <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.88rem' }}>
                        {c.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
                {availableCalendars.length === 0 && (
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: theme.palette.warning.main,
                      mt: 0.25,
                    }}
                  >
                    No calendars available to link. Create another calendar first.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
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
          onClick={onClose}
          disabled={isProcessing}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: theme.palette.text.secondary,
            '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
          }}
        >
          {linkedCalendar ? 'Close' : 'Cancel'}
        </Button>
        {!linkedCalendar && (
          <Button
            onClick={handleLink}
            disabled={isProcessing || !selectedCalendarId}
            variant="contained"
            endIcon={
              isSubmitting ? (
                <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
              ) : (
                <ArrowIcon sx={{ fontSize: 14 }} />
              )
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
              '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
              '&.Mui-disabled': {
                backgroundColor: alpha(violet, 0.35),
                color: alpha('#fff', 0.7),
              },
            }}
          >
            {isSubmitting ? 'Linking…' : 'Link calendar'}
          </Button>
        )}
      </Box>
    </Dialog>
  );
};
