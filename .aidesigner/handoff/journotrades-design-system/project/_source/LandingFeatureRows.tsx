import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';

const ACCENT = '#7c3aed';
const ACCENT_SOFT = '#a78bfa';
const RULE = '1px solid rgba(255,255,255,0.14)';
const HAIR = '1px solid rgba(255,255,255,0.08)';
const TNUM = "'tnum' on, 'lnum' on";

/* ─────────────────────────────────────────────
   Equity curve (inline SVG)
   ──────────────────────────────────────────── */

const EQUITY_DATA: { week: number; equity: number }[] = [
    { week: 0, equity: 0 },
    { week: 1, equity: 850 },
    { week: 2, equity: 1840 },
    { week: 3, equity: 3120 },
    { week: 4, equity: 2410 },
    { week: 5, equity: 1850 },
    { week: 6, equity: 2920 },
    { week: 7, equity: 4180 },
    { week: 8, equity: 6210 },
    { week: 9, equity: 7530 },
    { week: 10, equity: 9540 },
    { week: 11, equity: 8910 },
    { week: 12, equity: 11240 },
    { week: 13, equity: 14150 },
    { week: 14, equity: 18620 },
    { week: 15, equity: 22800 },
    { week: 16, equity: 28140 },
    { week: 17, equity: 34920 },
    { week: 18, equity: 42180 },
];

