import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { SmartToy as AssistantIcon } from '@mui/icons-material';

/** Phase 4 fills this in. Stub for now so the route resolves. */
const AssistantPage: React.FC = () => {
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <AssistantIcon color="primary" />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Assistant
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Cross-calendar AI assistant. Coming soon.
      </Typography>
    </Box>
  );
};

export default AssistantPage;
