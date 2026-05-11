import React from 'react';
import { Box, Container, Typography } from '@mui/material';

interface Props {
    onGetStarted: () => void;
}

const LandingHero: React.FC<Props> = ({ onGetStarted: _onGetStarted }) => {
    return (
        <Box sx={{ pt: { xs: 14, md: 20 }, pb: { xs: 8, md: 12 } }}>
            <Container maxWidth="md">
                {/* Display headline */}
                <Typography
                    component="h1"
                    sx={{
                        textAlign: 'center',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 900,
                        fontSize: { xs: '2.6rem', sm: '3.5rem', md: '5rem' },
                        lineHeight: 1.02,
                        letterSpacing: '-0.04em',
                        color: '#f1f5f9',
                        mb: { xs: 5, md: 7 },
                    }}
                >
                    <Box
                        component="span"
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 400,
                            fontSize: { xs: '2.1rem', sm: '2.75rem', md: '3.75rem' },
                            color: 'rgba(255,255,255,0.5)',
                            display: 'block',
                            mb: 0.25,
                            letterSpacing: '-0.03em',
                        }}
                    >
                        The trading journal
                    </Box>
                    that finds your edge.
                </Typography>

                {/* Single-column lede */}
                <Box sx={{ maxWidth: 640, mx: 'auto' }}>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            color: 'rgba(255,255,255,0.72)',
                            fontSize: { xs: '1rem', md: '1.1rem' },
                            lineHeight: 1.8,
                            textAlign: 'center',
                        }}
                    >
                        A structured logbook for traders who keep one open every session.
                        Calendars by strategy or eval account, trades logged into a monthly grid,
                        notes and screenshots filed alongside each fill, and an in-app assistant
                        that reads your history out loud when you ask. The numbers are the product.
                        The rest of this page is a sample.
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};

export default LandingHero;
