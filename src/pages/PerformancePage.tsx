import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { ShowChart as PerformanceIcon } from '@mui/icons-material';

/** Phase 3 fills this in. Stub for now so the route resolves. */
const PerformancePage: React.FC = () => {
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <PerformanceIcon color="primary" />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Performance
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Cross-calendar performance analytics. Coming soon.
      </Typography>
    </Box>
  );
};

export default PerformancePage;
