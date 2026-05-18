import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, HAIR, PAPER, TNUM } from 'components/landing/landingTokens';
import { useReveal, revealSx } from 'components/landing/landingHooks';
import SectionMarker from 'components/landing/sections/SectionMarker';

/* ─────────────────────────────────────────────
   Orion · Briefings + Reminders
   Maps to two real surfaces:
     1. Orion Tasks — 4 fixed recurring digests (market_research,
        daily_analysis, weekly_review, monthly_rollup). User-created
        in CreateTaskDialog; results land as TaskResultCards in the
        inbox with type chip, significance dot, HTML body, citations,
        and tool-usage chips.
     2. Reminders — one-shot future Orion turns set from chat via the
        `set_reminder` tool. Fire back into the same conversation as
        an assistant message and into the notifications bell.
   Demo on the LEFT to break the right-demo cadence above. */

interface ToolChip {
    label: string;
}

const TASK_TOOLS: ToolChip[] = [
    { label: 'search_web' },
    { label: 'scrape_url' },
    { label: 'get_market_data' },
    { label: 'execute_sql' },
    { label: 'economic_events' },
    { label: 'notes' },
];

const TaskBriefingCard: React.FC = () => {
    return (
        <Box
            sx={{
                bgcolor: PAPER,
                border: HAIR,
                borderRadius: '16px',
                overflow: 'hidden',
            }}
        >
            {/* Header — matches TaskResultCard: type chip + significance dot + run-time + read state */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 2.25, py: 1.75, borderBottom: HAIR }}
            >
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.65rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: ACCENT,
                        bgcolor: 'rgba(124,58,237,0.16)',
                        border: '1px solid rgba(124,58,237,0.32)',
                        borderRadius: '999px',
                        px: 1.25,
                        py: 0.4,
                    }}
                >
                    Market Research
                </Typography>
                <Box
                    aria-label="medium significance"
                    sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: '#f59e0b',
                    }}
                />
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.7rem',
                        color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    {new Date().toLocaleDateString('en-US', { weekday: 'short' })} · 06:00 ET
                </Typography>
                <Typography
                    sx={{
                        ml: 'auto !important',
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.65rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                    }}
                >
                    Unread
                </Typography>
            </Stack>

            {/* Body — HTML-ish content reflecting what an actual Market Research run produces */}
            <Box sx={{ px: 2.5, py: 2.5 }}>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: '#f1f5f9',
                        letterSpacing: '-0.01em',
                        mb: 1.25,
                    }}
                >
                    Risk-off into FOMC. ES gapped down, gold testing 2,440.
                </Typography>
                <Stack spacing={1}>
                    {[
                        { sym: 'ES', detail: '−0.5% overnight, opening below yesterday’s low' },
                        { sym: 'DXY', detail: '+0.4%, breakout above the week’s range' },
                        { sym: 'GC', detail: 'Testing 2,440 resistance, third tag this week' },
                        { sym: 'EUR/USD', detail: 'Pinned near 1.0820, ECB minutes 07:30' },
                    ].map((r) => (
                        <Stack
                            key={r.sym}
                            direction="row"
                            spacing={1.5}
                            alignItems="baseline"
                        >
                            <Typography
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontFeatureSettings: TNUM,
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    color: ACCENT,
                                    minWidth: 60,
                                }}
                            >
                                {r.sym}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '0.88rem',
                                    color: 'rgba(255,255,255,0.7)',
                                    lineHeight: 1.55,
                                }}
                            >
                                {r.detail}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
                <Typography
                    sx={{
                        mt: 2,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.88rem',
                        color: 'rgba(255,255,255,0.6)',
                        lineHeight: 1.65,
                    }}
                >
                    Powell speaks 14:00. Two of your last four FOMC days ended red,
                    both stopped out before the press conference.
                </Typography>
            </Box>

            {/* Citations + tool chips — match TaskResultCard footer pattern */}
            <Box sx={{ px: 2.5, pb: 2, pt: 0.5 }}>
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.66rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                        mb: 1,
                    }}
                >
                    Sources · 3
                </Typography>
                <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: 'wrap', mb: 1.5, rowGap: 0.75 }}
                >
                    {['reuters.com', 'cme.com', 'investing.com'].map((s) => (
                        <Box
                            key={s}
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                color: 'rgba(255,255,255,0.55)',
                                bgcolor: 'rgba(255,255,255,0.04)',
                                border: HAIR,
                                borderRadius: '4px',
                                px: 0.75,
                                py: 0.25,
                            }}
                        >
                            {s}
                        </Box>
                    ))}
                </Stack>
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
                >
                    {TASK_TOOLS.map((t) => (
                        <Box
                            key={t.label}
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.66rem',
                                color: ACCENT,
                                bgcolor: 'rgba(124,58,237,0.1)',
                                border: '1px solid rgba(124,58,237,0.22)',
                                borderRadius: '4px',
                                px: 0.6,
                                py: 0.2,
                            }}
                        >
                            {t.label}
                        </Box>
                    ))}
                </Stack>
            </Box>
        </Box>
    );
};

