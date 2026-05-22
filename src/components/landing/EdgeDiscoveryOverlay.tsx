import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useReducedMotion } from './landingHooks';

/* ─────────────────────────────────────────────
   Ephemeral cursor-tracking labels for the hero.
   As the user moves through the hero region,
   small trade-flavored tokens ("+1R", "refining",
   "edge found") bloom near the cursor and fade —
   the feeling of refining an edge out of noise.

   Listener attaches to `targetRef` (the hero
   root) via a native pointermove handler, so we
   never sit on top of the hero content and never
   block clicks on the CTA. The overlay itself
   renders pointer-events:none labels behind the
   content stack and on top of the spotlight.
   ──────────────────────────────────────────── */

type TokenKind = 'win' | 'loss' | 'meta' | 'edge';

interface TokenSpec {
    text: string;
    kind: TokenKind;
    weight: number;
}

interface ActiveToken {
    id: number;
    text: string;
    kind: TokenKind;
    x: number;
    y: number;
    drift: number;
    rotate: number;
}

const TOKENS: TokenSpec[] = [
    // Wins
    { text: '+1R', kind: 'win', weight: 8 },
    { text: '+0.5R', kind: 'win', weight: 7 },
    { text: '+1.5R', kind: 'win', weight: 5 },
    { text: '+2R', kind: 'win', weight: 3 },
    { text: '+3R', kind: 'win', weight: 2 },
    { text: 'target hit', kind: 'win', weight: 3 },
    { text: 'partial', kind: 'win', weight: 3 },
    { text: 'runner', kind: 'win', weight: 2 },
    // Losses
    { text: '-1R', kind: 'loss', weight: 6 },
    { text: '-0.5R', kind: 'loss', weight: 5 },
    { text: '-1.5R', kind: 'loss', weight: 2 },
    { text: 'stopped out', kind: 'loss', weight: 3 },
    { text: 'breakeven', kind: 'loss', weight: 3 },
    { text: 'invalidated', kind: 'loss', weight: 2 },
    // Meta / process
    { text: 'refining', kind: 'meta', weight: 6 },
    { text: 'signal', kind: 'meta', weight: 5 },
    { text: 'noise', kind: 'meta', weight: 5 },
    { text: 'pattern', kind: 'meta', weight: 4 },
    { text: 'tagged', kind: 'meta', weight: 4 },
    { text: 'logged', kind: 'meta', weight: 4 },
    { text: 'reviewed', kind: 'meta', weight: 3 },
    { text: 'journaling', kind: 'meta', weight: 3 },
    { text: 'screenshot', kind: 'meta', weight: 3 },
    { text: 'confluence', kind: 'meta', weight: 3 },
    { text: 'A+ setup', kind: 'meta', weight: 3 },
    { text: 'conviction', kind: 'meta', weight: 2 },
    { text: 'bias up', kind: 'meta', weight: 2 },
    { text: 'bias down', kind: 'meta', weight: 2 },
    { text: 'key level', kind: 'meta', weight: 3 },
    { text: 'liquidity', kind: 'meta', weight: 2 },
    { text: 'retest', kind: 'meta', weight: 2 },
    // Edge — rare prize moments
    { text: 'edge found', kind: 'edge', weight: 2 },
    { text: 'pattern locked', kind: 'edge', weight: 1 },
    { text: 'edge sharpened', kind: 'edge', weight: 1 },
];

const TOTAL_WEIGHT = TOKENS.reduce((s, t) => s + t.weight, 0);

const pickToken = (): TokenSpec => {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const t of TOKENS) {
        roll -= t.weight;
        if (roll <= 0) return t;
    }
    return TOKENS[0];
};

const TOKEN_LIFETIME_MS = 1400;
const MIN_SPAWN_GAP_MS = 140;
const MAX_ACTIVE = 14;

const KIND_COLOR: Record<TokenKind, string> = {
    win: '#22c55e',
    loss: '#ef4444',
    meta: 'rgba(226,232,240,0.62)',
    edge: '#a78bfa',
};

// Peak opacity per kind — labels stay translucent so they read as ambient
// noise rather than competing with the hero headline. Edge tokens (the prize
// moment) sit highest; meta process tokens stay ghostliest.
const KIND_PEAK: Record<TokenKind, number> = {
    win: 0.55,
    loss: 0.55,
    meta: 0.4,
    edge: 0.72,
};

interface Props {
    targetRef: React.RefObject<HTMLElement | null>;
}

