import React, { useState, useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface Props {
    onGetStarted: () => void;
    onLogin: () => void;
}

const ACCENT = '#7c3aed';

const LandingNav: React.FC<Props> = ({ onGetStarted, onLogin }) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const handleAnchor = (id: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <Box
            component="nav"
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 999,
                px: { xs: 3, md: 6 },
                py: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backdropFilter: scrolled ? 'blur(20px) saturate(160%)' : 'none',
                bgcolor: scrolled ? 'rgba(8,8,8,0.85)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
            }}
        >
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: '#f1f5f9',
                    letterSpacing: '-0.01em',
                }}
            >
                JournoTrades
            </Typography>

            <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, md: 2 }}>
                {/* Anchor links — md+ only */}
                <Stack
                    direction="row"
                    spacing={3}
                    sx={{ display: { xs: 'none', md: 'flex' }, mr: 1.5 }}
                >
                    <Box
                        component="a"
                        href="#features"
                        onClick={handleAnchor('features')}
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.55)',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': { color: '#f1f5f9' },
                        }}
                    >
                        Methodology
                    </Box>
                    <Box
                        component={RouterLink}
                        to="/about"
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.55)',
                            textDecoration: 'none',
                            '&:hover': { color: '#f1f5f9' },
                        }}
                    >
                        About
                    </Box>
                </Stack>

                <Button
                    onClick={onLogin}
                    sx={{
                        color: 'rgba(255,255,255,0.65)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        px: 1.5,
                        py: 0.5,
                        minWidth: 'auto',
                        '&:hover': {
                            color: '#f1f5f9',
                            bgcolor: 'transparent',
                        },
                    }}
                >
                    Log in
                </Button>
                <Button
                    onClick={onGetStarted}
                    sx={{
                        color: '#f1f5f9',
                        bgcolor: ACCENT,
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        px: 2,
                        py: 0.6,
                        borderRadius: '8px',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: '#6d28d9',
                            boxShadow: 'none',
                        },
                    }}
                >
                    Start your logbook
                </Button>
            </Stack>
        </Box>
    );
};

export default LandingNav;
