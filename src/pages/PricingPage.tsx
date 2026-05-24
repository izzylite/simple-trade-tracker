import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, ToggleButton, ToggleButtonGroup, Grid, Button, Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TIERS, type BillingCycle, type Tier, resolvePaddlePriceId } from 'features/billing/pricing/tierData';
import { TierCard } from 'features/billing/pricing/TierCard';
import { ComparisonTable } from 'features/billing/pricing/ComparisonTable';
import { PricingFAQ } from 'features/billing/pricing/PricingFAQ';
import { useAuth } from 'contexts/SupabaseAuthContext';
import { usePaddle } from 'features/billing/paddle/usePaddle';

const PricingPage: React.FC = () => {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [ctaError, setCtaError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const paddle = usePaddle();

  const handleCta = (tierId: Tier, ctaCycle: BillingCycle = cycle) => {
    if (tierId === 'free') {
      navigate('/');
      return;
    }
    if (!user) {
      // Sign-up first; pricing CTA stores intent and redirects.
      sessionStorage.setItem('pendingCheckout', JSON.stringify({ tier: tierId, cycle: ctaCycle }));
      navigate('/?intent=signup');
      return;
    }
    if (!paddle) {
      console.error('Paddle not initialized');
      setCtaError('Checkout is unavailable right now. Please try again in a moment.');
      return;
    }
    const priceId = resolvePaddlePriceId(tierId, ctaCycle);
    if (!priceId) {
      console.error('Missing Paddle price id for', tierId, ctaCycle);
      setCtaError(`The ${tierId} plan is not configured yet. Please contact support.`);
      return;
    }
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: user.email ? { email: user.email } : undefined,
      customData: { user_id: user.id },
      settings: {
        successUrl: `${window.location.origin}/account/billing?status=success`,
      },
    });
  };

  // Pending-checkout flow: a user clicked Subscribe while logged out → we
  // stashed intent in sessionStorage and redirected to landing for sign-up.
  // After they sign in and land back on /pricing, pop the intent and open
  // checkout automatically.
  useEffect(() => {
    if (!user || !paddle) return;
    const pendingRaw = sessionStorage.getItem('pendingCheckout');
    if (!pendingRaw) return;
    try {
      const pending = JSON.parse(pendingRaw) as { tier: Tier; cycle: BillingCycle };
      sessionStorage.removeItem('pendingCheckout');
      setCycle(pending.cycle);
      handleCta(pending.tier, pending.cycle);
    } catch {
      sessionStorage.removeItem('pendingCheckout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paddle]);

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

        <PricingFAQ />

        <Box sx={{ mt: 10, py: 6, textAlign: 'center' }}>
          <Button variant="contained" size="large" onClick={() => navigate('/')}>
            Start free — no credit card
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            Cancel anytime. 14-day refund.
          </Typography>
        </Box>
      </Container>
      <Snackbar
        open={!!ctaError}
        autoHideDuration={6000}
        onClose={() => setCtaError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setCtaError(null)} variant="filled">
          {ctaError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PricingPage;
