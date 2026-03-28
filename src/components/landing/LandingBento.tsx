import React from 'react';
import { Box, Container, Grid, Typography } from '@mui/material';

interface BentoCardProps {
    label: string;
    title: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
    accentColor?: string;
    imageHeight?: number;
}

const BentoCard: React.FC<BentoCardProps> = ({
    label, title, description, imageSrc, imageAlt,
    accentColor = '#7c3aed', imageHeight = 220,
}) => (
    <Box sx={{
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.07)',
        bgcolor: '#0d0d0d',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
        '&:hover': {
            borderColor: `${accentColor}55`,
            boxShadow: `0 0 0 1px ${accentColor}20, 0 20px 60px rgba(0,0,0,0.6)`,
        },
    }}>
        <Box sx={{ p: 3, pb: 2 }}>
            <Typography sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: accentColor,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                mb: 1.5,
            }}>
                {label}
            </Typography>
            <Typography sx={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#fff',
                mb: 0.75,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
            }}>
                {title}
            </Typography>
            <Typography sx={{
                fontSize: '0.83rem',
                color: 'rgba(255,255,255,0.38)',
                lineHeight: 1.6,
            }}>
                {description}
            </Typography>
        </Box>
        <Box sx={{ position: 'relative', overflow: 'hidden', mt: 'auto' }}>
            <Box
                sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 36,
                    background: 'linear-gradient(to bottom, #0d0d0d, transparent)',
                    zIndex: 1,
                }}
            />
            <Box
                component="img"
                src={imageSrc}
                alt={imageAlt}
                sx={{
                    width: '100%',
                    height: imageHeight,
                    objectFit: 'cover',
                    objectPosition: 'top',
                    display: 'block',
                }}
            />
        </Box>
    </Box>
);

const LandingBento: React.FC = () => {
    return (
        <Box sx={{ py: { xs: 10}, bgcolor: '#000' }}>
            <Container maxWidth="lg">
                {/* Section header */}
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Typography sx={{
                        fontSize: { xs: '1.9rem', md: '2.75rem' },
                        fontWeight: 800,
                        color: '#fff',
                        letterSpacing: '-0.04em',
                        lineHeight: 1.12,
                        mb: 2,
                    }}>
                        Everything a serious trader needs.
                    </Typography>
                    <Typography sx={{
                        color: 'rgba(255,255,255,0.38)',
                        fontSize: '1.05rem',
                        maxWidth: 460,
                        mx: 'auto',
                        lineHeight: 1.65,
                    }}>
                        One platform. Every tool. Zero excuses for not improving.
                    </Typography>
                </Box>

                {/* Bento Grid — Row 1 */}
                <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <BentoCard
                            label="Calendar"
                            title="Your trading calendar, reimagined."
                            description="Color-coded P&L at a glance. Navigate months in seconds, see your best and worst days instantly."
                            imageSrc="/asset/new_calendar.png"
                            imageAlt="Trading Calendar"
                            accentColor="#7c3aed"
                            imageHeight={280}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <BentoCard
                            label="AI Assistant"
                            title="Ask anything about your trades."
                            description="Your AI co-pilot for pattern recognition and trade psychology analysis."
                            imageSrc="/asset/new_ai.png"
                            imageAlt="AI Trading Assistant"
                            accentColor="#06b6d4"
                            imageHeight={280}
                        />
                    </Grid>
                </Grid>

                {/* Bento Grid — Row 2 */}
                <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <BentoCard
                            label="Performance"
                            title="Deep performance analytics."
                            description="Charts, metrics, and insights into your true trading edge."
                            imageSrc="/asset/new_performance.png"
                            imageAlt="Performance Analytics"
                            accentColor="#10b981"
                            imageHeight={200}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <BentoCard
                            label="Notes"
                            title="Rich trading journal."
                            description="Document sessions with full rich-text formatting and color-coded templates."
                            imageSrc="/asset/new_notes.png"
                            imageAlt="Trading Notes"
                            accentColor="#f59e0b"
                            imageHeight={200}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <BentoCard
                            label="Events"
                            title="Economic calendar built-in."
                            description="Track high-impact news and correlate events directly with your trade data."
                            imageSrc="/asset/new_events.png"
                            imageAlt="Economic Calendar"
                            accentColor="#ef4444"
                            imageHeight={200}
                        />
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default LandingBento;
