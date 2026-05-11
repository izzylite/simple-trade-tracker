import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useReveal, revealSx } from './landingHooks';
import SectionMarker from './sections/SectionMarker';

const ACCENT = '#7c3aed';
const HAIR = '1px solid rgba(255,255,255,0.08)';
const RULE = '1px solid rgba(255,255,255,0.14)';
const TNUM = "'tnum' on, 'lnum' on";

/* ─────────────────────────────────────────────
   Share — single micro-section.
   Calendar/Performance/Notes/Assistant pillars
   already covered by the demo sections above;
   only Share earns its own slot here.
   ──────────────────────────────────────────── */

const ShareStrip: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();
    const link = useReveal<HTMLDivElement>();
    return (
        <Box sx={{ py: { xs: 7, md: 10 }, borderTop: HAIR, position: 'relative' }}>
            <SectionMarker label="Share" />
            <Container
                maxWidth={false}
                sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.1fr' },
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
                            Share
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
                            Send a clean week, not a screenshot.
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
                            Read-only links to a calendar, a tag, or a single trade. Hand a
                            coach the week. Hand a reviewer the rule-break and nothing else.
                            Mentor reviews stop being lossy.
                        </Typography>
                    </Box>
                    <Box
                        ref={link.ref}
                        sx={{
                            bgcolor: '#0a0a0a',
                            border: HAIR,
                            borderRadius: '12px',
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.25,
                            ...revealSx(link.inView, 160),
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.4)',
                            }}
                        >
                            Read-only · expires in 7 days
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                                sx={{
                                    flex: 1,
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontSize: '0.85rem',
                                    color: '#f1f5f9',
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    border: HAIR,
                                    borderRadius: '8px',
                                    px: 1.5,
                                    py: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                journotrades.app/s/9k3-nfp-week
                            </Box>
                            <Box
                                component="button"
                                type="button"
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontSize: '0.78rem',
                                    fontWeight: 500,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: ACCENT,
                                    bgcolor: 'rgba(124,58,237,0.16)',
                                    border: '1px solid rgba(124,58,237,0.32)',
                                    borderRadius: '8px',
                                    px: 1.5,
                                    py: 1,
                                    cursor: 'pointer',
                                    transition: 'background 150ms',
                                    '&:hover': { bgcolor: 'rgba(124,58,237,0.24)' },
                                }}
                            >
                                Copy
                            </Box>
                        </Stack>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

/* ─────────────────────────────────────────────
   Final CTA + Colophon
   ──────────────────────────────────────────── */

const FinalCTA: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head1 = useReveal<HTMLDivElement>();
    const head2 = useReveal<HTMLDivElement>();
    const copy = useReveal<HTMLDivElement>();
    const cta = useReveal<HTMLDivElement>();
    return (
        <Box
            sx={{
                pt: { xs: 12, md: 16 },
                pb: { xs: 12, md: 14 },
                borderTop: RULE,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Container maxWidth="sm" sx={{ position: 'relative' }}>
                <Typography
                    ref={eyebrow.ref}
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: ACCENT,
                        mb: 2,
                        ...revealSx(eyebrow.inView),
                    }}
                >
                    Get started
                </Typography>
                <Typography
                    ref={head1.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: { xs: '2rem', md: '2.75rem', lg: '3.25rem', xl: '3.75rem' },
                        color: '#f1f5f9',
                        letterSpacing: '-0.035em',
                        lineHeight: 1.1,
                        mb: 1,
                        ...revealSx(head1.inView, 80),
                    }}
                >
                    Open one calendar.
                </Typography>
                <Typography
                    ref={head2.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                        fontSize: { xs: '1.5rem', md: '2rem' },
                        color: 'rgba(255,255,255,0.42)',
                        letterSpacing: '-0.025em',
                        lineHeight: 1.2,
                        mb: 2.5,
                        ...revealSx(head2.inView, 160),
                    }}
                >
                    Then start logging.
                </Typography>
                <Typography
                    ref={copy.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: '0.95rem',
                        mb: 4,
                        lineHeight: 1.7,
                        maxWidth: 460,
                        mx: 'auto',
                        ...revealSx(copy.inView, 240),
                    }}
                >
                    Free while in early access. One calendar to begin, more when you need
                    them. Lock in $9/mo before v1.0 ships.
                </Typography>
                <Box ref={cta.ref} sx={{ ...revealSx(cta.inView, 320) }}>
                    <Button
                        onClick={onGetStarted}
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                            bgcolor: ACCENT,
                            color: '#f1f5f9',
                            fontWeight: 700,
                            fontSize: '1rem',
                            px: 3.5,
                            py: 1.6,
                            borderRadius: '10px',
                            boxShadow: '0 10px 30px -10px rgba(124,58,237,0.5)',
                            textTransform: 'none',
                            letterSpacing: '-0.005em',
                            willChange: 'transform',
                            transition: 'background 180ms, box-shadow 180ms, transform 200ms cubic-bezier(.2,.7,.2,1)',
                            '& .MuiButton-endIcon': {
                                transition: 'transform 180ms',
                            },
                            '&:hover': {
                                bgcolor: '#6d28d9',
                                boxShadow: '0 18px 40px -10px rgba(124,58,237,0.7)',
                            },
                            '&:hover .MuiButton-endIcon': {
                                transform: 'translateX(3px)',
                            },
                        }}
                    >
                        Start your logbook
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

const Colophon: React.FC = () => (
    <Box sx={{ borderTop: HAIR, py: 5 }}>
        <Container
            maxWidth={false}
            sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'baseline' }}
                justifyContent="space-between"
                spacing={2}
            >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box
                        aria-hidden
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '2px',
                            bgcolor: ACCENT,
                        }}
                    />
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.7)',
                        }}
                    >
                        JournoTrades
                    </Typography>
                </Stack>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.78rem',
                        color: 'rgba(255,255,255,0.4)',
                    }}
                >
                    © {new Date().getFullYear()} · Built for traders who take it seriously.
                </Typography>
            </Stack>
        </Container>
    </Box>
);

/* ─────────────────────────────────────────────
   Public component
   ──────────────────────────────────────────── */

const LandingFeatureRows: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    return (
        <Box sx={{ bgcolor: '#080808' }}>
            <ShareStrip />
            <FinalCTA onGetStarted={onGetStarted} />
            <Colophon />
        </Box>
    );
};

export default LandingFeatureRows;
