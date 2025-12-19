import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Container,
    Typography,
    Stack,
    useTheme,
    alpha,
    Grid,
    Card,
    CardContent,
    IconButton,
    Divider,
    Chip,
} from '@mui/material';
import {
    TrendingUp,
    SmartToy,
    CalendarMonth,
    BarChart,
    ArrowForward,
    CheckCircleOutline,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/SupabaseAuthContext';
import AnimatedBackground from '../components/common/AnimatedBackground';
import LoginDialog from '../components/auth/LoginDialog';

const FeatureCard = ({ icon, title, description, delay = 0 }: { icon: React.ReactNode, title: string, description: string, delay?: number }) => {
    const theme = useTheme();
    return (
        <Card
            sx={{
                height: '100%',
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: `fadeInUp 0.6s ease-out ${delay}s both`,
                '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(30px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                },
                '&:hover': {
                    transform: 'translateY(-12px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
                    borderColor: alpha(theme.palette.primary.main, 0.4),
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    '& .icon-box': {
                        transform: 'scale(1.1) rotate(5deg)',
                        bgcolor: 'primary.main',
                        color: 'white',
                    }
                }
            }}
        >
            <CardContent sx={{ p: 4 }}>
                <Box
                    className="icon-box"
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        mb: 3,
                        transition: 'all 0.3s ease',
                    }}
                >
                    {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 32 } })}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, letterSpacing: -0.5 }}>
                    {title}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: '1.05rem' }}>
                    {description}
                </Typography>
            </CardContent>
        </Card>
    );
};

const heroImages = [
    { src: '/asset/dashboard_account.png', alt: 'JournoTrades Calendar View' },
    { src: '/asset/calendar.png', alt: 'JournoTrades Calendar View' },
    { src: '/asset/dashboard.png', alt: 'JournoTrades Calendar View' },
    { src: '/asset/dashboard_note.png', alt: 'JournoTrades Calendar View' },
    { src: '/asset/dashboard_ai.png', alt: 'JournoTrades Calendar View' },
    { src: '/asset/performance_1.png', alt: 'Performance Analytics' },
    { src: '/asset/performance_2.png', alt: 'Tag Performance Analysis' },
    { src: '/asset/performance_3.png', alt: 'Trading Score Analysis' },
     { src: '/asset/performance_4.png', alt: 'Trading Score Analysis' },
];

