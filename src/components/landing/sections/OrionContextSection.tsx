import React, { useEffect, useRef, useState } from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import { ACCENT, HAIR, PAPER, TNUM, WIN, LOSS } from 'components/landing/landingTokens';
import { useReveal, revealSx, useTypewriter, useReducedMotion } from 'components/landing/landingHooks';
import SectionMarker from 'components/landing/sections/SectionMarker';

/* ─────────────────────────────────────────────
   Orion · Context Advantage
   Single Orion intro section. Two-tab demo on the right swaps
   between the synthesis answer (cite chips back to feeds) and
   the post-mortem typewriter (used to live in OrionSection,
   merged here to remove the back-to-back-Orion bloat).

   Maps to the real Orion tool surface:
     - trade history & user notes via execute_sql (tools.ts:1657)
     - economic_events via execute_sql
     - get_market_data action="quote"/"candles" (tools.ts)
     - search_web + scrape_url (tools.ts:80-122)
     - search_web type=news, time_range=day → "breaking news"
     - analyze_image (tools.ts:841-868) over chart screenshots
     - recall_conversations semantic search over ai_conversations
   ──────────────────────────────────────────── */

interface FeedRow {
    id: string;
    label: string;
    body: string;
    meta: string;
    color: string;
}

const FEEDS: FeedRow[] = [
    {
        id: 'trades',
        label: 'Trade history',
        body: 'Every fill. Every tag. Every R.',
        meta: '1,247 trades · 23 Tuesdays in the last 90 days',
        color: ACCENT,
    },
    {
        id: 'notes',
        label: 'Notes',
        body: 'Pre-market plans, post-session mortems, every line you tagged.',
        meta: '186 entries · linked to fills',
        color: '#a78bfa',
    },
    {
        id: 'recall',
        label: 'Past conversations',
        body: 'Search across past chats. Pulls the thread where you asked about NFP last month, not the one about gold.',
        meta: 'recall_conversations · 47 threads',
        color: '#a78bfa',
    },
    {
        id: 'events',
        label: 'Economic events',
        body: 'Pinned to your timezone, filtered by impact.',
        meta: 'This week · 14 events · 3 high-impact',
        color: '#f59e0b',
    },
    {
        id: 'price',
        label: 'Market data',
        body: 'Live quotes and historical candles across forex, futures, indices, commodities, crypto.',
        meta: 'ES 5,832 · −0.5% · DXY +0.4% · GC 2,438',
        color: WIN,
    },
    {
        id: 'news',
        label: 'Breaking news',
        body: 'Search the wires filtered to the last hour, then pull the article.',
        meta: 'news · time_range: day · 6 results, last 47 min',
        color: LOSS,
    },
    {
        id: 'research',
        label: 'Web research',
        body: 'Search and scrape on demand for the deeper read.',
        meta: 'search_web · scrape_url',
        color: '#a78bfa',
    },
    {
        id: 'vision',
        label: 'Screenshots',
        body: 'Vision over the charts you uploaded with each trade.',
        meta: 'analyze_image · 4 charts attached this week',
        color: ACCENT,
    },
];

const FeedLedger: React.FC = () => {
    return (
        <Box>
            <Typography
                sx={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontFeatureSettings: TNUM,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    mb: 2,
                }}
            >
                What Orion is reading
            </Typography>
            <Stack spacing={0}>
                {FEEDS.map((f, i) => (
                    <Stack
                        key={f.id}
                        direction="row"
                        spacing={2}
                        alignItems="flex-start"
                        sx={{
                            py: { xs: 1.5, md: 1.75 },
                            borderTop: i === 0 ? 'none' : HAIR,
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '2px',
                                bgcolor: f.color,
                                mt: 1,
                                flexShrink: 0,
                            }}
                            aria-hidden
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontFeatureSettings: TNUM,
                                    fontSize: '0.7rem',
                                    fontWeight: 500,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    color: f.color,
                                    mb: 0.25,
                                }}
                            >
                                {f.label}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: { xs: '0.92rem', md: '0.98rem' },
                                    color: '#f1f5f9',
                                    lineHeight: 1.5,
                                    fontWeight: 500,
                                    letterSpacing: '-0.005em',
                                }}
                            >
                                {f.body}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    fontFeatureSettings: TNUM,
                                    fontSize: '0.74rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    mt: 0.5,
                                }}
                            >
                                {f.meta}
                            </Typography>
                        </Box>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
};

