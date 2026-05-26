import React from 'react';
import { Box, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const FOOTER_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refunds', label: 'Refunds' },
];

const LandingFooter: React.FC = () => (
  <Box
    component="footer"
    sx={{
      bgcolor: '#080808',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      mt: { xs: 8, md: 12 },
      py: { xs: 4, md: 6 },
    }}
  >
    <Container maxWidth="lg">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2, sm: 3 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="caption" sx={{ color: 'rgba(241,245,249,0.5)' }}>
          © {new Date().getFullYear()} JournoTrades
        </Typography>
        <Stack direction="row" spacing={3} flexWrap="wrap" rowGap={1}>
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              component={RouterLink}
              to={to}
              underline="none"
              sx={{
                fontSize: '0.75rem',
                color: 'rgba(241,245,249,0.5)',
                '&:hover': { color: 'rgba(241,245,249,0.9)' },
                transition: 'color 120ms ease',
              }}
            >
              {label}
            </Link>
          ))}
        </Stack>
      </Stack>
    </Container>
  </Box>
);

export default LandingFooter;
