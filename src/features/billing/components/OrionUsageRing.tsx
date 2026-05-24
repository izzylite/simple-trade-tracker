/**
 * OrionUsageRing
 *
 * Compact circular progress ring that shows the user's Orion token usage
 * for the current billing period as a percentage of their tier budget.
 *
 * Hidden entirely when there's no usage to show (free tier, no row yet,
 * or signed-out) — see `useOrionUsage` for the visibility rules.
 *
 * Severity color follows the budget-meter convention used elsewhere:
 *   <50%   → success.main (green)
 *   50–80% → warning.main (amber)
 *   ≥80%   → error.main   (red)
 *
 * Pass a `refreshTrigger` (typically `messages.length` from `useAIChat`)
 * to re-fetch usage after each Orion message round. The edge function
 * increments `tokens_consumed` via `EdgeRuntime.waitUntil` so the ring
 * updates a beat or two after the response stream ends.
 *
 * Click navigates to `/account/billing`.
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useOrionUsage } from 'features/billing/hooks/useOrionUsage';

function humanizeTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function severityColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 80) return 'error';
  if (pct >= 50) return 'warning';
  return 'success';
}

interface Props {
  /** Change this value to force a refetch (e.g. messages.length). */
  refreshTrigger?: unknown;
}

export const OrionUsageRing: React.FC<Props> = ({ refreshTrigger }) => {
  const { usage, refresh } = useOrionUsage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (refreshTrigger !== undefined) refresh();
    // `refresh` is stable via useCallback. Intentionally omitting it so a
    // refresh only fires when the trigger value actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  if (!usage || usage.budget <= 0) return null;

  const rawPct = (usage.consumed / usage.budget) * 100;
  const clampedPct = Math.min(100, Math.max(0, rawPct));
  const color = severityColor(clampedPct);

  const resetLabel = `Resets ${new Date(usage.periodEnd).toLocaleDateString()}`;
  const tooltipBody = (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        Orion usage this period
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {humanizeTokens(usage.consumed)} of {humanizeTokens(usage.budget)} tokens
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
        {resetLabel}
      </Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipBody} arrow placement="bottom">
      <IconButton
        size="small"
        onClick={() => navigate('/account/billing')}
        aria-label={`Orion usage ${Math.round(clampedPct)}%`}
        sx={{
          position: 'relative',
          width: 36,
          height: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress
          variant="determinate"
          value={100}
          size={28}
          thickness={4}
          sx={{ color: 'action.disabledBackground', position: 'absolute' }}
        />
        <CircularProgress
          variant="determinate"
          value={clampedPct}
          size={28}
          thickness={4}
          color={color}
          sx={{ position: 'absolute' }}
        />
      </IconButton>
    </Tooltip>
  );
};
