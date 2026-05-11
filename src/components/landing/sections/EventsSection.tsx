import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, HAIR, PAPER, TNUM, WIN, LOSS } from '../landingTokens';
import { useReveal, revealSx } from '../landingHooks';
import SectionMarker from './SectionMarker';

/* ─────────────────────────────────────────────
   Economic Events demo
   ──────────────────────────────────────────── */

interface EventRow {
    time: string;
    name: string;
    meta: string;
    impact: 'low' | 'med' | 'high';
    isNow?: boolean;
}

const EVENTS: EventRow[] = [
    { time: '06:30', name: 'Trade Balance · CH', meta: 'Forecast 3.8B · Prior 4.7B', impact: 'low' },
    { time: '08:30', name: 'Initial Jobless Claims · US', meta: 'Forecast 220K · Prior 215K', impact: 'med' },
    { time: '10:00', name: 'FOMC Rate Decision · US', meta: 'Forecast 4.50% · Prior 4.50% · ES tag: avoid', impact: 'high', isNow: true },
    { time: '10:30', name: 'Fed Press Conference · Powell', meta: 'Live tape · Vol expected', impact: 'high' },
    { time: '14:00', name: 'Crude Oil Inventories · US', meta: 'Forecast −2.1M · Prior +0.8M', impact: 'high' },
];

const ImpactBars: React.FC<{ impact: 'low' | 'med' | 'high' }> = ({ impact }) => {
    const bars = [0, 1, 2].map((i) => {
        let bg: string = 'rgba(255,255,255,0.12)';
        if (impact === 'high') bg = LOSS;
        else if (impact === 'med' && i < 2) bg = '#f59e0b';
        else if (impact === 'low' && i < 1) bg = WIN;
        return (
            <Box
                key={i}
                sx={{
                    width: 6,
                    height: 12,
                    borderRadius: '1.5px',
                    bgcolor: bg,
                }}
            />
        );
    });
    return <Stack direction="row" spacing={0.375}>{bars}</Stack>;
};

const EventsDemo: React.FC = () => {
    const reveal = useReveal<HTMLDivElement>();
    return (
        <Box
            ref={reveal.ref}
            sx={{
                bgcolor: PAPER,
                border: HAIR,
                borderRadius: '16px',
                overflow: 'hidden',
                ...revealSx(reveal.inView, 160),
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{ px: 2.25, py: 1.75, borderBottom: HAIR }}
            >
                <Box
                    sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '8px',
                        bgcolor: 'rgba(124,58,237,0.16)',
                        color: ACCENT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                    }}
                    aria-hidden
                >
                    ⚑
                </Box>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: '#f1f5f9',
                    }}
                >
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                    })}
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.7rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                        ml: 'auto !important',
                    }}
                >
                    3 high-impact
                </Typography>
            </Stack>

            {EVENTS.map((ev, i) => (
                <Box
                    key={ev.time}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr auto',
                        gap: 1.75,
                        alignItems: 'center',
                        px: 2.25,
                        py: 1.75,
                        borderTop: i === 0 ? 0 : HAIR,
                        bgcolor: ev.isNow ? 'rgba(124,58,237,0.16)' : 'transparent',
                        borderLeft: ev.isNow ? `2px solid ${ACCENT}` : '2px solid transparent',
                        position: 'relative',
                        transition: 'background 180ms',
                        '&:hover': {
                            bgcolor: ev.isNow
                                ? 'rgba(124,58,237,0.22)'
                                : 'rgba(124,58,237,0.04)',
                        },
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        {ev.isNow && (
                            <Box
                                aria-hidden
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: ACCENT,
                                }}
                            />
                        )}
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.55)',
                            }}
                        >
                            {ev.time}
                        </Typography>
                    </Stack>
                    <Box>
                        <Typography
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 600,
                                fontSize: '0.92rem',
                                color: '#f1f5f9',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {ev.name}
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.72rem',
                                color: 'rgba(255,255,255,0.5)',
                                mt: 0.375,
                            }}
                        >
                            {ev.meta}
                        </Typography>
                    </Box>
                    <ImpactBars impact={ev.impact} />
                </Box>
            ))}
        </Box>
    );
};

const EventsSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();
    return (
        <Box
            id="events"
            sx={{
                py: { xs: 10, md: 14 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Events" />
            <Container maxWidth={false} sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
                        gap: { xs: 4, md: 8 },
                        alignItems: 'center',
                    }}
                >
                    <Box>
                        <Typography
                            ref={eyebrow.ref}
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: ACCENT,
                                mb: 1,
                                ...revealSx(eyebrow.inView),
                            }}
                        >
                            Economic Events
                        </Typography>
                        <Typography
                            ref={head.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 800,
                                fontSize: { xs: '1.7rem', md: '2.1rem', lg: '2.5rem', xl: '2.8rem' },
                                color: '#f1f5f9',
                                letterSpacing: '-0.025em',
                                lineHeight: 1.18,
                                mb: 2,
                                ...revealSx(head.inView, 80),
                            }}
                        >
                            Know what&rsquo;s about to move price.
                        </Typography>
                        <Typography
                            ref={body.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.95rem',
                                color: 'rgba(255,255,255,0.6)',
                                lineHeight: 1.75,
                                maxWidth: 460,
                                ...revealSx(body.inView, 160),
                            }}
                        >
                            A clean macro calendar pinned to your timezone. Filter by impact,
                            mark sessions you sit out. Each day&rsquo;s events sit next to your
                            fills, so when you stop out into NFP you know it was the news, not
                            the setup.
                        </Typography>
                    </Box>
                    <EventsDemo />
                </Box>
            </Container>
        </Box>
    );
};

export default EventsSection;
