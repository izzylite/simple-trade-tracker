import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface Props {
    onGetStarted: () => void;
}

const BrowserFrame: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
    <Box sx={{
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 40px 100px rgba(0,0,0,0.85)',
        bgcolor: '#111',
    }}>
        <Box sx={{
            bgcolor: '#1c1c1c',
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5f57' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28c940' }} />
            <Box sx={{
                mx: 'auto',
                px: 2.5,
                py: 0.4,
                bgcolor: '#111',
                borderRadius: '6px',
                minWidth: 220,
                textAlign: 'center',
            }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.3 }}>
                    app.journotrades.com
                </Typography>
            </Box>
        </Box>
        <Box
            component="img"
            src={src}
            alt={alt}
            sx={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top' }}
        />
    </Box>
);

const STATS = [
    { value: 'AI', label: 'Powered insights' },
    { value: '∞', label: 'Pattern analysis' },
    { value: '100%', label: 'Data-driven' },
    { value: 'Free', label: 'To get started' },
];

const LandingHero: React.FC<Props> = ({ onGetStarted }) => {
    return (
        <Box sx={{
            position: 'relative',
            pt: { xs: 16, md: 22 },
            pb: { xs: 10, md: 16 },
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                maskImage: 'radial-gradient(ellipse 70% 65% at 50% 0%, black 30%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 0%, black 30%, transparent 100%)',
            },
            '&::after': {
                content: '""',
                position: 'absolute',
                top: '-15%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                height: '700px',
                background: 'radial-gradient(ellipse, rgba(124,58,237,0.16) 0%, transparent 65%)',
                pointerEvents: 'none',
            },
        }}>
            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                {/* Badge */}
                <Stack direction="row" justifyContent="center" sx={{ mb: 4 }}>
                    <Box sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 0.75,
                        borderRadius: '999px',
                        border: '1px solid rgba(124,58,237,0.4)',
                        bgcolor: 'rgba(124,58,237,0.08)',
                    }}>
                        <Box sx={{
                            width: 7, height: 7, borderRadius: '50%', bgcolor: '#a78bfa',
                            boxShadow: '0 0 8px rgba(167,139,250,0.9)',
                            animation: 'hpulse 2s ease-in-out infinite',
                            '@keyframes hpulse': {
                                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                '50%': { opacity: 0.5, transform: 'scale(0.85)' },
                            },
                        }} />
                        <Typography sx={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, letterSpacing: 0.3 }}>
                            Now with AI Trading Assistant
                        </Typography>
                    </Box>
                </Stack>

                {/* Headline */}
                <Typography
                    component="h1"
                    sx={{
                        textAlign: 'center',
                        fontSize: { xs: '2.75rem', sm: '3.75rem', md: '5.5rem' },
                        lineHeight: 1.04,
                        letterSpacing: '-0.035em',
                        mb: 3,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 900,
                        color: '#fff',
                        animation: 'hfadeUp 0.8s cubic-bezier(0.16,1,0.3,1)',
                        '@keyframes hfadeUp': {
                            from: { opacity: 0, transform: 'translateY(24px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                        },
                    }}
                >
                    <Box
                        component="span"
                        sx={{
                            fontFamily: "'DM Sans', sans-serif", 
                            fontWeight: 400,
                            color: 'rgba(255,255,255,0.45)',
                            display: 'block',
                            fontSize: { xs: '2rem', sm: '2.75rem', md: '3.75rem' },
                            mb: 0.25,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        The trading journal
                    </Box>
                    that finds your edge.
                </Typography>

                {/* Subtext */}
                <Typography sx={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: { xs: '1rem', md: '1.2rem' },
                    maxWidth: 540,
                    mx: 'auto',
                    mb: 5,
                    lineHeight: 1.75,
                    fontWeight: 400,
                    animation: 'hfadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both',
                }}>
                    Track every execution, uncover hidden patterns with AI, and discover exactly what makes you profitable.
                </Typography>

                {/* CTAs */}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    justifyContent="center"
                    sx={{ mb: 10, animation: 'hfadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}
                >
                    <Button
                        variant="contained"
                        size="large"
                        onClick={onGetStarted}
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                            bgcolor: '#fff',
                            color: '#000',
                            fontWeight: 700,
                            fontSize: '1rem',
                            px: 4,
                            py: 1.5,
                            borderRadius: '999px',
                            boxShadow: '0 0 48px rgba(255,255,255,0.18)',
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.92)',
                                boxShadow: '0 0 48px rgba(255,255,255,0.3)',
                                transform: 'translateY(-1px)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Start journaling free
                    </Button>
                    <Button
                        size="large"
                        sx={{
                            color: 'rgba(255,255,255,0.6)',
                            fontWeight: 500,
                            fontSize: '1rem',
                            px: 4,
                            py: 1.5,
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.22)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Explore features
                    </Button>
                </Stack>

                {/* Browser Frame */}
                <Box sx={{ maxWidth: 1040, mx: 'auto', animation: 'hfadeUp 1s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}>
                    <BrowserFrame src="/asset/new_dashboard.png" alt="JournoTrades Dashboard" />
                </Box>

                {/* Stats Band */}
                <Box sx={{
                    mt: 8,
                    py: 4,
                    px: { xs: 2, md: 6 },
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    bgcolor: 'rgba(255,255,255,0.025)',
                    display: 'flex',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                    gap: 3,
                }}>
                    {STATS.map(({ value, label }, i) => (
                        <Box key={label} sx={{
                            textAlign: 'center',
                            flex: 1,
                            minWidth: 100,
                            px: 2,
                            borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                        }}>
                            <Typography sx={{
                                fontSize: { xs: '1.75rem', md: '2.25rem' },
                                fontWeight: 800,
                                color: '#fff',
                                letterSpacing: '-0.04em',
                                lineHeight: 1,
                                mb: 0.5,
                            }}>
                                {value}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>
                                {label}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

export default LandingHero;
