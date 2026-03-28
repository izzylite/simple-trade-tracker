import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/SupabaseAuthContext';
import LoginDialog from '../components/auth/LoginDialog';
import LandingNav from '../components/landing/LandingNav';
import LandingHero from '../components/landing/LandingHero';
import LandingBento from '../components/landing/LandingBento';
import LandingFeatureRows from '../components/landing/LandingFeatureRows';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [showLoginDialog, setShowLoginDialog] = useState(false);

    useEffect(() => {
        const errorCode = searchParams.get('error_code');
        const errorParam = searchParams.get('error');
        if (errorCode === 'otp_expired' || errorParam === 'access_denied') {
            navigate(`/auth/reset-password?${new URLSearchParams(searchParams).toString()}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const handleGetStarted = () => {
        if (user) navigate('/dashboard');
        else setShowLoginDialog(true);
    };

    return (
        <>
            <Box sx={{ bgcolor: '#000', minHeight: '100vh', color: '#fff', overflowX: 'hidden' }}>
                <LandingNav
                    onGetStarted={handleGetStarted}
                    onLogin={() => setShowLoginDialog(true)}
                />
                <LandingHero onGetStarted={handleGetStarted} />
                <LandingBento />
                <LandingFeatureRows onGetStarted={handleGetStarted} />
            </Box>
            <LoginDialog
                open={showLoginDialog}
                onClose={() => setShowLoginDialog(false)}
                title="Get Started"
                subtitle="Sign in to start tracking your trades"
            />
        </>
    );
};

export default LandingPage;