const EdgeDiscoveryOverlay: React.FC<Props> = ({ targetRef }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [tokens, setTokens] = useState<ActiveToken[]>([]);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (reduceMotion) {
            setTokens([]);
            return;
        }
        const target = targetRef.current;
        const host = hostRef.current;
        if (!target || !host) return;

        const isTouch = typeof window !== 'undefined'
            && window.matchMedia('(hover: none)').matches;

        let lastSpawn = 0;
        let nextId = 0;
        const cleanups: number[] = [];

        const spawnAt = (clientX: number, clientY: number, jitter = true) => {
            const rect = host.getBoundingClientRect();
            let localX = clientX - rect.left;
            let localY = clientY - rect.top;
            if (jitter) {
                localX += (Math.random() - 0.5) * 160;
                localY += (Math.random() - 0.5) * 110 - 10;
            }
            // Keep labels inside the hero with a small inset margin so wide
            // strings ("pattern locked") don't clip the edges.
            const pad = 60;
            localX = Math.max(pad, Math.min(rect.width - pad, localX));
            localY = Math.max(pad, Math.min(rect.height - pad, localY));
            const spec = pickToken();
            const id = ++nextId;
            const next: ActiveToken = {
                id,
                text: spec.text,
                kind: spec.kind,
                x: localX,
                y: localY,
                drift: -28 - Math.random() * 24,
                rotate: (Math.random() - 0.5) * 6,
            };
            setTokens((prev) => {
                const trimmed = prev.length >= MAX_ACTIVE ? prev.slice(prev.length - MAX_ACTIVE + 1) : prev;
                return [...trimmed, next];
            });
            const t = window.setTimeout(() => {
                setTokens((prev) => prev.filter((tok) => tok.id !== id));
            }, TOKEN_LIFETIME_MS);
            cleanups.push(t);
        };

        if (isTouch) {
            // Mobile / no-hover: auto-emit at random points across the hero so
            // the effect is still felt without a cursor. Slower cadence + only
            // while the hero is on-screen and the tab is visible.
            let intervalId = 0;
            let visible = true;
            const tick = () => {
                if (!visible) return;
                const rect = host.getBoundingClientRect();
                // Skip when hero is fully scrolled out of view.
                if (rect.bottom < 0 || rect.top > window.innerHeight) return;
                const cx = rect.left + Math.random() * rect.width;
                const cy = rect.top + Math.random() * rect.height;
                spawnAt(cx, cy, false);
            };
            const start = () => {
                if (intervalId) return;
                // ~3 spawns/sec, staggered with jitter via random delay add-on.
                intervalId = window.setInterval(tick, 320);
            };
            const stop = () => {
                if (intervalId) {
                    window.clearInterval(intervalId);
                    intervalId = 0;
                }
            };
            const onVisibility = () => {
                visible = !document.hidden;
                if (visible) start();
                else stop();
            };
            document.addEventListener('visibilitychange', onVisibility);
            start();
            return () => {
                stop();
                document.removeEventListener('visibilitychange', onVisibility);
                cleanups.forEach((t) => window.clearTimeout(t));
            };
        }

        // Desktop / hover-capable: pointer-driven spawn.
        const onMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return;
            const now = performance.now();
            if (now - lastSpawn < MIN_SPAWN_GAP_MS) return;
            lastSpawn = now;
            spawnAt(e.clientX, e.clientY);
        };
        target.addEventListener('pointermove', onMove);
        return () => {
            target.removeEventListener('pointermove', onMove);
            cleanups.forEach((t) => window.clearTimeout(t));
        };
    }, [targetRef, reduceMotion]);

    return (
        <Box
            ref={hostRef}
            aria-hidden
            sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: 0,
                '@keyframes edgeTokenBloom': {
                    '0%': { opacity: 0, transform: 'translate(-50%, -50%) translateY(0) scale(0.85)' },
                    '22%': {
                        opacity: 'var(--edge-peak, 0.5)',
                        transform: 'translate(-50%, -50%) translateY(-4px) scale(1)',
                    },
                    '100%': {
                        opacity: 0,
                        transform: 'translate(-50%, -50%) translateY(var(--edge-drift, -32px)) scale(0.98)',
                    },
                },
                '@media (prefers-reduced-motion: reduce)': {
                    display: 'none',
                },
            }}
        >
            {tokens.map((t) => (
                <Box
                    key={t.id}
                    sx={{
                        position: 'absolute',
                        left: t.x,
                        top: t.y,
                        '--edge-drift': `${t.drift}px`,
                        '--edge-peak': KIND_PEAK[t.kind],
                        color: KIND_COLOR[t.kind],
                        fontFamily: t.kind === 'meta' || t.kind === 'edge'
                            ? "'DM Sans', sans-serif"
                            : "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
                        fontSize: t.kind === 'edge'
                            ? { xs: '1.05rem', md: '1.1rem' }
                            : { xs: '0.95rem', md: '1rem' },
                        fontWeight: t.kind === 'edge' ? 700 : 600,
                        letterSpacing: t.kind === 'meta' ? '0.04em' : '-0.01em',
                        textTransform: t.kind === 'meta' ? 'lowercase' : 'none',
                        textShadow: t.kind === 'edge'
                            ? '0 0 14px rgba(167,139,250,0.55), 0 0 4px rgba(167,139,250,0.85)'
                            : t.kind === 'win'
                                ? '0 0 10px rgba(34,197,94,0.35)'
                                : t.kind === 'loss'
                                    ? '0 0 10px rgba(239,68,68,0.32)'
                                    : '0 1px 6px rgba(0,0,0,0.6)',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'center',
                        willChange: 'transform, opacity',
                        animation: `edgeTokenBloom ${TOKEN_LIFETIME_MS}ms cubic-bezier(.2,.7,.2,1) forwards`,
                        rotate: `${t.rotate}deg`,
                    }}
                >
                    {t.text}
                </Box>
            ))}
        </Box>
    );
};

export default EdgeDiscoveryOverlay;
