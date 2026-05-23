/**
 * OrionUpgradeCard
 *
 * Rendered in the Orion chat surface when the ai-trading-agent edge function
 * returns a blocked response (`{ blocked: true, ... }`). Two cases:
 *
 *  - `orion_paid_only` — user is on the free tier; Orion is paid only.
 *  - `orion_budget_exhausted` — paid user has consumed their token budget
 *    for the current billing period.
 *
 * The blocked shape is emitted by the edge function at
 * `supabase/functions/ai-trading-agent/index.ts:2493-2511` (chat mode) and
 * `:2007-2030` (reminder mode).
 */

import React from 'react';
import { Box, Typography, Button, Stack, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CardShell from 'components/common/CardShell';

export type OrionBlockedReason = 'orion_paid_only' | 'orion_budget_exhausted';

interface Props {
  reason: OrionBlockedReason;
  resetAt?: string | null;
  tokensConsumed?: number | null;
  tokensBudget?: number | null;
}

export const OrionUpgradeCard: React.FC<Props> = ({
  reason,
  resetAt,
  tokensConsumed,
  tokensBudget,
}) => {
  const navigate = useNavigate();
  const isExhausted = reason === 'orion_budget_exhausted';

  const pct =
    tokensBudget && tokensConsumed && tokensBudget > 0
      ? Math.min(100, (tokensConsumed / tokensBudget) * 100)
      : 0;

  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'soon';

  return (
    <CardShell sx={{ p: 3, my: 2 }}>
      <Typography
        variant="h6"
        sx={{ fontWeight: 600, mb: 1, letterSpacing: '-0.015em' }}
      >
        {isExhausted ? 'Orion budget reached for this period' : 'Orion is a paid feature'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {isExhausted
          ? `You've used your Orion token budget for this period. Resets ${resetLabel}.`
          : 'Upgrade to chat with Orion, your trading AI assistant.'}
      </Typography>
      {isExhausted && tokensBudget != null && tokensConsumed != null && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography
            variant="caption"
            sx={{ color: 'text.tertiary', mt: 0.5, display: 'block' }}
          >
            {tokensConsumed.toLocaleString()} / {tokensBudget.toLocaleString()} tokens
          </Typography>
        </Box>
      )}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => navigate('/pricing')}>
          {isExhausted ? 'View plans' : 'See plans'}
        </Button>
      </Stack>
    </CardShell>
  );
};

export default OrionUpgradeCard;
