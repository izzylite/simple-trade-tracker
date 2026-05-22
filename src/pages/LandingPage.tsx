import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from 'contexts/SupabaseAuthContext';
import LoginDialog from 'components/auth/LoginDialog';
import LandingNav from 'components/landing/LandingNav';
import LandingHero from 'components/landing/LandingHero';
import LandingBento from 'components/landing/LandingBento';
import LandingFeatureRows from 'components/landing/LandingFeatureRows';
import { useSpotlight } from 'components/landing/landingHooks';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [showLoginDialog, setShowLoginDialog] = useState(false);
    const spotlightRef = useSpotlight<HTMLDivElement>();

    useEffect(() => {
        const errorCode = searchParams.get('error_code');
        const errorParam = searchParams.get('error');
        if (errorCode === 'otp_expired' || errorParam === 'access_denied') {
            navigate(`/auth/reset-password?${new URLSearchParams(searchParams).toString()}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const handleGetStarted = () => {
        if (user) navigate('/');
        else setShowLoginDialog(true);
    };

    return (
        <>
            <Box sx={{ bgcolor: '#080808', minHeight: '100vh', color: '#f1f5f9', overflowX: 'hidden', position: 'relative' }}>
                {/* Pointer-tracking spotlight + faint dot grid (skipped on touch + reduced-motion) */}
                <Box
                    ref={spotlightRef}
                    aria-hidden
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 0,
                        background: `
                            radial-gradient(circle at var(--mx, 50%) var(--my, 30%), rgba(124,58,237,0.13) 0%, transparent 38%),
                            radial-gradient(circle at 50% 100%, rgba(124,58,237,0.05) 0%, transparent 60%)
                        `,
                        transition: 'background 200ms linear',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
                            backgroundSize: '32px 32px',
                            maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
                        },
                        '@media (prefers-reduced-motion: reduce)': {
                            display: 'none',
                        },
                    }}
                />
                {/* Below-header backdrop — single violet bloom that lights the hero zone */}
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: { xs: 720, md: 900, lg: 1040 },
                        pointerEvents: 'none',
                        zIndex: 0,
                        background: 'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(124,58,237,0.22) 0%, transparent 60%)',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 200,
                            background: 'linear-gradient(to bottom, transparent, #080808)',
                        },
                    }}
                />
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <LandingNav onLogin={() => setShowLoginDialog(true)} />
                    <LandingHero onGetStarted={handleGetStarted} />
                    <LandingBento />
                    <LandingFeatureRows onGetStarted={handleGetStarted} />
                </Box>
            </Box>
            <LoginDialog
                open={showLoginDialog}
                onClose={() => setShowLoginDialog(false)}
                title="Start your logbook"
                subtitle="Sign in to start tracking your trades"
            />
        </>
    );
};

export default LandingPage;
