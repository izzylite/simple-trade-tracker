import React from 'react';
import { Box, Container, Typography } from '@mui/material';

interface LegalPageProps {
  title: string;
  /** ISO date string, e.g. "2026-05-26". Rendered as "May 26, 2026". */
  lastUpdated: string;
  children: React.ReactNode;
}

const formatLastUpdated = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const LegalPage: React.FC<LegalPageProps> = ({ title, lastUpdated, children }) => (
  <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground', py: { xs: 6, md: 10 } }}>
    <Container maxWidth="md">
      <Typography variant="h2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 5, display: 'block' }}>
        Last updated: {formatLastUpdated(lastUpdated)}
      </Typography>
      <Box
        sx={{
          '& .MuiTypography-h3': { mt: 5, mb: 2, fontWeight: 600 },
          '& .MuiTypography-h4': { mt: 3, mb: 1.5, fontWeight: 600 },
          '& .MuiTypography-body1': { mb: 2, lineHeight: 1.7 },
          '& .MuiTypography-body2': { mb: 2, lineHeight: 1.7, color: 'text.secondary' },
          '& ul': { mb: 2, pl: 3 },
          '& li': { mb: 0.75 },
        }}
      >
        {children}
      </Box>
    </Container>
  </Box>
);

export default LegalPage;
