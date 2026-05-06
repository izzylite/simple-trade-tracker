import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { Notes as NotesIcon } from '@mui/icons-material';

/** Phase 5 fills this in. Stub for now so the route resolves. */
const NotesPage: React.FC = () => {
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <NotesIcon color="primary" />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Notes
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Cross-calendar notes. Coming soon.
      </Typography>
    </Box>
  );
};

export default NotesPage;