interface CitedSpan {
    text: string;
    cite?: string;
}

/* Per-span typewriter: progresses through `spans` char-by-char and reveals
   each span's cite chip on span completion. Once-per-mount, gated by `enabled`.
   Pauses while the document is hidden so background tabs don't burn timers. */
function useSpanTypewriter(
    spans: CitedSpan[],
    enabled: boolean,
    charDelay = 12,
    charJitter = 18,
    spanGap = 90,
): { spanIndex: number; charIndex: number; done: boolean } {
    const [spanIndex, setSpanIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [done, setDone] = useState(false);
    const startedRef = useRef(false);
    const reduce = useReducedMotion();

    useEffect(() => {
        if (!enabled || startedRef.current) return;
        startedRef.current = true;
        if (reduce) {
            setSpanIndex(spans.length);
            setDone(true);
            return;
        }
        let cancelled = false;
        let pending: number | null = null;
        let si = 0;
        let ci = 0;
        const tick = () => {
            if (cancelled) return;
            pending = null;
            if (typeof document !== 'undefined' && document.hidden) return;
            const span = spans[si];
            if (!span) {
                setDone(true);
                return;
            }
            if (ci < span.text.length) {
                ci++;
                setCharIndex(ci);
                pending = window.setTimeout(tick, charDelay + Math.random() * charJitter);
            } else {
                si++;
                ci = 0;
                setSpanIndex(si);
                setCharIndex(0);
                if (si < spans.length) {
                    pending = window.setTimeout(tick, spanGap);
                } else {
                    setDone(true);
                }
            }
        };
        const onVisibility = () => {
            if (cancelled || document.hidden || pending !== null) return;
            if (si >= spans.length) return;
            pending = window.setTimeout(tick, charDelay);
        };
        document.addEventListener('visibilitychange', onVisibility);
        pending = window.setTimeout(tick, 400);
        return () => {
            cancelled = true;
            if (pending !== null) window.clearTimeout(pending);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, spans, charDelay, charJitter, spanGap, reduce]);

    return { spanIndex, charIndex, done };
}

/* Blinking caret — shared between the synthesis and post-mortem typers. */
const TypingCaret: React.FC = () => (
    <Box
        component="span"
        aria-hidden
        sx={{
            display: 'inline-block',
            width: '7px',
            height: '1em',
            verticalAlign: '-2px',
            bgcolor: ACCENT,
            ml: '1px',
            animation: 'lpCaret 900ms steps(1) infinite',
            '@keyframes lpCaret': {
                '50%': { opacity: 0 },
            },
            '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
            },
        }}
    />
);

/** Inline cite chip — small, color-matched to the feed it cites. */
const CiteChip: React.FC<{ feedId: string }> = ({ feedId }) => {
    const feed = FEEDS.find((f) => f.id === feedId);
    if (!feed) return null;
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontFeatureSettings: TNUM,
                fontSize: '0.66rem',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: feed.color,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: `1px solid ${feed.color}33`,
                borderRadius: '4px',
                px: 0.6,
                py: 0.1,
                ml: 0.4,
                mr: 0.2,
                verticalAlign: '2px',
                whiteSpace: 'nowrap',
            }}
        >
            <Box
                sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: feed.color,
                }}
                aria-hidden
            />
            {feed.label}
        </Box>
    );
};

/* All 7 feeds cited inline so the "Synthesis · 7 sources" header
   matches the body. The research cite now lands on the CME line. */
