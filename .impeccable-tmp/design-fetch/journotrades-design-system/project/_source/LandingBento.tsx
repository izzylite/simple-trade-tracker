import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';

const ACCENT = '#7c3aed';
const RULE = '1px solid rgba(255,255,255,0.14)';
const HAIR = '1px solid rgba(255,255,255,0.08)';
const TNUM = "'tnum' on, 'lnum' on";

interface DayCellProps {
    day: string;
    pnl: number;
    trades: number;
}

const DayCell: React.FC<DayCellProps> = ({ day, pnl, trades }) => {
    const isWin = pnl >= 0;
    const sign = isWin ? '+' : '−';
    return (
        <Box sx={{ flex: 1, minWidth: 92, py: 1.5, textAlign: 'left' }}>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    mb: 1,
                }}
            >
                {day}
            </Typography>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontFeatureSettings: TNUM,
                    fontWeight: 700,
                    fontSize: { xs: '1rem', md: '1.15rem' },
                    color: isWin ? '#22c55e' : '#ef4444',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                }}
            >
                {sign}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontFeatureSettings: TNUM,
                    fontSize: '0.72rem',
                    color: 'rgba(255,255,255,0.45)',
                    mt: 0.5,
                }}
            >
                {trades} trade{trades === 1 ? '' : 's'}
            </Typography>
        </Box>
    );
};

const SampleWeek: React.FC = () => {
    const week = [
        { day: 'Mon', pnl: 1247.50, trades: 3 },
        { day: 'Tue', pnl: -540.20, trades: 5 },
        { day: 'Wed', pnl: 2180.40, trades: 2 },
        { day: 'Thu', pnl: 3460.10, trades: 4 },
        { day: 'Fri', pnl: 890.75, trades: 3 },
    ];
    const trades = week.reduce((acc, d) => acc + d.trades, 0);
    const wins = 12;
    const losses = trades - wins;
    const winRate = ((wins / trades) * 100).toFixed(1);

    return (
        <Box sx={{ pb: { xs: 8, md: 12 } }}>
            <Container maxWidth="md">
                {/* Section eyebrow */}
                <Stack
                    direction="row"
                    alignItems="baseline"
                    justifyContent="space-between"
                    sx={{ mb: 1.5 }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: ACCENT,
                        }}
                    >
                        Sample week · Wk 18
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontFeatureSettings: TNUM,
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            color: '#22c55e',
                            letterSpacing: '-0.015em',
                        }}
                    >
                        +$7,238.55
                    </Typography>
                </Stack>

                {/* Top rule */}
                <Box sx={{ borderTop: RULE, mb: 0 }} />

                {/* Day cells row — separated by thin verticals */}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    divider={
                        <Box
                            sx={{
                                width: { xs: '100%', sm: '1px' },
                                height: { xs: '1px', sm: 'auto' },
                                bgcolor: 'rgba(255,255,255,0.08)',
                            }}
                        />
                    }
                    sx={{ borderBottom: HAIR }}
                >
                    {week.map((d) => (
                        <DayCell key={d.day} {...d} />
                    ))}
                </Stack>

                {/* Footer summary row */}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={{ xs: 1, sm: 4 }}
                    sx={{ pt: 2 }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        {trades} trades · {wins} wins · {losses} losses
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        Edge · {winRate}% win rate · 1.84 R/R
                    </Typography>
                </Stack>

                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.78rem',
                        color: 'rgba(255,255,255,0.35)',
                        mt: 3,
                    }}
                >
                    Figures are illustrative. Your calendar shows your numbers, not these.
                </Typography>
            </Container>
        </Box>
    );
};

interface MethodEntryProps {
    section: string;
    title: string;
    body: string;
}

const MethodEntry: React.FC<MethodEntryProps> = ({ section, title, body }) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '120px 1fr' },
            gap: { xs: 1.5, md: 5 },
            py: { xs: 4, md: 5 },
            borderTop: HAIR,
        }}
    >
        <Box>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    color: ACCENT,
                    letterSpacing: '0.18em',
                    lineHeight: 1,
                    textTransform: 'uppercase',
                }}
            >
                {section}
            </Typography>
        </Box>
        <Box>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: { xs: '1.15rem', md: '1.35rem' },
                    color: '#f1f5f9',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.3,
                    mb: 1.25,
                }}
            >
                {title}
            </Typography>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.95rem',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.75,
                    maxWidth: 580,
                }}
            >
                {body}
            </Typography>
        </Box>
    </Box>
);

const Methodology: React.FC = () => (
    <Box id="features" sx={{ pb: { xs: 4, md: 6 } }}>
        <Container maxWidth="md">
            <Box sx={{ mb: { xs: 2, md: 3 } }}>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ACCENT,
                        mb: 1.5,
                    }}
                >
                    Methodology
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: { xs: '1.7rem', md: '2.1rem' },
                        color: '#f1f5f9',
                        letterSpacing: '-0.025em',
                        lineHeight: 1.18,
                        maxWidth: 620,
                    }}
                >
                    Four parts of the workspace.
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                        fontSize: { xs: '1.1rem', md: '1.25rem' },
                        color: 'rgba(255,255,255,0.55)',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.4,
                        maxWidth: 620,
                        mt: 1,
                    }}
                >
                    No card grid. No tabs. Just the work.
                </Typography>
            </Box>

            <Box>
                <MethodEntry
                    section="Calendar"
                    title="The calendar is home."
                    body="Each calendar represents one strategy, one eval account, or one funded firm. Open the calendar, log a trade into the day, and the month's grid colors itself by P&L. The active calendar is the page you keep open; everything else supports it."
                />
                <MethodEntry
                    section="Performance"
                    title="Performance is read, not advertised."
                    body="Equity curve, tag analysis, session distribution, score tracking. The same numbers your broker gives you, organised by the dimensions that actually move your edge: setup, session, mistake, emotion. No vanity metrics."
                />
                <MethodEntry
                    section="Assistant"
                    title="The assistant reads your history."
                    body="Ask the in-app assistant about a tag, a week, a particular session. It answers from your trades, with citations. No pattern recognition theatre — just your own data, summarised the way you would summarise it if you had time."
                />
                <MethodEntry
                    section="Notes"
                    title="Notes live alongside the trades."
                    body="A rich-text journal that the calendar can link into. Daily plans, post-session reviews, screenshots filed against the relevant day. The journal is part of the trade, not a separate document."
                />
                <Box sx={{ borderBottom: HAIR }} />
            </Box>
        </Container>
    </Box>
);

const LandingBento: React.FC = () => {
    return (
        <Box sx={{ bgcolor: '#080808' }}>
            <SampleWeek />
            <Methodology />
        </Box>
    );
};

export default LandingBento;
