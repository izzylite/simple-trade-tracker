import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, ACCENT_SOFT, HAIR, RULE, TNUM, WIN } from 'components/landing/landingTokens';
import { useReveal, revealSx, useCounter } from 'components/landing/landingHooks';
import SectionMarker from 'components/landing/sections/SectionMarker';

/* ─────────────────────────────────────────────
   Performance — narrative + equity curve + stats
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

const EquityCard: React.FC = () => {
    const W = 400;
    const H = 200;
    const PAD_T = 14;
    const PAD_B = 18;
    const innerW = W;
    const innerH = H - PAD_T - PAD_B;

    // Compute headroom from data so adding/removing weeks doesn't dead-margin the top.
    const maxEquity = Math.max(...EQUITY_DATA.map((d) => d.equity)) * 1.06;
    const xFor = (i: number) => (i / (EQUITY_DATA.length - 1)) * innerW;
    const yFor = (eq: number) => PAD_T + innerH - (eq / maxEquity) * innerH;

    const linePath = EQUITY_DATA
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(d.equity).toFixed(2)}`)
        .join(' ');
    const areaPath =
        `${linePath} L ${xFor(EQUITY_DATA.length - 1).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} ` +
        `L ${xFor(0).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} Z`;

    // Stroke-dash animation: measure path length once mounted
    const lineRef = useRef<SVGPathElement | null>(null);
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.25 });
    const [pathLen, setPathLen] = useState<number>(1200);
    useEffect(() => {
        if (lineRef.current) {
            const len = lineRef.current.getTotalLength();
            if (len && Number.isFinite(len)) setPathLen(len);
        }
    }, []);

    return (
        <Box
            ref={reveal.ref}
            sx={{
                ...revealSx(reveal.inView, 160),
            }}
        >
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={2} alignItems="baseline">
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.5)',
                        }}
                    >
                        ES · Strategy 1A
                    </Typography>
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
                        Last 90 days · sample
                    </Typography>
                </Stack>
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontFeatureSettings: TNUM,
                        fontWeight: 700,
                        color: WIN,
                        fontSize: { xs: '1rem', md: '1.15rem' },
                        letterSpacing: '-0.015em',
                    }}
                >
                    ↑ +$48,214
                </Typography>
            </Stack>

            <Box
                component="svg"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Sample equity curve rising over 18 weeks"
                sx={{ width: '100%', height: { xs: 200, md: 260 }, display: 'block' }}
            >
                <defs>
                    <linearGradient id="eqgrad-perf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[50, 100, 150].map((y) => (
                    <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2={W}
                        y2={y}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="2 4"
                    />
                ))}
                <path
                    d={areaPath}
                    fill="url(#eqgrad-perf)"
                    style={{
                        opacity: reveal.inView ? 1 : 0,
                        transition: 'opacity 800ms 1000ms',
                    }}
                />
                <path
                    ref={lineRef}
                    d={linePath}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                        strokeDasharray: pathLen,
                        strokeDashoffset: reveal.inView ? 0 : pathLen,
                        transition: 'stroke-dashoffset 1800ms cubic-bezier(.5,0,.2,1)',
                        filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.45))',
                    }}
                />
                <circle
                    cx={xFor(EQUITY_DATA.length - 1)}
                    cy={yFor(EQUITY_DATA[EQUITY_DATA.length - 1].equity)}
                    r="4"
                    fill={ACCENT_SOFT}
                    style={{
                        opacity: reveal.inView ? 1 : 0,
                        transition: 'opacity 240ms 1700ms',
                    }}
                />
            </Box>
        </Box>
    );
};

interface StatProps {
    label: string;
    valueNode: React.ReactNode;
    color?: string;
}

const Stat: React.FC<StatProps> = ({ label, valueNode, color }) => (
    <Box>
        <Typography
            sx={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontFeatureSettings: TNUM,
                fontSize: '0.65rem',
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                mb: 0.75,
            }}
        >
            {label}
        </Typography>
        <Typography
            sx={{
                fontFamily: "'DM Sans', sans-serif",
                fontFeatureSettings: TNUM,
                fontWeight: 700,
                fontSize: { xs: '1.25rem', md: '1.4rem' },
                color: color ?? '#f1f5f9',
                letterSpacing: '-0.02em',
            }}
        >
            {valueNode}
        </Typography>
    </Box>
);

const PerformanceSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();
    const stats = useReveal<HTMLDivElement>();
    // Counter values driven by the stats row entering viewport
    const ytd = useCounter({ to: 48214, decimals: 0, enabled: stats.inView });
    const winRate = useCounter({ to: 62.4, decimals: 1, enabled: stats.inView });
    const profitFactor = useCounter({ to: 2.18, decimals: 2, enabled: stats.inView });

    const ytdNode = useMemo(() => <>↑ +${ytd}</>, [ytd]);
    const winRateNode = useMemo(() => <>{winRate}%</>, [winRate]);
    const pfNode = useMemo(() => <>{profitFactor}</>, [profitFactor]);

    return (
        <Box
            id="performance"
            sx={{
                py: { xs: 10, md: 14 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Performance" />
            <Container maxWidth={false} sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}>
                {/* Asymmetric copy block — eyebrow & head left, body right.
                    Breaks the alternating-two-column pattern of the surrounding sections. */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
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
                            Performance
                        </Typography>
                        <Typography
                            ref={head.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 800,
                                fontSize: { xs: '1.8rem', md: '2.6rem', lg: '3.1rem', xl: '3.5rem' },
                                color: '#f1f5f9',
                                letterSpacing: '-0.03em',
                                lineHeight: 1.08,
                                ...revealSx(head.inView, 80),
                            }}
                        >
                            Your edge, by tag combo, session, and day &mdash; with the
                            trends called out.
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
                        Equity curve, win-loss split, and risk-reward over time, sliced
                        by tag combo, session, and day of week. Tag combos that are
                        improving and ones starting to slip get flagged automatically,
                        alongside the economic events that printed when you lost.
                    </Typography>
                </Box>

                {/* Wide stats rule — full-width, ruled top and bottom. Editorial register.
                    Vertical rules between stats use a theme-callback so the breakpoint
                    selector actually parses (a `md:` key inside an `&` selector is silently
                    dropped by MUI sx). */}
                <Box
                    ref={stats.ref}
                    sx={(theme) => ({
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: { xs: 2, md: 0 },
                        py: { xs: 3, md: 4 },
                        borderTop: RULE,
                        borderBottom: RULE,
                        [theme.breakpoints.up('md')]: {
                            '& > *:not(:last-child)': {
                                borderRight: HAIR,
                                pr: 4,
                            },
                            '& > *:not(:first-of-type)': {
                                pl: 4,
                            },
                        },
                        ...revealSx(stats.inView, 240),
                    })}
                >
                    <Stat label="YTD P&L" valueNode={ytdNode} color={WIN} />
                    <Stat label="Win rate" valueNode={winRateNode} />
                    <Stat label="Profit factor" valueNode={pfNode} />
                </Box>

                {/* Equity curve — wide band underneath the stats rule, no card chrome */}
                <Box sx={{ mt: { xs: 5, md: 7 } }}>
                    <EquityCard />
                </Box>
            </Container>
        </Box>
    );
};

export default PerformanceSection;
