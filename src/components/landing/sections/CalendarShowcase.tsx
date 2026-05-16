import React, { useState, useEffect } from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, HAIR, PAPER, TNUM, WIN, LOSS } from '../landingTokens';
import { useReveal, revealSx, useReducedMotion } from '../landingHooks';
import SectionMarker from './SectionMarker';

/* ─────────────────────────────────────────────
   Calendar showcase — 3-month switcher
   ──────────────────────────────────────────── */

interface MonthData {
    name: string;
    leading: number;
    total: number;
    days: Record<number, number>;
    count: number;
}

const MONTHS: MonthData[] = [
    {
        name: 'March 2026',
        leading: 6,
        total: 5180.40,
        count: 31,
        days: {
            1: 320.5, 2: -180, 3: 540, 5: 1240.2, 9: -210, 10: 380, 11: 920,
            13: 1480.5, 16: -540, 17: 220, 18: 1820, 20: 740, 23: 920, 24: -320,
            26: 1140.2,
        },
    },
    {
        name: 'April 2026',
        leading: 2,
        total: -3217.40,
        count: 30,
        days: {
            1: -240, 2: 320, 6: -480, 7: -1240, 8: 320, 9: 540, 10: -380,
            13: 220, 14: -640, 15: -1280, 16: 380, 17: -540, 20: 920, 21: -320,
            22: -180, 23: 540, 24: 320, 27: 380, 28: -640, 29: -120, 30: 240,
        },
    },
    {
        name: 'May 2026',
        leading: 4,
        total: 12840.00,
        count: 31,
        days: {
            1: 1247.5, 4: -540.2, 5: 2180.4, 6: 340.7, 7: 3460.1, 8: 890.75,
            11: -1200, 12: 680, 13: 1100, 15: 2200, 18: 430, 19: -820, 20: 1980,
            21: -330, 22: 760, 25: 1450, 26: -210, 27: 520, 28: 980, 29: 1800,
        },
    },
];

const fmtCurrency = (n: number) =>
    '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCompact = (n: number) =>
    '$' + Math.round(Math.abs(n)).toLocaleString();

interface CellProps {
    day: number;
    pnl: number;
}