const LandingPage: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showLoginDialog, setShowLoginDialog] = useState(false);

    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, []);

    const goToSlide = useCallback((index: number) => {
        setCurrentSlide(index);
    }, []);

    // Auto-advance slides
    useEffect(() => {
        const interval = setInterval(nextSlide, 4000);
        return () => clearInterval(interval);
    }, [nextSlide]);

    const handleGetStarted = () => {
        if (user) {
            navigate('/dashboard');
        } else {
            setShowLoginDialog(true);
        }
    };

    return (
        <Box sx={{
            bgcolor: 'background.default',
            minHeight: '100vh',
            overflowX: 'hidden',
            color: 'text.primary',
            position: 'relative'
        }}>
            <AnimatedBackground />

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                {/* Navigation */}
                <Box sx={{
                    py: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeInDown 0.8s ease-out',
                    '@keyframes fadeInDown': {
                        from: { opacity: 0, transform: 'translateY(-20px)' },
                        to: { opacity: 1, transform: 'translateY(0)' }
                    }
                }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 1.5,
                                bgcolor: 'primary.main',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                            }}
                        >
                            <TrendingUp sx={{ fontSize: 28 }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -1, fontSize: '1.75rem' }}>
                            JournoTrades
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                            variant="text"
                            onClick={() => navigate('/about')}
                            sx={{ fontWeight: 600, px: 2, display: { xs: 'none', sm: 'inline-flex' } }}
                        >
                            Features
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/dashboard')}
                            sx={{
                                borderRadius: 2.5,
                                px: 4,
                                py: 1.2,
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.4)}`,
                                }
                            }}
                        >
                            Dashboard
                        </Button>
                    </Stack>
                </Box>

                {/* Hero Section */}
                <Box sx={{ pt: { xs: 8, md: 12 }, textAlign: 'center' }}>
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 0.8,
                            borderRadius: 10,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            mb: 4,
                            animation: 'fadeIn 1s ease-out',
                            '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } }
                        }}
                    >
                        <CheckCircleOutline sx={{ fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Built by Traders, for Traders
                        </Typography>
                    </Box>

                    <Typography
                        variant="h1"
                        sx={{
                            fontSize: { xs: '2.75rem', md: '5rem' },
                            fontWeight: 900,
                            lineHeight: 1,
                            letterSpacing: -2,
                            mb: 3,
                            background: theme.palette.mode === 'dark'
                                ? `linear-gradient(135deg, #fff 30%, ${alpha('#fff', 0.6)})`
                                : `linear-gradient(135deg, #000 30%, ${alpha('#000', 0.6)})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            animation: 'scaleUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                            '@keyframes scaleUp': {
                                from: { opacity: 0, transform: 'scale(0.95) translateY(20px)' },
                                to: { opacity: 1, transform: 'scale(1) translateY(0)' }
                            }
                        }}
                    >
                        Stop Trading Blind. <br />
                        Start <span style={{ color: theme.palette.primary.main }}>Journaling</span>.
                    </Typography>
                    <Typography
                        variant="h5"
                        color="text.secondary"
                        sx={{
                            maxWidth: 800,
                            mx: 'auto',
                            mb: 7,
                            fontWeight: 400,
                            lineHeight: 1.6,
                            fontSize: { xs: '1.1rem', md: '1.4rem' },
                            animation: 'fadeInUp 1s ease-out 0.2s both',
                        }}
                    >
                        A high-performance trading journal built for discipline. Track every execution, analyze your psychology, and let AI reveal your true edge.
                    </Typography>

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2.5}
                        justifyContent="center"
                        sx={{
                            mb: 12,
                            animation: 'fadeInUp 1s ease-out 0.4s both',
                        }}
                    >
                        <Button
                            variant="contained"
                            size="large"
                            endIcon={<ArrowForward />}
                            onClick={handleGetStarted}
                            sx={{
                                height: 64,
                                px: 5,
                                fontSize: '1.15rem',
                                borderRadius: 3,
                                fontWeight: 800,
                                boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.4)}`,
                            }}
                        >
                            Get Started for Free
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            sx={{
                                height: 64,
                                px: 5,
                                fontSize: '1.15rem',
                                borderRadius: 3,
                                fontWeight: 700,
                                borderWidth: 2,
                                '&:hover': { borderWidth: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }
                            }}
                            onClick={() => navigate('/about')}
                        >
                            Explore Features
                        </Button>
                    </Stack>

                    {/* Image Slider */}
                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: 1100,
                            mx: 'auto',
                            position: 'relative',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                borderRadius: 2,
                                overflow: 'hidden',
                                boxShadow: `0 50px 100px -20px ${alpha(theme.palette.common.black, 0.3)}`,
                                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                bgcolor: 'background.paper',
                                width: '100%',
                                height: { xs: 280, sm: 400, md: 550 },
                            }}
                        >
                            {/* Slides */}
                            {heroImages.map((image, index) => (
                                <Box
                                    key={index}
                                    component="img"
                                    src={image.src}
                                    alt={image.alt}
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        objectPosition: 'top center',
                                        opacity: index === currentSlide ? 0.95 : 0,
                                        transition: 'opacity 0.6s ease-in-out',
                                    }}
                                />
                            ))}
                        </Box>

                        {/* Dot Indicators */}
                        <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="center"
                            sx={{ mt: 3 }}
                        >
                            {heroImages.map((_, index) => (
                                <Box
                                    key={index}
                                    onClick={() => goToSlide(index)}
                                    sx={{
                                        width: index === currentSlide ? 24 : 8,
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: index === currentSlide
                                            ? 'primary.main'
                                            : alpha(theme.palette.text.primary, 0.3),
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            bgcolor: index === currentSlide
                                                ? 'primary.main'
                                                : alpha(theme.palette.text.primary, 0.5),
                                        },
                                    }}
                                />
                            ))}
                        </Stack>
                    </Box>
                </Box>


                {/* Feature Showcase with Screenshots */}
                <Box sx={{ py: 10 }}>
                    <Box textAlign="center" sx={{ mb: 10 }}>
                        <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, letterSpacing: -1 }}>
                            Professional Grade Tools
                        </Typography>
                        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 650, mx: 'auto', fontSize: '1.25rem' }}>
                            We've stripped away the fluff to give you the exact metrics and insights used by elite day traders.
                        </Typography>
                    </Box>

                    {/* AI Assistant Feature */}
                    <Box sx={{ mb: 12 }}>
                        <Grid container spacing={6} alignItems="center">
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ pr: { md: 4 } }}>
                                    <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
                                        AI-Powered Insights
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }}>
                                        Chat with your personal trading assistant to analyze patterns, identify weaknesses, and get actionable feedback on your performance. Ask questions about your trades and receive data-driven insights.
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip label="Pattern Analysis" size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }} />
                                        <Chip label="Trade Review" size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }} />
                                        <Chip label="Psychology Insights" size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }} />
                                    </Stack>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.25)}`,
                                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/asset/assistant.png"
                                        alt="AI Trading Assistant"
                                        sx={{ width: '100%', height: 'auto', display: 'block' }}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Economic Events Feature */}
                    <Box sx={{ mb: 12 }}>
                        <Grid container spacing={6} alignItems="center" direction={{ xs: 'column-reverse', md: 'row' }}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.25)}`,
                                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/asset/events.png"
                                        alt="Economic Calendar Events"
                                        sx={{ width: '100%', height: 'auto', display: 'block' }}
                                    />
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ pl: { md: 4 } }}>
                                    <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
                                        Economic Calendar
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }}>
                                        Stay ahead of market-moving events with our integrated economic calendar. Filter by impact level, track upcoming releases, and correlate your trade performance with news events.
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip label="High Impact Events" size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }} />
                                        <Chip label="Real-time Updates" size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }} />
                                        <Chip label="Event Correlation" size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }} />
                                    </Stack>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Notes Feature */}
                    <Box sx={{ mb: 8 }}>
                        <Grid container spacing={6} alignItems="center">
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ pr: { md: 4 } }}>
                                    <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
                                        Rich Notes & Analysis
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }}>
                                        Document your trading journey with powerful note-taking capabilities. Add daily reflections, session reviews, and strategy notes with rich text formatting and color-coded organization.
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip label="Daily Journal" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }} />
                                        <Chip label="Rich Formatting" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }} />
                                        <Chip label="Color Templates" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }} />
                                    </Stack>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.25)}`,
                                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/asset/notes.png"
                                        alt="Notes and Analysis"
                                        sx={{ width: '100%', height: 'auto', display: 'block' }}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Additional Feature Cards */}
                    <Box sx={{ mt: 12 }}>
                        <Grid container spacing={4}>
                            {[
                                { icon: <TrendingUp />, title: "Risk Manager", desc: "Dynamic risk sizing tools to help you scale your accounts safely." },
                                { icon: <BarChart />, title: "Performance Charts", desc: "Visualize your equity curve, drawdowns, and key metrics over time." },
                                { icon: <CheckCircleOutline />, title: "Setup Tracking", desc: "Tag trades by strategy or session to find your true edge in the markets." },
                            ].map((feature, index) => (
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                                    <FeatureCard
                                        icon={feature.icon}
                                        title={feature.title}
                                        description={feature.desc}
                                        delay={index * 0.1}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </Box>

                {/* CTA Section */}
                <Box
                    sx={{
                        my: 15,
                        py: 10,
                        px: 4,
                        borderRadius: 6,
                        bgcolor: 'primary.main',
                        color: 'white',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: `0 24px 48px ${alpha(theme.palette.primary.main, 0.4)}`
                    }}
                >
                    {/* Decorative Circle */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '-50%',
                            right: '-10%',
                            width: 400,
                            height: 400,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.common.white, 0.1),
                            pointerEvents: 'none'
                        }}
                    />

                    <Typography variant="h2" sx={{ fontWeight: 800, mb: 3, position: 'relative' }}>
                        Ready to Level Up?
                    </Typography>
                    <Typography variant="h6" sx={{ mb: 6, opacity: 0.9, maxWidth: 600, mx: 'auto', position: 'relative' }}>
                        Join thousands of traders who are using JournoTrades to turn their hobby into a professional business.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleGetStarted}
                        sx={{
                            bgcolor: 'white',
                            color: 'primary.main',
                            px: 6,
                            py: 2,
                            borderRadius: 3,
                            fontWeight: 800,
                            fontSize: '1.2rem',
                            '&:hover': {
                                bgcolor: alpha(theme.palette.common.white, 0.9),
                                transform: 'scale(1.05)'
                            },
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        Get Started
                    </Button>
                </Box>

                {/* Footer */}
                <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 4 }}>
                        <IconButton color="primary"><TrendingUp /></IconButton>
                        <IconButton color="primary"><CalendarMonth /></IconButton>
                        <IconButton color="primary"><BarChart /></IconButton>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        © {new Date().getFullYear()} JournoTrades. All rights reserved.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Made with ❤️ for the trading community.
                    </Typography>
                </Box>
            </Container>

            <LoginDialog
                open={showLoginDialog}
                onClose={() => setShowLoginDialog(false)}
                title="Get Started"
                subtitle="Sign in to start tracking your trades"
            />
        </Box>
    );
};

export default LandingPage;
