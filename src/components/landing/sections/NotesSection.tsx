import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, HAIR, RULE, TNUM, WIN } from 'components/landing/landingTokens';
import { useReveal, revealSx } from 'components/landing/landingHooks';
import SectionMarker from 'components/landing/sections/SectionMarker';

/* Notes — typographic spread, no demo card.
   The journal voice IS the demo: pulled-quote bias line + numbered hunting list
   + a one-line linked-fill trace. Earns its space through prose, not chrome. */
const NotesSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const lede = useReveal<HTMLDivElement>();
    const noteTitle = useReveal<HTMLDivElement>();
    const quote = useReveal<HTMLDivElement>();
    const list = useReveal<HTMLDivElement>();
    const trace = useReveal<HTMLDivElement>();
    return (
        <Box
            id="notes"
            sx={{
                py: { xs: 8, md: 11 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Notes" />
            <Container
                maxWidth={false}
                sx={{ maxWidth: { xs: 720, md: 880, lg: 960 }, px: { xs: 3, md: 4, xl: 6 } }}
            >
                <Stack
                    direction="row"
                    spacing={3}
                    alignItems="baseline"
                    sx={{ mb: 1.5 }}
                >
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
                            ...revealSx(eyebrow.inView),
                        }}
                    >
                        Notes
                    </Typography>
                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.35)',
                        }}
                    >
                        186 entries · last 30 days
                    </Typography>
                </Stack>

                <Typography
                    ref={head.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: { xs: '1.9rem', md: '2.6rem', lg: '3.1rem' },
                        color: '#f1f5f9',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                        mb: 4,
                        ...revealSx(head.inView, 80),
                    }}
                >
                    Tomorrow&rsquo;s plan, beside today&rsquo;s tape.
                </Typography>

                <Typography
                    ref={lede.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: { xs: '1rem', md: '1.1rem' },
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.75,
                        maxWidth: 620,
                        mb: 5,
                        ...revealSx(lede.inView, 160),
                    }}
                >
                    Pre-market bias, the setups you&rsquo;re hunting, the events you&rsquo;re
                    sitting out. Post-session, the trades that hit and the ones that broke
                    your rule. Tag any line, link any fill. The calendar reads back what you
                    wrote on Monday next time Monday rolls around.
                </Typography>

                {/* Note title block — signals "this is a real journal entry,"
                    not a section subhead. Date/time stamp, title, and tag chips
                    match the shape of an actual JournoTrades note. */}
                <Box
                    ref={noteTitle.ref}
                    sx={{
                        borderTop: RULE,
                        pt: { xs: 4, md: 5 },
                        mt: 5,
                        ...revealSx(noteTitle.inView, 200),
                    }}
                >
                    <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="baseline"
                        sx={{ mb: 1.25, flexWrap: 'wrap' }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                                color: ACCENT,
                            }}
                        >
                            Mon 06 May · 08:14 ET
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.68rem',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.4)',
                            }}
                        >
                            Note #218 · saved 2 min ago
                        </Typography>
                    </Stack>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 700,
                            fontSize: { xs: '1.45rem', md: '1.85rem', lg: '2.05rem' },
                            color: '#f1f5f9',
                            letterSpacing: '-0.025em',
                            lineHeight: 1.15,
                            mb: 1.5,
                        }}
                    >
                        Pre-market plan: ES bullish above 5,820
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                        {['ES', 'bullish', 'FOMC', 'opening-drive', 'no-fade'].map((t) => (
                            <Typography
                                key={t}
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontFeatureSettings: TNUM,
                                    fontSize: '0.68rem',
                                    fontWeight: 500,
                                    color: 'rgba(255,255,255,0.55)',
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    border: HAIR,
                                    borderRadius: '4px',
                                    px: 0.7,
                                    py: 0.2,
                                }}
                            >
                                #{t}
                            </Typography>
                        ))}
                    </Stack>
                </Box>

                {/* Pulled quote — bias line as an editorial display. */}
                <Box
                    ref={quote.ref}
                    sx={{
                        borderTop: HAIR,
                        borderBottom: RULE,
                        py: { xs: 4, md: 5 },
                        mt: 4,
                        mb: 5,
                        ...revealSx(quote.inView, 240),
                    }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.4)',
                            mb: 2,
                        }}
                    >
                        Bias
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 600,
                            fontSize: { xs: '1.4rem', md: '1.85rem', lg: '2.1rem' },
                            color: '#f1f5f9',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.25,
                        }}
                    >
                        Holding a{' '}
                        <Box
                            component="span"
                            sx={{
                                bgcolor: 'rgba(124,58,237,0.18)',
                                color: '#ede9fe',
                                px: 0.75,
                                borderRadius: '3px',
                            }}
                        >
                            bullish bias above 5,820
                        </Box>
                        . Failure of yesterday&rsquo;s swing low invalidates. Wait for opening
                        drive. No scalps in the first five.
                    </Typography>
                </Box>

                {/* Setups list — numbered editorial, no card chrome. */}
                <Box ref={list.ref} sx={{ mb: 5, ...revealSx(list.inView, 320) }}>
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.4)',
                            mb: 2,
                        }}
                    >
                        Setups I&rsquo;m hunting
                    </Typography>
                    {[
                        'Opening-range breakout above 5,832 with retest',
                        'VWAP reclaim after first hour',
                        'No fade trades into FOMC at 10:00',
                    ].map((item, i) => (
                        <Stack
                            key={i}
                            direction="row"
                            spacing={2.5}
                            sx={{
                                py: 1.25,
                                borderTop: i === 0 ? 'none' : HAIR,
                                alignItems: 'baseline',
                            }}
                        >
                            <Typography
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontFeatureSettings: TNUM,
                                    fontSize: '0.78rem',
                                    fontWeight: 500,
                                    color: ACCENT,
                                    minWidth: 24,
                                }}
                            >
                                0{i + 1}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: { xs: '0.95rem', md: '1.05rem' },
                                    color: 'rgba(255,255,255,0.75)',
                                    lineHeight: 1.6,
                                }}
                            >
                                {item}
                            </Typography>
                        </Stack>
                    ))}
                </Box>

                {/* Inline trace — yesterday's takeaway with a linked fill. */}
                <Typography
                    ref={trace.ref}
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: { xs: '0.95rem', md: '1rem' },
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.75,
                        ...revealSx(trace.inView, 400),
                    }}
                >
                    Linked yesterday:{' '}
                    <Box
                        component="span"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: '4px',
                            bgcolor: 'rgba(34,197,94,0.12)',
                            color: WIN,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            verticalAlign: 'baseline',
                        }}
                    >
                        ↑ +$890
                    </Box>
                    . The C-grade entry after my A+ paid off but it was lucky. Don&rsquo;t size
                    up on those.
                </Typography>
            </Container>
        </Box>
    );
};

export default NotesSection;