const SYNTHESIS_SPANS: CitedSpan[] = [
    { text: 'On the last four FOMC days', cite: 'events' },
    { text: ' you held into the print and stopped out twice', cite: 'trades' },
    { text: '. Your Monday plan said no scalps in the first five', cite: 'notes' },
    { text: '. ES is at 5,832, gold tagging 2,440', cite: 'price' },
    { text: '. Powell remarks crossed Reuters thirteen minutes ago', cite: 'news' },
    {
        text: '. The 5-min screenshot you uploaded shows a clean failed-breakdown wick at 5,829',
        cite: 'vision',
    },
    {
        text: '. The CME blog on the latest minutes points to a hawkish pause',
        cite: 'research',
    },
    {
        text: '. The pattern points to flat into the print. VWAP retest typically resolves the bias by 14:30 ET.',
    },
];

interface OrionFrameProps {
    rightLabel: string;
    children: React.ReactNode;
}

/** Shared chrome for both demo tabs: Orion header + content slot. */
const OrionFrame: React.FC<OrionFrameProps> = ({ rightLabel, children }) => (
    <Box
        sx={{
            bgcolor: PAPER,
            border: HAIR,
            borderRadius: '16px',
            overflow: 'hidden',
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
                }}
            >
                {rightLabel}
            </Typography>
        </Stack>
        {children}
    </Box>
);

const SynthesisAnswer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.4 });
    const { spanIndex, charIndex, done } = useSpanTypewriter(
        SYNTHESIS_SPANS,
        enabled && reveal.inView,
    );
    return (
        <Box ref={reveal.ref}>
            <OrionFrame rightLabel="Synthesis · 7 sources">
                <Box sx={{ p: 2.5 }}>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            border: HAIR,
                            color: '#f1f5f9',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.92rem',
                            lineHeight: 1.6,
                            maxWidth: '92%',
                            ml: 'auto',
                            mb: 2,
                        }}
                    >
                        Should I trade the FOMC print today?
                    </Box>

                    <Box
                        sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: 'rgba(124,58,237,0.14)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            color: '#ede9fe',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.94rem',
                            lineHeight: 1.7,
                            position: 'relative',
                        }}
                    >
                        {/* Hidden spacer reserves final height so the card doesn't
                            grow as text types in. Same trick as PostMortemAnswer. */}
                        <Box aria-hidden sx={{ visibility: 'hidden' }}>
                            {SYNTHESIS_SPANS.map((span, i) => (
                                <React.Fragment key={i}>
                                    {span.text}
                                    {span.cite && <CiteChip feedId={span.cite} />}
                                </React.Fragment>
                            ))}
                        </Box>
                        {/* Visible typed content overlaid on the spacer.
                            Spans before the cursor render fully (text + chip).
                            The current span renders partial text + caret.
                            Spans after render nothing. */}
                        <Box sx={{ position: 'absolute', inset: 0, p: 2 }}>
                            {SYNTHESIS_SPANS.map((span, i) => {
                                if (i < spanIndex) {
                                    return (
                                        <React.Fragment key={i}>
                                            {span.text}
                                            {span.cite && <CiteChip feedId={span.cite} />}
                                        </React.Fragment>
                                    );
                                }
                                if (i === spanIndex) {
                                    return (
                                        <React.Fragment key={i}>
                                            {span.text.slice(0, charIndex)}
                                            {!done && <TypingCaret />}
                                        </React.Fragment>
                                    );
                                }
                                return null;
                            })}
                        </Box>
                    </Box>

                    <Typography
                        sx={{
                            mt: 1.75,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.7rem',
                            color: done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0)',
                            transition: 'color 320ms',
                        }}
                    >
                        Every claim cites the feed it came from. ChatGPT can&rsquo;t see any
                        of these.
                    </Typography>
                </Box>
            </OrionFrame>
        </Box>
    );
};

/* Post-mortem typewriter — was OrionDemo before the merge. The
   `enabled` flag now also gates on the active tab, so swapping
   away from Post-mortem stops the setTimeout chain mid-flight. */