const Cell: React.FC<CellProps> = ({ day, pnl }) => {
    const isWin = pnl > 0;
    const isLoss = pnl < 0;
    const isFlat = pnl === 0;
    const isStrongWin = pnl > 1000;

    const bg = isStrongWin
        ? 'rgba(34,197,94,0.16)'
        : isWin
            ? 'rgba(34,197,94,0.07)'
            : isLoss
                ? 'rgba(239,68,68,0.07)'
                : 'rgba(255,255,255,0.025)';
    const border = isStrongWin
        ? 'rgba(34,197,94,0.32)'
        : isWin
            ? 'rgba(34,197,94,0.18)'
            : isLoss
                ? 'rgba(239,68,68,0.18)'
                : 'transparent';

    const sign = isWin ? '+' : isLoss ? '−' : '';
    const valueColor = isWin ? WIN : isLoss ? LOSS : 'rgba(255,255,255,0.45)';

    return (
        <Box
            sx={{
                aspectRatio: '1 / 1',
                borderRadius: '6px',
                bgcolor: bg,
                border: `1px solid ${border}`,
                px: 0.75,
                py: 0.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                overflow: 'hidden',
                transition: 'background 320ms ease, border-color 320ms ease',
            }}
        >
            <Typography
                sx={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontFeatureSettings: TNUM,
                    fontSize: '0.6rem',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1,
                }}
            >
                {day}
            </Typography>
            {!isFlat && (
                <Typography
                    sx={{
                        // Hide compact P&L on xs — cell width truncates "$1,240" to noise.
                        // Color tile + day number carry the meaning at small sizes.
                        display: { xs: 'none', sm: 'block' },
                        fontFamily: "'DM Sans', sans-serif",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: valueColor,
                        letterSpacing: '-0.01em',
                        mt: 'auto',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {sign}
                    {fmtCompact(pnl)}
                </Typography>
            )}
        </Box>
    );
};

const CalendarShowcase: React.FC = () => {
    const [monthIdx, setMonthIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const month = MONTHS[monthIdx];
    const isMonthWin = month.total >= 0;
    const reduceMotion = useReducedMotion();

    const eyebrowReveal = useReveal<HTMLDivElement>();
    const headlineReveal = useReveal<HTMLDivElement>();
    const frameReveal = useReveal<HTMLDivElement>();

    // Autoplay through months while in view, pause on hover/focus
    useEffect(() => {
        if (!frameReveal.inView || reduceMotion || paused) return;
        const id = setInterval(() => {
            setMonthIdx((i) => (i + 1) % MONTHS.length);
        }, 4500);
        return () => clearInterval(id);
    }, [frameReveal.inView, reduceMotion, paused]);

    return (
        <Box
            id="calendar"
            sx={{
                py: { xs: 12, md: 18 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Calendar" />
            <Container maxWidth={false} sx={{ maxWidth: { xs: 1080, lg: 1280, xl: 1440 }, px: { xs: 3, md: 4, xl: 6 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
                        gap: { xs: 4, md: 8 },
                        alignItems: 'center',
                        minHeight: { md: 520 },
                    }}
                >
                    {/* LEFT — eyebrow + title + description + switcher */}
                    <Box>
                        <Typography
                            ref={eyebrowReveal.ref}
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: ACCENT,
                                mb: 1,
                                ...revealSx(eyebrowReveal.inView),
                            }}
                        >
                            The shape of your month
                        </Typography>
                        <Typography
                            ref={headlineReveal.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 800,
                                fontSize: { xs: '1.8rem', md: '2.4rem', lg: '2.85rem', xl: '3.2rem' },
                                color: '#f1f5f9',
                                letterSpacing: '-0.025em',
                                lineHeight: 1.15,
                                mb: 2,
                                ...revealSx(headlineReveal.inView, 80),
                            }}
                        >
                            See the month, not the trade.
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.95rem',
                                color: 'rgba(255,255,255,0.6)',
                                lineHeight: 1.75,
                                maxWidth: 460,
                                mb: 3,
                            }}
                        >
                            One trade tells you nothing. A month tells you when you tilt,
                            where your losses cluster, which weeks you stop respecting your
                            own rules. Log fills with R, tags, and screenshots. The grid
                            paints by P&amp;L so the bad streak finds you before you find it.
                        </Typography>

                    </Box>

                    {/* RIGHT — calendar frame (compact, fixed-height 6-row grid) */}
                    <Box
                        ref={frameReveal.ref}
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                        onFocus={() => setPaused(true)}
                        onBlur={() => setPaused(false)}
                        sx={{
                            bgcolor: PAPER,
                            border: HAIR,
                            borderRadius: '16px',
                            p: { xs: 2, md: 2.5 },
                            ...revealSx(frameReveal.inView, 160),
                        }}
                    >
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="baseline"
                            sx={{ mb: 1.5 }}
                        >
                            <Typography
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontFeatureSettings: TNUM,
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    color: '#f1f5f9',
                                    letterSpacing: '-0.015em',
                                }}
                            >
                                {month.name}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontFeatureSettings: TNUM,
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    color: isMonthWin ? WIN : LOSS,
                                    letterSpacing: '-0.015em',
                                }}
                            >
                                {isMonthWin ? '↑ +' : '↓ −'}
                                {fmtCurrency(month.total)}
                            </Typography>
                        </Stack>

                        {/* Weekday header */}
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gap: 0.5,
                                mb: 0.5,
                            }}
                        >
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                <Typography
                                    key={i}
                                    sx={{
                                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                        fontFeatureSettings: TNUM,
                                        fontSize: '0.6rem',
                                        fontWeight: 500,
                                        letterSpacing: '0.14em',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.45)',
                                        textAlign: 'center',
                                        py: 0.25,
                                    }}
                                >
                                    {d}
                                </Typography>
                            ))}
                        </Box>

                        {/* Day cells — always 42 slots (6 rows × 7 cols) so height is fixed.
                            Keyed by monthIdx so each switch fades + scales the grid in cleanly. */}
                        <Box
                            key={monthIdx}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gridTemplateRows: 'repeat(6, 1fr)',
                                gap: 0.5,
                                animation: 'lpGridSwap 420ms cubic-bezier(.2,.7,.2,1)',
                                '@keyframes lpGridSwap': {
                                    '0%': {
                                        opacity: 0,
                                        transform: 'scale(0.985)',
                                        filter: 'blur(2px)',
                                    },
                                    '100%': {
                                        opacity: 1,
                                        transform: 'scale(1)',
                                        filter: 'blur(0)',
                                    },
                                },
                                '@media (prefers-reduced-motion: reduce)': {
                                    animation: 'none',
                                },
                            }}
                        >
                            {Array.from({ length: 42 }).map((_, slot) => {
                                const day = slot - month.leading + 1;
                                const inMonth = slot >= month.leading && day <= month.count;
                                if (!inMonth) {
                                    return (
                                        <Box
                                            key={`pad-${slot}`}
                                            sx={{
                                                aspectRatio: '1 / 1',
                                                borderRadius: '6px',
                                                bgcolor: 'rgba(255,255,255,0.025)',
                                                opacity: 0.2,
                                            }}
                                        />
                                    );
                                }
                                const pnl = month.days[day] ?? 0;
                                return <Cell key={day} day={day} pnl={pnl} />;
                            })}
                        </Box>

                        {/* Pip indicator: month switcher + autoplay-pause affordance.
                            Click jumps directly; hover already pauses (handled on the frame). */}
                        <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="center"
                            sx={{ mt: 2, pt: 1 }}
                            role="tablist"
                            aria-label="Sample months"
                        >
                            {MONTHS.map((m, i) => {
                                const active = i === monthIdx;
                                return (
                                    <Box
                                        key={m.name}
                                        component="button"
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        aria-label={m.name}
                                        onClick={() => setMonthIdx(i)}
                                        sx={{
                                            // Constant outer width so neighbouring pips
                                                // don't reflow on every tick. Two children crossfade
                                                // by opacity instead of animating layout width.
                                            width: 22,
                                            height: 6,
                                            border: 'none',
                                            cursor: 'pointer',
                                            p: 0,
                                            bgcolor: 'transparent',
                                            position: 'relative',
                                            display: 'block',
                                            '&:focus-visible': {
                                                outline: `2px solid ${ACCENT}`,
                                                outlineOffset: 4,
                                                borderRadius: '999px',
                                            },
                                            '&:hover .pip-dot': {
                                                bgcolor: 'rgba(255,255,255,0.32)',
                                            },
                                        }}
                                    >
                                        {/* Active bar — full width, fades in. */}
                                        <Box
                                            aria-hidden
                                            sx={{
                                                position: 'absolute',
                                                inset: 0,
                                                borderRadius: '999px',
                                                bgcolor: ACCENT,
                                                opacity: active ? 1 : 0,
                                                transition: 'opacity 240ms cubic-bezier(.2,.7,.2,1)',
                                            }}
                                        />
                                        {/* Inactive dot — 6px circle, fades out when active. */}
                                        <Box
                                            className="pip-dot"
                                            aria-hidden
                                            sx={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                bgcolor: 'rgba(255,255,255,0.18)',
                                                opacity: active ? 0 : 1,
                                                transition:
                                                    'opacity 240ms cubic-bezier(.2,.7,.2,1), background-color 150ms',
                                            }}
                                        />
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default CalendarShowcase;
