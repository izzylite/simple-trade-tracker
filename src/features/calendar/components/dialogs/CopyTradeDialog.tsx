import React, { useMemo, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens } from 'styles/dialogTokens';
import { Trade } from 'features/calendar/types/dualWrite';
import { useCalendars } from 'features/calendar/hooks/useCalendars';
import {
  copyTradeToCalendars,
  CopyResult,
} from 'features/calendar/services/tradeCopyService';

interface CopyTradeDialogProps {
  open: boolean;
  trade: Trade | null;
  currentCalendarId?: string;
  userId?: string;
  onClose: () => void;
  /** Fired with the aggregate results when a copy run finishes. */
  onCopied?: (results: CopyResult[]) => void;
}

type RowStatus = 'idle' | 'running' | 'success' | 'error';

export const CopyTradeDialog: React.FC<CopyTradeDialogProps> = ({
  open,
  trade,
  currentCalendarId,
  userId,
  onClose,
  onCopied,
}) => {
  const theme = useTheme();
  const {
    violet,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoSectionLabelSx,
    ghostButtonSx,
    primaryButtonSx,
  } = useDialogTokens();

  const { calendars, isLoading, refresh } = useCalendars(userId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isCopying, setIsCopying] = useState(false);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [done, setDone] = useState(false);

  const destinations = useMemo(
    () => (calendars ?? []).filter((c) => c.id !== currentCalendarId && !c.deleted_at),
    [calendars, currentCalendarId]
  );

  const reset = () => {
    setSelected(new Set());
    setRowStatus({});
    setDone(false);
    setIsCopying(false);
  };

  const handleClose = () => {
    if (isCopying) return;
    reset();
    onClose();
  };

  const toggle = (id: string) => {
    if (isCopying || done) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    if (!trade || selected.size === 0) return;
    const targets = destinations.filter((c) => selected.has(c.id!));
    setIsCopying(true);
    setRowStatus(Object.fromEntries(targets.map((c) => [c.id!, 'running' as RowStatus])));

    const results = await copyTradeToCalendars(trade, targets, (r) => {
      setRowStatus((prev) => ({ ...prev, [r.calendarId]: r.status }));
    });

    setIsCopying(false);
    setDone(true);
    onCopied?.(results);
    // Refresh the calendars list so destination stats/balances revalidate after
    // the trade-insert webhook recomputes year_stats.
    if (results.some((r) => r.status === 'success')) refresh();
  };

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.5,
    py: 1,
    m: 0,
    borderRadius: 1.5,
    border: `1px solid ${hairline}`,
    backgroundColor: surfaceInset,
    transition: 'all 120ms ease',
    '&:hover': isCopying || done ? {} : { borderColor: violetBorder, backgroundColor: violetSofter },
    '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
  };

  const statusIcon = (id: string) => {
    const s = rowStatus[id];
    if (s === 'running') return <CircularProgress size={16} aria-label="Copying" sx={{ color: violet }} />;
    if (s === 'success') return <CheckCircleIcon titleAccess="Copied" sx={{ fontSize: 18, color: 'success.main' }} />;
    if (s === 'error') return <ErrorIcon titleAccess="Failed" sx={{ fontSize: 18, color: 'error.main' }} />;
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{ paper: { sx: paperSx } }}
    >
      <Box sx={headerSx}>
        <Box sx={iconAvatarSx}>
          <CopyIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Copy trade to…
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
            {trade?.name ? `Copying "${trade.name}"` : 'Choose one or more calendars'}
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={isCopying}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography sx={monoSectionLabelSx}>Destination calendars</Typography>
        <Box
          aria-live="polite"
          aria-busy={isCopying}
          sx={{
            mt: 1.25,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} sx={{ color: violet }} />
            </Box>
          ) : destinations.length === 0 ? (
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: theme.palette.text.secondary,
                py: 2,
                textAlign: 'center',
              }}
            >
              You don't have any other calendars to copy to.
            </Typography>
          ) : (
            destinations.map((c) => (
              <FormControlLabel
                key={c.id}
                sx={rowSx}
                control={
                  <Checkbox
                    checked={selected.has(c.id!)}
                    onChange={() => toggle(c.id!)}
                    disabled={isCopying || done}
                    size="small"
                    inputProps={{ 'aria-label': `Copy to ${c.name}` }}
                    sx={{ p: 0.5, color: violetBorder, '&.Mui-checked': { color: violet } }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: theme.palette.text.primary }}>
                        {c.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                        Balance ${Number(c.account_balance ?? 0).toLocaleString()}
                      </Typography>
                    </Box>
                    {statusIcon(c.id!)}
                  </Box>
                }
              />
            ))
          )}
        </Box>
      </Box>

      <Box sx={footerSx}>
        <Button onClick={handleClose} disabled={isCopying} sx={ghostButtonSx}>
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && (
          <Button
            onClick={handleCopy}
            disabled={isCopying || selected.size === 0}
            variant="contained"
            sx={primaryButtonSx}
            startIcon={
              isCopying ? (
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
              ) : (
                <CopyIcon sx={{ fontSize: 16 }} />
              )
            }
          >
            Copy
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default CopyTradeDialog;
