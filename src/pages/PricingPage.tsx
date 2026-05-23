import React, { useState } from 'react';
import { Box, Container, Typography, ToggleButton, ToggleButtonGroup, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TIERS, type BillingCycle, type Tier } from 'features/billing/pricing/tierData';
import { TierCard } from 'features/billing/pricing/TierCard';
import { ComparisonTable } from 'features/billing/pricing/ComparisonTable';

const PricingPage: React.FC = () => {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const navigate = useNavigate();

  const handleCta = (tierId: Tier) => {
    if (tierId === 'free') {
      navigate('/'); // landing page handles signup dialog
      return;
    }
    // Paddle checkout wiring lives in Task 5.
    console.warn('Paid checkout not yet wired:', tierId, cycle);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 600 }}>Pricing</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Free journal. Paid plans add Orion, your trading AI.
        </Typography>

        <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={cycle}
            exclusive
            onChange={(_, v) => v && setCycle(v)}
            size="small"
          >
            <ToggleButton value="monthly">Monthly</ToggleButton>
            <ToggleButton value="annual">Annual</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" sx={{ color: 'success.main' }}>
            Save 20% with annual
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {TIERS.map((tier) => (
            <Grid key={tier.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <TierCard
                tier={tier}
                cycle={cycle}
                ctaLabel={tier.id === 'free' ? 'Start free' : 'Subscribe'}
                onCta={() => handleCta(tier.id)}
              />
            </Grid>
          ))}
        </Grid>

        <ComparisonTable />

        {/* FAQ in Task 6 */}
      </Container>
    </Box>
  );
};

export default PricingPage;
