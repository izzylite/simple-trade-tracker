import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const ACCENT = '#7c3aed';

interface Props {
    onGetStarted: () => void;
    onWatchTour: () => void;
}

const fadeUp = {
    opacity: 0,
    animation: 'lpFadeUp 700ms cubic-bezier(.2,.7,.2,1) forwards',
    '@keyframes lpFadeUp': {
        from: { opacity: 0, transform: 'translateY(14px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
    },
    '@media (prefers-reduced-motion: reduce)': {
        opacity: 1,
        animation: 'none',
    },
};

const LandingHero: React.FC<Props> = ({ onGetStarted, onWatchTour }) => {
    return (
        <Box sx={{ pt: { xs: 14, md: 20 }, pb: { xs: 8, md: 12 }, position: 'relative' }}>
            <Container maxWidth={false} sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}>
                {/* Early-access badge */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 3, md: 4 } }}>
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.75,
                            py: 0.75,
                            borderRadius: '999px',
                            bgcolor: 'rgba(124,58,237,0.16)',
                            border: '1px solid rgba(124,58,237,0.32)',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#c4b5fd',
                            ...fadeUp,
                            animationDelay: '100ms',
                        }}
                    >
                        <Box
                            aria-hidden
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: ACCENT,
                            }}
                        />
                        Free in early access · $9/mo at v1.0
                    </Box>
                </Box>
                {/* Display headline */}
                <Typography
                    component="h1"
                    sx={{
                        textAlign: 'center',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 900,
                        fontSize: { xs: '2.6rem', sm: '3.5rem', md: '4.5rem' },
                        lineHeight: 1.02,
                        letterSpacing: '-0.04em',
                        color: '#f1f5f9',
                        mb: { xs: 4, md: 5 },
                    }}
                >
                    <Box
                        component="span"
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 400,
                            fontSize: { xs: '2.1rem', sm: '2.75rem', md: '3.4rem' },
                            color: 'rgba(255,255,255,0.5)',
                            display: 'block',
                            mb: 0.25,
                            letterSpacing: '-0.03em',
                            ...fadeUp,
                            animationDelay: '200ms',
                        }}
                    >
                        The trading journal
                    </Box>
                    <Box
                        component="span"
                        sx={{
                            display: 'inline-block',
                            ...fadeUp,
                            animationDelay: '380ms',
                        }}
                    >
                        that finds your{' '}
                        <Box
                            component="span"
                            sx={{ color: ACCENT }}
                        >
                            edge
                        </Box>
                        .
                    </Box>
                </Typography>

                {/* Single-column lede */}
                <Box sx={{ maxWidth: 580, mx: 'auto', ...fadeUp, animationDelay: '540ms' }}>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: { xs: '1rem', md: '1.05rem', lg: '1.15rem', xl: '1.25rem' },
                            lineHeight: 1.75,
                            textAlign: 'center',
                        }}
                    >
                        A logbook for traders who keep one open every session. Calendars by
                        strategy or account. Fills logged into a monthly grid with R, tags,
                        and screenshots. An assistant that reviews your week the way you
                        would, if you had time.
                    </Typography>
                </Box>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    justifyContent="center"
                    alignItems="center"
                    sx={{ mt: { xs: 4, md: 5 }, ...fadeUp, animationDelay: '700ms' }}
                >
                    <Button
                        onClick={onGetStarted}
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                        sx={{
                            bgcolor: ACCENT,
                            color: '#f1f5f9',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            px: 3,
                            py: 1.4,
                            borderRadius: '8px',
                            boxShadow: 'none',
                            textTransform: 'none',
                            letterSpacing: '-0.005em',
                            willChange: 'transform',
                            transition: 'background 180ms, box-shadow 180ms, transform 200ms cubic-bezier(.2,.7,.2,1)',
                            '& .MuiButton-endIcon': {
                                transition: 'transform 180ms',
                            },
                            '&:hover': {
                                bgcolor: '#6d28d9',
                                boxShadow: '0 14px 28px -10px rgba(124,58,237,0.6)',
                            },
                            '&:hover .MuiButton-endIcon': {
                                transform: 'translateX(3px)',
                            },
                        }}
                    >
                        Start your logbook
                    </Button>
                    <Button
                        onClick={onWatchTour}
                        sx={{
                            bgcolor: 'transparent',
                            color: 'rgba(255,255,255,0.55)',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            px: 2.5,
                            py: 1.3,
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            textTransform: 'none',
                            letterSpacing: '-0.005em',
                            transition: 'color 180ms, border-color 180ms, background 180ms',
                            '&:hover': {
                                color: '#f1f5f9',
                                borderColor: 'rgba(255,255,255,0.22)',
                                bgcolor: 'rgba(255,255,255,0.02)',
                            },
                        }}
                    >
                        Watch a 60-second tour
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
};

export default LandingHero;