const ORION_POSTMORTEM_TEXT =
    "On Tuesdays you've been overtrading after the first loss. 7 of your last 10 Tuesdays included a revenge entry tagged FOMO, average -$210 each. Win rate on Tuesday A+ setups is still 68%; the bleed is the C-grade entries after a stop-out.";
const ORION_POSTMORTEM_CITE = 'From 23 Tuesdays · last 90 days · tags: FOMO, revenge, A+';

const PostMortemAnswer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.4 });
    const { typed, done } = useTypewriter(
        ORION_POSTMORTEM_TEXT,
        enabled && reveal.inView,
    );
    return (
        <Box ref={reveal.ref}>
            <OrionFrame rightLabel="Post-mortem · 23 Tuesdays">
                <Box sx={{ p: 2.5 }}>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            color: '#f1f5f9',
                            border: HAIR,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.92rem',
                            lineHeight: 1.6,
                            maxWidth: '86%',
                            ml: 'auto',
                            mb: 2,
                        }}
                    >
                        What&rsquo;s been killing my Tuesdays?
                    </Box>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: 'rgba(124,58,237,0.14)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            color: '#ede9fe',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.94rem',
                            lineHeight: 1.7,
                            position: 'relative',
                        }}
                    >
                        {/* Spacer reserves final height so the card doesn't grow as text types */}
                        <Box aria-hidden sx={{ visibility: 'hidden' }}>
                            {ORION_POSTMORTEM_TEXT}
                            <Box
                                component="span"
                                sx={{
                                    display: 'block',
                                    mt: 1.25,
                                    fontSize: '0.74rem',
                                }}
                            >
                                {ORION_POSTMORTEM_CITE}
                            </Box>
                        </Box>
                        {/* Visible typed content overlaid on the spacer */}
                        <Box sx={{ position: 'absolute', inset: 0, p: 2 }}>
                            {typed}
                            {!done && (
                                <Box
                                    component="span"
                                    aria-hidden
                                    sx={{
                                        display: 'inline-block',
                                        width: '7px',
                                        height: '1em',
                                        verticalAlign: '-2px',
                                        bgcolor: ACCENT,
                                        ml: '1px',
                                        animation: 'lpCaret 900ms steps(1) infinite',
                                        '@keyframes lpCaret': {
                                            '50%': { opacity: 0 },
                                        },
                                        '@media (prefers-reduced-motion: reduce)': {
                                            animation: 'none',
                                        },
                                    }}
                                />
                            )}
                            {done && (
                                <Typography
                                    component="span"
                                    sx={{
                                        display: 'block',
                                        mt: 1.25,
                                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                        fontFeatureSettings: TNUM,
                                        fontSize: '0.74rem',
                                        color: 'rgba(237,233,254,0.65)',
                                    }}
                                >
                                    {ORION_POSTMORTEM_CITE}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            </OrionFrame>
        </Box>
    );
};

type DemoTab = 'synthesis' | 'postmortem';

interface TabSpec {
    id: DemoTab;
    label: string;
    sub: string;
}

const TABS: TabSpec[] = [
    { id: 'synthesis', label: 'Synthesis', sub: 'Should I trade the FOMC print?' },
    { id: 'postmortem', label: 'Post-mortem', sub: 'What killed my Tuesdays?' },
];