const ReminderFlowCard: React.FC = () => {
    return (
        <Box
            sx={{
                bgcolor: PAPER,
                border: HAIR,
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
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
                    ✦
                </Box>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: '#f1f5f9',
                    }}
                >
                    Orion
                </Typography>
                <Typography
                    sx={{
                        ml: 'auto !important',
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.65rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.5)',
                        px: 1.25,
                        py: 0.5,
                        borderRadius: '999px',
                        border: HAIR,
                    }}
                >
                    ES · Strategy 1A
                </Typography>
            </Stack>

            {/* Chat exchange — set_reminder tool call inline */}
            <Box sx={{ px: 2.25, py: 2.25 }}>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: HAIR,
                        color: '#f1f5f9',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.92rem',
                        lineHeight: 1.55,
                        maxWidth: '86%',
                        ml: 'auto',
                    }}
                >
                    Ping me 30 min before FOMC tomorrow. Tell me to flatten ES if
                    I&rsquo;m not green.
                </Box>

                <Box
                    sx={{
                        mt: 1.5,
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: 'rgba(124,58,237,0.16)',
                        border: '1px solid rgba(124,58,237,0.32)',
                        color: '#ede9fe',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.92rem',
                        lineHeight: 1.55,
                        maxWidth: '92%',
                    }}
                >
                    Set. I&rsquo;ll come back into this thread Wed at 13:30 ET with
                    your day&rsquo;s P&amp;L and the flatten call.
                    <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mt: 1, alignItems: 'center' }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.66rem',
                                color: 'rgba(237,233,254,0.6)',
                                bgcolor: 'rgba(237,233,254,0.08)',
                                border: '1px solid rgba(237,233,254,0.16)',
                                borderRadius: '4px',
                                px: 0.6,
                                py: 0.2,
                            }}
                        >
                            set_reminder
                        </Typography>
                    </Stack>
                </Box>
            </Box>

            {/* Reminders panel preview — matches RemindersPanel pattern: alarm + description + relative time + cancel */}
            <Box
                sx={{
                    mt: 'auto',
                    px: 2.25,
                    py: 1.5,
                    borderTop: HAIR,
                    bgcolor: 'rgba(255,255,255,0.02)',
                }}
            >
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.66rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                        mb: 1,
                    }}
                >
                    Upcoming · 1
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box
                        sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '6px',
                            bgcolor: 'rgba(124,58,237,0.16)',
                            color: ACCENT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                        }}
                        aria-hidden
                    >
                        ⏰
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: '#f1f5f9',
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Flatten ES before FOMC
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                color: 'rgba(255,255,255,0.45)',
                            }}
                        >
                            in 21h · Wed 13:30 ET
                        </Typography>
                    </Box>
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            '&:hover': { color: 'rgba(255,255,255,0.7)' },
                        }}
                    >
                        cancel
                    </Typography>
                </Stack>
            </Box>
        </Box>
    );
};

const BriefingsRemindersDemo: React.FC = () => {
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.25 });
    return (
        <Box
            ref={reveal.ref}
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' },
                gap: { xs: 2, md: 2.5 },
                ...revealSx(reveal.inView, 160),
            }}
        >
            <TaskBriefingCard />
            <ReminderFlowCard />
        </Box>
    );
};

const BriefingsRemindersSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();
    return (
        <Box sx={{ py: { xs: 10, md: 14 }, borderTop: HAIR, position: 'relative' }}>
            <SectionMarker label="Briefings & Reminders" />
            <Container
                maxWidth={false}
                sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: { xs: 3, md: 8 },
                        mb: { xs: 5, md: 7 },
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
                            Orion · briefings &amp; reminders
                        </Typography>
                        <Typography
                            ref={head.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 800,
                                fontSize: { xs: '1.8rem', md: '2.4rem', lg: '2.85rem', xl: '3.2rem' },
                                color: '#f1f5f9',
                                letterSpacing: '-0.03em',
                                lineHeight: 1.08,
                                ...revealSx(head.inView, 80),
                            }}
                        >
                            Set it once. Hear back when it counts.
                        </Typography>
                    </Box>
                    <Typography
                        ref={body.ref}
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: { xs: '0.95rem', md: '1rem' },
                            color: 'rgba(255,255,255,0.65)',
                            lineHeight: 1.75,
                            alignSelf: 'end',
                            ...revealSx(body.inView, 160),
                        }}
                    >
                        Schedule a market research run before the open. A daily analysis of
                        yesterday&rsquo;s tape. A weekly review on Sunday in the tone you
                        choose. Each one lands in the inbox with sources and the tools it
                        used. Tell Orion in chat to ping you 30 min before FOMC, and the
                        message comes back into the same thread when the time hits.
                    </Typography>
                </Box>

                <BriefingsRemindersDemo />
            </Container>
        </Box>
    );
};

export default BriefingsRemindersSection;
