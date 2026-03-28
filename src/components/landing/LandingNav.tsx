import React, { useState, useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';

interface Props {
    onGetStarted: () => void;
    onLogin: () => void;
}

const LandingNav: React.FC<Props> = ({ onGetStarted, onLogin }) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    return (
        <Box
            component="nav"
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 999,
                px: { xs: 3, md: 8 },
                py: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.3s ease, border-color 0.3s ease',
                backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'none',
                bgcolor: scrolled ? 'rgba(0,0,0,0.82)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{
                    width: 32, height: 32, borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(124,58,237,0.45)',
                }}>
                    <ShowChartIcon sx={{ fontSize: 18, color: '#fff' }} />
                </Box>
                <Typography sx={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: '#fff',
                    letterSpacing: '-0.3px',
                    fontFamily: "'DM Sans', sans-serif",
                }}>
                    JournoTrades
                </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                    onClick={onLogin}
                    sx={{
                        color: 'rgba(255,255,255,0.6)',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        borderRadius: 2,
                        px: 2,
                        '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                    }}
                >
                    Log in
                </Button>
                <Button
                    onClick={onGetStarted}
                    sx={{
                        bgcolor: '#fff',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        px: 2.5,
                        py: 0.9,
                        borderRadius: '999px',
                        boxShadow: 'none',
                        lineHeight: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', boxShadow: 'none', transform: 'none' },
                    }}
                >
                    Get started free
                </Button>
            </Stack>
        </Box>
    );
};

export default LandingNav;
