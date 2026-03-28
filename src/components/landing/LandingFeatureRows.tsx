import React from 'react';
import { Box, Button, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShowChartIcon from '@mui/icons-material/ShowChart';

interface FeatureRowProps {
    eyebrow: string;
    title: string;
    description: string;
    chips: string[];
    imageSrc: string;
    imageAlt: string;
    reverse?: boolean;
    accentColor?: string;
}

const FeatureRow: React.FC<FeatureRowProps> = ({
    eyebrow, title, description, chips, imageSrc, imageAlt,
    reverse = false, accentColor = '#7c3aed',
}) => (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
            <Grid
                container
                spacing={{ xs: 6, md: 10 }}
                alignItems="center"
                direction={{ xs: 'column', md: reverse ? 'row-reverse' : 'row' }}
            >
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box>
                        <Typography sx={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: accentColor,
                            textTransform: 'uppercase',
                            letterSpacing: 1.6,
                            mb: 2,
                        }}>
                            {eyebrow}
                        </Typography>
                        <Typography sx={{
                            fontSize: { xs: '1.75rem', md: '2.35rem' },
                            fontWeight: 800,
                            color: '#fff',
                            letterSpacing: '-0.03em',
                            lineHeight: 1.18,
                            mb: 2.5,
                        }}>
                            {title}
                        </Typography>
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '1.05rem',
                            lineHeight: 1.8,
                            mb: 3,
                        }}>
                            {description}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                            {chips.map(chip => (
                                <Chip
                                    key={chip}
                                    label={chip}
                                    size="small"
                                    sx={{
                                        bgcolor: `${accentColor}14`,
                                        color: accentColor,
                                        border: `1px solid ${accentColor}30`,
                                        fontWeight: 600,
                                        fontSize: '0.73rem',
                                        borderRadius: '6px',
                                    }}
                                />
                            ))}
                        </Stack>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{
                        borderRadius: '14px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: `0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)`,
                    }}>
                        <Box
                            component="img"
                            src={imageSrc}
                            alt={imageAlt}
                            sx={{ width: '100%', display: 'block' }}
                        />
                    </Box>
                </Grid>
            </Grid>
        </Container>
    </Box>
);

const FEATURES: FeatureRowProps[] = [
    {
        eyebrow: 'Performance Analytics',
        title: "Know exactly where you're leaking money.",
        description: "Drill into tag performance, session analysis, risk/reward distribution, and equity curves. Stop guessing — the data tells the truth, and so does your journal.",
        chips: ['Tag Analysis', 'Equity Curve', 'Session Stats', 'Win Rate', 'Score Tracking'],
        imageSrc: '/asset/new_performance.png',
        imageAlt: 'Performance Analytics',
        accentColor: '#10b981',
        reverse: false,
    },
    {
        eyebrow: 'AI Insights',
        title: 'Your AI co-pilot for every trade.',
        description: "Ask questions about your trading history and get instant, data-driven answers. Identify patterns you didn't know existed — and fix the ones costing you.",
        chips: ['Pattern Recognition', 'Psychology Analysis', 'Custom Questions', 'Instant Feedback'],
        imageSrc: '/asset/new_ai.png',
        imageAlt: 'AI Trading Assistant',
        accentColor: '#06b6d4',
        reverse: true,
    },
];

const LandingFeatureRows: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    return (
        <Box sx={{ bgcolor: '#000' }}>
            {FEATURES.map((feature, i) => (
                <Box key={i} sx={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <FeatureRow {...feature} />
                </Box>
            ))}

            {/* CTA Section */}
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', py: { xs: 16} }}>
                <Container maxWidth="md">
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{
                            fontSize: { xs: '2.25rem', md: '3.75rem' },
                            fontWeight: 900,
                            color: '#fff',
                            letterSpacing: '-0.04em',
                            lineHeight: 1.08,
                            mb: 3,
                        }}>
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontStyle: 'italic',
                                    fontWeight: 400,
                                    color: 'rgba(255,255,255,0.42)',
                                    display: 'block',
                                    fontSize: { xs: '1.75rem', md: '2.75rem' },
                                    mb: 0.5,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                Ready to trade
                            </Box>
                            with discipline?
                        </Typography>
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.38)',
                            fontSize: '1.1rem',
                            mb: 5,
                            maxWidth: 400,
                            mx: 'auto',
                            lineHeight: 1.75,
                        }}>
                            Join traders turning their journals into their edge. Free to get started.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={onGetStarted}
                            endIcon={<ArrowForwardIcon />}
                            sx={{
                                bgcolor: '#fff',
                                color: '#000',
                                fontWeight: 700,
                                fontSize: '1.05rem',
                                px: 5,
                                py: 1.75,
                                borderRadius: '999px',
                                boxShadow: '0 0 70px rgba(255,255,255,0.22)',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.9)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 0 70px rgba(255,255,255,0.38)',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            Start journaling free
                        </Button>
                    </Box>
                </Container>
            </Box>

            {/* Footer */}
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', py: 5 }}>
                <Container maxWidth="lg">
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{
                                width: 28, height: 28, borderRadius: '8px',
                                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <ShowChartIcon sx={{ fontSize: 16, color: '#fff' }} />
                            </Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)' }}>
                                JournoTrades
                            </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)' }}>
                            © {new Date().getFullYear()} JournoTrades. Built for traders who take it seriously.
                        </Typography>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
};

export default LandingFeatureRows;