const TabSwitcher: React.FC<{
    active: DemoTab;
    onChange: (id: DemoTab) => void;
}> = ({ active, onChange }) => (
    <Stack
        direction="row"
        spacing={0.5}
        sx={{ mb: 2 }}
        role="tablist"
        aria-label="Orion answer demos"
    >
        {TABS.map((t) => {
            const isActive = active === t.id;
            return (
                <Box
                    key={t.id}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onChange(t.id)}
                    sx={{
                        flex: { xs: 1, sm: 'initial' },
                        bgcolor: isActive ? 'rgba(124,58,237,0.16)' : 'transparent',
                        border: isActive
                            ? '1px solid rgba(124,58,237,0.32)'
                            : HAIR,
                        color: isActive ? '#ede9fe' : 'rgba(255,255,255,0.55)',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        px: { xs: 1.25, sm: 1.5 },
                        py: 0.85,
                        textAlign: 'left',
                        transition: 'background 150ms, color 150ms, border-color 150ms',
                        '&:hover': {
                            color: isActive ? '#ede9fe' : '#f1f5f9',
                            bgcolor: isActive
                                ? 'rgba(124,58,237,0.22)'
                                : 'rgba(255,255,255,0.03)',
                        },
                        '&:focus-visible': {
                            outline: `2px solid ${ACCENT}`,
                            outlineOffset: 2,
                        },
                    }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontFeatureSettings: TNUM,
                            fontSize: '0.66rem',
                            fontWeight: 500,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: isActive ? ACCENT : 'rgba(255,255,255,0.45)',
                            lineHeight: 1.2,
                        }}
                    >
                        {t.label}
                    </Typography>
                    <Typography
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.78rem',
                            color: isActive ? '#f1f5f9' : 'rgba(255,255,255,0.55)',
                            mt: 0.25,
                            lineHeight: 1.3,
                            display: { xs: 'none', sm: 'block' },
                        }}
                    >
                        {t.sub}
                    </Typography>
                </Box>
            );
        })}
    </Stack>
);

const OrionContextDemo: React.FC = () => {
    const reveal = useReveal<HTMLDivElement>({ threshold: 0.15 });
    const [tab, setTab] = useState<DemoTab>('synthesis');
    return (
        <Box
            ref={reveal.ref}
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1.05fr' },
                gap: { xs: 5, md: 6 },
                alignItems: 'start',
                ...revealSx(reveal.inView, 160),
            }}
        >
            <FeedLedger />
            <Box
                sx={{
                    position: { md: 'sticky' },
                    top: { md: 96 },
                }}
            >
                <TabSwitcher active={tab} onChange={setTab} />
                {tab === 'synthesis' ? (
                    <SynthesisAnswer enabled={tab === 'synthesis'} />
                ) : (
                    <PostMortemAnswer enabled={tab === 'postmortem'} />
                )}
            </Box>
        </Box>
    );
};

const OrionContextSection: React.FC = () => {
    const eyebrow = useReveal<HTMLDivElement>();
    const head = useReveal<HTMLDivElement>();
    const body = useReveal<HTMLDivElement>();
    return (
        <Box
            id="orion"
            sx={{
                py: { xs: 10, md: 14 },
                scrollMarginTop: 96,
                borderTop: HAIR,
                position: 'relative',
            }}
        >
            <SectionMarker label="Assistant-Orion" />
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
                            Why Orion, not ChatGPT
                        </Typography>
                        <Typography
                            ref={head.ref}
                            sx={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontWeight: 800,
                                fontSize: { xs: '1.9rem', md: '2.6rem', lg: '3.1rem', xl: '3.5rem' },
                                color: '#f1f5f9',
                                letterSpacing: '-0.03em',
                                lineHeight: 1.04,
                                ...revealSx(head.inView, 80),
                            }}
                        >
                            An assistant that reads what you&rsquo;ve actually traded.
                        </Typography>
                    </Box>
                    <Typography
                        ref={body.ref}
                        sx={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: { xs: '0.95rem', md: '1.05rem' },
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: 1.75,
                            alignSelf: 'end',
                            ...revealSx(body.inView, 160),
                        }}
                    >
                        Generic chatbots guess. Orion looks. It reads every fill you have
                        logged and every line of every note. It pulls live spot on the
                        instruments you trade, the macro calendar pinned to your timezone,
                        and the news that broke in the last hour. It opens the chart
                        screenshot you attached to Tuesday&rsquo;s loss. Ask why the
                        morning died and the answer cites the wire that hit at 09:32, the
                        stop you set in your pre-market note, the tag you added after the
                        flush. The intelligence is the inputs.
                    </Typography>
                </Box>

                <OrionContextDemo />
            </Container>
        </Box>
    );
};

export default OrionContextSection;
