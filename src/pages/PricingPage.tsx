import React, { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';

export type BillingCycle = 'monthly' | 'annual';

const PricingPage: React.FC = () => {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 600 }}>Pricing</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 6 }}>
          Free journal. Paid plans add Orion, your trading AI.
        </Typography>
        {/* Cycle toggle, tier cards, comparison table, FAQ added in later tasks. */}
        <Typography variant="caption">Cycle: {cycle}</Typography>
      </Container>
    </Box>
  );
};

export default PricingPage;
