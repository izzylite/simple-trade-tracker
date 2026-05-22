import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ACCENT, HAIR, PAPER, TNUM, WIN } from 'components/landing/landingTokens';
import { useReveal, revealSx } from 'components/landing/landingHooks';
import SectionMarker from 'components/landing/sections/SectionMarker';

/* ─────────────────────────────────────────────
   Import — migrant onboarding section.
   The visual is a static mockup of the actual
   three-step import dialog: Map → Preview → Import.
   ──────────────────────────────────────────── */

interface MappingRow {
    source: string;
    target: string;
    auto: boolean;
}

const MAPPING_ROWS: MappingRow[] = [
    { source: 'Date', target: 'Trade date', auto: true },
    { source: 'Symbol', target: 'Name', auto: true },
    { source: 'Profit', target: 'Amount', auto: true },
    { source: 'Setup', target: 'Tag', auto: true },
    { source: 'Plan?', target: 'unmapped', auto: false },
];

const STEPS = ['Map', 'Preview', 'Import'] as const;
const ACTIVE_STEP = 0; // dialog frozen on the Map step

const StepRail: React.FC = () => (
    <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.25, borderBottom: HAIR }}
    >
        {STEPS.map((label, i) => {
            const isActive = i === ACTIVE_STEP;
            const isDone = i < ACTIVE_STEP;
            return (
                <React.Fragment key={label}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: `1.5px solid ${isActive || isDone ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                                bgcolor: isActive ? ACCENT : 'transparent',
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                color: isActive ? '#0a0a0a' : isDone ? ACCENT : 'rgba(255,255,255,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                flexShrink: 0,
                            }}
                        >
                            {isDone ? '✓' : i + 1}
                        </Box>
                        <Typography
                            sx={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontFeatureSettings: TNUM,
                                fontSize: '0.66rem',
                                fontWeight: 500,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: isActive ? '#f1f5f9' : 'rgba(255,255,255,0.4)',
                            }}
                        >
                            {label}
                        </Typography>
                    </Stack>
                    {i < STEPS.length - 1 && (
                        <Box
                            aria-hidden
                            sx={{
                                flex: 1,
                                height: '1px',
                                bgcolor: i < ACTIVE_STEP ? ACCENT : 'rgba(255,255,255,0.12)',
                            }}
                        />
                    )}
                </React.Fragment>
            );
        })}
    </Stack>
);

const ImportDialogMock: React.FC = () => {
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.25 });
    return (
        <Box
            ref={reveal.ref}
            sx={{
                position: 'relative',
                zIndex: 1,
                bgcolor: PAPER,
                border: HAIR,
                borderRadius: '14px',
                overflow: 'hidden',
                maxWidth: 460,
                mx: { xs: 'auto', md: 0 },
                ...revealSx(reveal.inView, 160),
            }}
        >
            {/* Header band — dialog title + close affordance */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 2, py: 1.5, borderBottom: HAIR }}
            >
                <Box>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#f1f5f9',
                            lineHeight: 1.2,
                        }}
                    >
                        Import trades
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.66rem',
                            color: 'rgba(255,255,255,0.45)',
                            mt: 0.25,
                        }}
                    >
                        journal-2024.csv · 487 rows
                    </Typography>
                </Box>
                <CloseIcon
                    sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}
                />
            </Stack>

            {/* Step rail */}
            <StepRail />

            {/* Body — mapping list */}
            <Box sx={{ px: 2, py: 1.75 }}>
                <Stack direction="row" sx={{ mb: 1.25 }}>
                    <Typography
                        sx={{
                            flex: 1,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontSize: '0.58rem',
                            fontWeight: 500,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.38)',
                        }}
                    >
                        Your column
                    </Typography>
                    <Typography
                        sx={{
                            flex: 1,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontSize: '0.58rem',
                            fontWeight: 500,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.38)',
                        }}
                    >
                        JournoTrades field
                    </Typography>
                </Stack>

                <Stack spacing={0.75}>
                    {MAPPING_ROWS.map((row, i) => (
                        <Box
                            key={row.source}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 18px 1fr 18px',
                                gap: 1,
                                alignItems: 'center',
                                opacity: reveal.inView ? 1 : 0,
                                transform: reveal.inView ? 'translateY(0)' : 'translateY(6px)',
                                transition: `opacity 500ms cubic-bezier(.2,.7,.2,1) ${300 + i * 70}ms, transform 500ms cubic-bezier(.2,.7,.2,1) ${300 + i * 70}ms`,
                            }}
                        >
                            <Box
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontSize: '0.75rem',
                                    color: '#f1f5f9',
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    border: HAIR,
                                    borderRadius: '5px',
                                    px: 1,
                                    py: 0.5,
                                }}
                            >
                                {row.source}
                            </Box>
                            <Box
                                aria-hidden
                                sx={{
                                    color: row.auto ? ACCENT : 'rgba(255,255,255,0.28)',
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    lineHeight: 1,
                                }}
                            >
                                →
                            </Box>
                            <Box
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontSize: '0.75rem',
                                    color: row.auto ? '#f1f5f9' : 'rgba(255,255,255,0.38)',
                                    fontStyle: row.auto ? 'normal' : 'italic',
                                    bgcolor: row.auto
                                        ? 'rgba(124,58,237,0.10)'
                                        : 'rgba(255,255,255,0.02)',
                                    border: row.auto
                                        ? '1px solid rgba(124,58,237,0.28)'
                                        : '1px dashed rgba(255,255,255,0.14)',
                                    borderRadius: '5px',
                                    px: 1,
                                    py: 0.5,
                                }}
                            >
                                {row.target}
                            </Box>
                            <Box
                                aria-label={row.auto ? 'auto-detected' : 'awaiting assignment'}
                                sx={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${row.auto ? WIN : 'rgba(255,255,255,0.2)'}`,
                                    color: row.auto ? WIN : 'transparent',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                ✓
                            </Box>
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* Footer — status + primary CTA */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1.5}
                sx={{ px: 2, py: 1.25, borderTop: HAIR, bgcolor: 'rgba(255,255,255,0.015)' }}
            >
                <Typography
                    sx={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontFeatureSettings: TNUM,
                        fontSize: '0.66rem',
                        color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    4 of 5 matched
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Box
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.55)',
                            border: HAIR,
                            borderRadius: '6px',
                            px: 1.25,
                            py: 0.5,
                        }}
                    >
                        Cancel
                    </Box>
                    <Box
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#f1f5f9',
                            bgcolor: ACCENT,
                            borderRadius: '6px',
                            px: 1.25,
                            py: 0.5,
                            boxShadow: '0 6px 16px -6px rgba(124,58,237,0.6)',
                        }}
                    >
                        Next: Preview →
                    </Box>
                </Stack>
            </Stack>
        </Box>
    );
};

const ImportSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();

    return (
        <Box
            id="import"
            sx={{
                py: { xs: 10, md: 14 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Import" />
            <Container
                maxWidth={false}
                sx={{
                    position: 'relative',
                    zIndex: 1,
                    maxWidth: { xs: 1080, lg: 1280, xl: 1440 },
                    px: { xs: 3, md: 4, xl: 6 },
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: { xs: 5, md: 8 },
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
                            Import
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
                                mb: 2,
                                ...revealSx(head.inView, 80),
                            }}
                        >
                            Bring the spreadsheet to JournoTrades.
                        </Typography>
                        <Typography
                            ref={body.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.95rem',
                                color: 'rgba(255,255,255,0.65)',
                                lineHeight: 1.75,
                                maxWidth: 460,
                                ...revealSx(body.inView, 160),
                            }}
                        >
                            Import your spreadsheet into a JournoTrades calendar and
                            start auditing your trades for the patterns you&rsquo;ve
                            missed.
                        </Typography>
                    </Box>
                    <ImportDialogMock />
                </Box>
            </Container>
        </Box>
    );
};

export default ImportSection;
