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

const LegalPage: React.FC<LegalPageProps> = ({ title, lastUpdated, children }) => {
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | JournoTrades`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  return (
  <Box
    sx={{
      // Shell locks non-landing routes to 100vh with overflow:hidden and adds
      // pt:8 (64px) for the fixed AppHeader. We own our own scroll container
      // sized to the visible area below that header.
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      bgcolor: 'custom.pageBackground',
    }}
  >
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h2" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
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
};

export default LegalPage;
