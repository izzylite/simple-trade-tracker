import React from 'react';
import { Box, Typography, Button, Chip, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CardShell from 'components/common/CardShell';
import type { BillingCycle, TierDefinition } from './tierData';

interface Props {
  tier: TierDefinition;
  cycle: BillingCycle;
  onCta: () => void;
  ctaLabel: string;
}

export const TierCard: React.FC<Props> = ({ tier, cycle, onCta, ctaLabel }) => {
  const isFree = tier.id === 'free';
  const isHighlighted = !!tier.badge;
  const monthlyDisplay = cycle === 'monthly' ? tier.monthlyPrice : tier.annualPriceMonthlyEq;
  const subtext = isFree
    ? 'Forever'
    : cycle === 'monthly'
    ? 'per month'
    : `per month, billed $${tier.annualPriceTotal}/yr`;

  return (
    <CardShell
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...(isHighlighted && {
          borderColor: 'primary.main',
          boxShadow: (theme: any) =>
            `0 0 0 1px ${theme.palette.primary.main}, 0 8px 32px rgba(124, 58, 237, 0.18)`,
        }),
      }}
    >
      {tier.badge && (
        <Chip
          label={tier.badge}
          size="small"
          color="primary"
          sx={{ position: 'absolute', top: -12, left: 16 }}
        />
      )}
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        {tier.name}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        <Typography component="span" variant="h3" sx={{ fontWeight: 600 }}>
          ${monthlyDisplay}
        </Typography>
        <Typography component="span" variant="body2" sx={{ ml: 0.5, color: 'text.secondary' }}>
          /mo
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, minHeight: '2.5em' }}>
        {subtext}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, minHeight: '3em' }}>
        {tier.blurb}
      </Typography>
      <Stack spacing={1.25} sx={{ mb: 3, flexGrow: 1 }}>
        {tier.highlights.map((h) => (
          <Box key={h} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <CheckIcon
              sx={{
                fontSize: 16,
                mt: '3px',
                color: isHighlighted ? 'primary.main' : 'success.main',
              }}
            />
            <Typography variant="body2">{h}</Typography>
          </Box>
        ))}
      </Stack>
      <Button
        variant={isHighlighted ? 'contained' : 'outlined'}
        color={isHighlighted ? 'primary' : 'inherit'}
        fullWidth
        onClick={onCta}
      >
        {ctaLabel}
      </Button>
    </CardShell>
  );
};

export default TierCard;