const EquityCurve: React.FC = () => {
    const W = 1200;
    const H = 480;
    const PAD_L = 80;
    const PAD_R = 24;
    const PAD_T = 32;
    const PAD_B = 56;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    const maxEquity = 48000;
    const xFor = (i: number) =>
        PAD_L + (i / (EQUITY_DATA.length - 1)) * innerW;
    const yFor = (eq: number) => PAD_T + innerH - (eq / maxEquity) * innerH;

    const linePath = EQUITY_DATA
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(d.equity).toFixed(2)}`)
        .join(' ');

    const areaPath =
        `${linePath} L ${xFor(EQUITY_DATA.length - 1).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} ` +
        `L ${xFor(0).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} Z`;

    const yTicks = [0, 12000, 24000, 36000, 48000];

    return (
        <Box sx={{ py: { xs: 10, md: 16 }, borderTop: RULE, borderBottom: RULE, position: 'relative' }}>
            <Container maxWidth="md">
                <Stack
                    direction="row"
                    alignItems="baseline"
                    justifyContent="space-between"
                    sx={{ mb: 3, flexWrap: 'wrap', rowGap: 0.5 }}
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
                        Equity curve · 18 weeks
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.78rem',
                            color: 'rgba(255,255,255,0.45)',
                        }}
                    >
                        Sample data. Plot generated from a sample calendar.
                    </Typography>
                </Stack>

                <Box
                    component="svg"
                    viewBox={`0 0 ${W} ${H}`}
                    role="img"
                    aria-label="Sample equity curve over 18 weeks rising from $0 to $42,180.00"
                    sx={{ width: '100%', height: 'auto', display: 'block' }}
                >
                    <defs>
                        <linearGradient id="ecArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
                            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Y gridlines + labels */}
                    {yTicks.map((t) => (
                        <g key={t}>
                            <line
                                x1={PAD_L}
                                x2={W - PAD_R}
                                y1={yFor(t)}
                                y2={yFor(t)}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="1"
                            />
                            <text
                                x={PAD_L - 12}
                                y={yFor(t) + 4}
                                fill="rgba(255,255,255,0.4)"
                                fontFamily="DM Sans, sans-serif"
                                fontSize="13"
                                fontWeight="600"
                                textAnchor="end"
                                style={{ fontFeatureSettings: TNUM }}
                            >
                                ${t.toLocaleString()}
                            </text>
                        </g>
                    ))}

                    {/* Baseline */}
                    <line
                        x1={PAD_L}
                        x2={W - PAD_R}
                        y1={PAD_T + innerH}
                        y2={PAD_T + innerH}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="1"
                    />

                    {/* Filled area beneath line */}
                    <path d={areaPath} fill="url(#ecArea)" />

                    {/* Line itself */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {/* Endpoint dot */}
                    <circle
                        cx={xFor(EQUITY_DATA.length - 1)}
                        cy={yFor(EQUITY_DATA[EQUITY_DATA.length - 1].equity)}
                        r="5"
                        fill={ACCENT_SOFT}
                    />

                    {/* X axis labels — sparse */}
                    {[0, 4, 8, 12, 18].map((i) => (
                        <text
                            key={i}
                            x={xFor(i)}
                            y={PAD_T + innerH + 24}
                            fill="rgba(255,255,255,0.45)"
                            fontFamily="DM Sans, sans-serif"
                            fontSize="13"
                            fontWeight="600"
                            textAnchor="middle"
                        >
                            wk {i}
                        </text>
                    ))}
                </Box>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={{ xs: 1, sm: 4 }}
                    sx={{ pt: 2, mt: 2, borderTop: HAIR }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        Start · $0 · Final · +$42,180.00
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        Max DD · -$1,270 · Sharpe · 1.71
                    </Typography>
                </Stack>
            </Container>
        </Box>
    );
};

/* ─────────────────────────────────────────────
   Built for prop traders
   ──────────────────────────────────────────── */

interface ProofItemProps {
    eyebrow: string;
    title: string;
    body: string;
}

const ProofItem: React.FC<ProofItemProps> = ({ eyebrow, title, body }) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '180px 1fr' },
            gap: { xs: 1.5, md: 5 },
            py: { xs: 4, md: 5 },
            borderTop: HAIR,
        }}
    >
        <Box>
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
                {eyebrow}
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

const ProofSection: React.FC = () => (
    <Box sx={{ pt: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
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
                How it fits prop firms
            </Typography>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 800,
                    fontSize: { xs: '1.7rem', md: '2.1rem' },
                    color: '#f1f5f9',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.18,
                    maxWidth: 660,
                }}
            >
                The way you actually work.
            </Typography>
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.4,
                    maxWidth: 660,
                    mt: 1,
                    mb: 4,
                }}
            >
                Not the way a generic journal forces you to.
            </Typography>

            <Box>
                <ProofItem
                    eyebrow="Calendars · strategies"
                    title="One calendar per eval account or system."
                    body="Track FTMO, MyForexFunds, and personal capital side by side. Each calendar keeps its own balance, risk rules, and tag set so the math never crosses streams."
                />
                <ProofItem
                    eyebrow="Imports · MT4 · MT5 · cTrader"
                    title="Bring the history you already shot."
                    body="Pull existing fills via CSV. Re-tag once, then leave the typing behind. Your evaluation history isn't trapped in your broker's UI."
                />
                <ProofItem
                    eyebrow="Tags · the heavy lifting"
                    title="Setup, session, mistake, emotion."
                    body="Filter performance by any combination of tags. Find out the Tuesday-afternoon FOMO trade is the one bleeding the account. Then stop placing it."
                />
                <Box sx={{ borderBottom: HAIR }} />
            </Box>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                    component={RouterLink}
                    to="/about"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    sx={{
                        color: ACCENT,
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        letterSpacing: '0.01em',
                        '&:hover': { bgcolor: 'rgba(124,58,237,0.08)' },
                    }}
                >
                    Read the methodology
                </Button>
            </Stack>
        </Container>
    </Box>
);

/* ─────────────────────────────────────────────
   Single mid-page CTA
   ──────────────────────────────────────────── */

const FinalCTA: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => (
    <Box sx={{ pt: { xs: 10, md: 14 }, pb: { xs: 10, md: 14 }, mt: { xs: 8, md: 12 }, borderTop: RULE }}>
        <Container maxWidth="sm">
            <Box sx={{ textAlign: 'center' }}>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: ACCENT,
                        mb: 2,
                    }}
                >
                    Get started
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: { xs: '2rem', md: '2.75rem' },
                        color: '#f1f5f9',
                        letterSpacing: '-0.035em',
                        lineHeight: 1.12,
                        mb: 1.5,
                    }}
                >
                    Ten seconds to sign in.
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                        fontSize: { xs: '1.25rem', md: '1.5rem' },
                        color: 'rgba(255,255,255,0.55)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.3,
                        mb: 2.5,
                    }}
                >
                    Then start logging.
                </Typography>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: '0.95rem',
                        mb: 4,
                        lineHeight: 1.7,
                    }}
                >
                    Free to start. One calendar to begin, more when you need them.
                </Typography>
                <Button
                    onClick={onGetStarted}
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                        bgcolor: ACCENT,
                        color: '#f1f5f9',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        px: 3.5,
                        py: 1.4,
                        borderRadius: '8px',
                        boxShadow: 'none',
                        textTransform: 'none',
                        letterSpacing: '-0.005em',
                        '&:hover': {
                            bgcolor: '#6d28d9',
                            boxShadow: 'none',
                        },
                        transition: 'background 0.15s ease',
                    }}
                >
                    Start your logbook
                </Button>
            </Box>
        </Container>
    </Box>
);

/* ─────────────────────────────────────────────
   Colophon footer
   ──────────────────────────────────────────── */

const Colophon: React.FC = () => (
    <Box sx={{ borderTop: HAIR, py: 5 }}>
        <Container maxWidth="md">
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'baseline' }}
                justifyContent="space-between"
                spacing={2}
            >
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

const LandingFeatureRows: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    return (
        <Box sx={{ bgcolor: '#080808' }}>
            <ProofSection />
            <EquityCurve />
            <FinalCTA onGetStarted={onGetStarted} />
            <Colophon />
        </Box>
    );
};

export default LandingFeatureRows;
