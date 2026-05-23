import React, { useState } from 'react';
import { Box, Container, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { BillingCycle } from 'features/billing/pricing/tierData';

const PricingPage: React.FC = () => {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

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

        {/* Tier cards in Task 3 */}
      </Container>
    </Box>
  );
};

export default PricingPage;
