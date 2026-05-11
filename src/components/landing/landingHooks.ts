import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────
   Shared hooks for the landing surfaces.
   Honors prefers-reduced-motion across all
   on-scroll, counter, and pointer effects.
   ──────────────────────────────────────────── */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const isReducedMotion = (): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

/**
 * Reveals the element on first viewport intersection.
 * Returns a ref to attach + an `inView` boolean for transitions.
 *
 * If reduced-motion is set, returns inView=true immediately so
 * content never sits stuck at opacity:0.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
    options: IntersectionObserverInit = {}
): { ref: React.RefObject<T | null>; inView: boolean } {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState<boolean>(() => isReducedMotion());
    // Pin options to first render; the same threshold/rootMargin lasts the
    // component's lifetime — re-creating the IO on every render would never
    // see anything, since each new observer starts fresh.
    const optsRef = useRef<IntersectionObserverInit>(options);

    useEffect(() => {
        if (isReducedMotion()) {
            setInView(true);
            return;
        }
        const node = ref.current;
        if (!node) return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        setInView(true);
                        io.unobserve(e.target);
                    }
                });
            },
            {
                threshold: 0.15,
                rootMargin: '0px 0px -40px 0px',
                ...optsRef.current,
            }
        );
        io.observe(node);
        return () => io.disconnect();
    }, []);

    return { ref, inView };
}

/**
 * Reveal sx fragment — drop into any sx={{ ...revealSx(inView, delayMs) }}
 */
export const revealSx = (inView: boolean, delayMs: number = 0) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 700ms cubic-bezier(.2,.7,.2,1) ${delayMs}ms, transform 700ms cubic-bezier(.2,.7,.2,1) ${delayMs}ms`,
});

interface CounterOptions {
    to: number;
    decimals?: number;
    durationMs?: number;
    enabled: boolean;
}

/**
 * Tweens a number from 0 → `to` once `enabled` flips true.
 * Returns the formatted string (en-US locale, tabular nums).
 */
export function useCounter({
    to,
    decimals = 0,
    durationMs = 1400,
    enabled,
}: CounterOptions): string {
    const fmt = (n: number) =>
        n.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    const [value, setValue] = useState<string>(() =>
        isReducedMotion() && enabled ? fmt(to) : fmt(0)
    );
    const startedRef = useRef(false);

    useEffect(() => {
        if (!enabled || startedRef.current) return;
        startedRef.current = true;
        if (isReducedMotion()) {
            setValue(fmt(to));
            return;
        }
        const start = performance.now();
        let raf = 0;
        const tick = (t: number) => {
            const p = Math.min(1, (t - start) / durationMs);
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(fmt(to * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, to, decimals, durationMs]);

    return value;
}

/**
 * Spotlight pointer-follow. Sets CSS vars `--mx` and `--my` on the
 * referenced element so a radial gradient can track the cursor.
 *
 * No-op on touch (`hover: none`) and reduced-motion contexts.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>(): React.RefObject<T | null> {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isReducedMotion()) return;
        if (window.matchMedia('(hover: none)').matches) return;
        const node = ref.current;
        if (!node) return;
        let raf = 0;
        const onMove = (e: PointerEvent) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                const mx = (e.clientX / window.innerWidth) * 100;
                const my = (e.clientY / window.innerHeight) * 100;
                node.style.setProperty('--mx', `${mx}%`);
                node.style.setProperty('--my', `${my}%`);
                raf = 0;
            });
        };
        document.addEventListener('pointermove', onMove);
        return () => {
            document.removeEventListener('pointermove', onMove);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);
    return ref;
}

/**
 * Magnetic CTA — translates the element toward the pointer.
 * Strength tuple is (xMul, yMul); artifact uses (.18, .28).
 *
 * No-op on touch and reduced-motion.
 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(
    strength: [number, number] = [0.18, 0.28]
): React.RefObject<T | null> {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isReducedMotion()) return;
        if (window.matchMedia('(hover: none)').matches) return;
        const node = ref.current;
        if (!node) return;
        const onMove = (e: PointerEvent) => {
            const r = node.getBoundingClientRect();
            const x = (e.clientX - (r.left + r.width / 2)) * strength[0];
            const y = (e.clientY - (r.top + r.height / 2)) * strength[1];
            node.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        };
        const onLeave = () => {
            node.style.transform = '';
        };
        node.addEventListener('pointermove', onMove);
        node.addEventListener('pointerleave', onLeave);
        return () => {
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerleave', onLeave);
        };
    }, [strength]);
    return ref;
}

/**
 * Typewriter effect. Types `text` character by character once
 * `enabled` flips true. On reduced-motion, returns the full text
 * with `done: true` immediately.
 */
export function useTypewriter(
    text: string,
    enabled: boolean,
    minDelay: number = 14,
    maxJitter: number = 22
): { typed: string; done: boolean } {
    const [typed, setTyped] = useState('');
    const [done, setDone] = useState(false);
    const startedRef = useRef(false);

    useEffect(() => {
        if (!enabled || startedRef.current) return;
        startedRef.current = true;
        if (isReducedMotion()) {
            setTyped(text);
            setDone(true);
            return;
        }
        let i = 0;
        let cancelled = false;
        let pendingTimeout: number | null = null;
        const scheduleNext = (delay: number) => {
            if (cancelled) return;
            // Pause the chain whenever the tab is hidden; the next tick fires
            // on visibilitychange instead of burning timers in the background.
            if (typeof document !== 'undefined' && document.hidden) return;
            pendingTimeout = window.setTimeout(tick, delay);
        };
        const tick = () => {
            if (cancelled) return;
            pendingTimeout = null;
            i++;
            setTyped(text.slice(0, i));
            if (i < text.length) {
                scheduleNext(minDelay + Math.random() * maxJitter);
            } else {
                pendingTimeout = window.setTimeout(() => {
                    if (!cancelled) setDone(true);
                }, 350);
            }
        };
        const onVisibility = () => {
            if (!cancelled && !document.hidden && pendingTimeout === null && i < text.length) {
                scheduleNext(minDelay);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        const initial = window.setTimeout(tick, 400);
        return () => {
            cancelled = true;
            window.clearTimeout(initial);
            if (pendingTimeout !== null) window.clearTimeout(pendingTimeout);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, text, minDelay, maxJitter]);

    return { typed, done };
}

/**
 * Tracks reduced-motion so callers can branch render-time.
 * Re-evaluates on media-query changes.
 */
export function useReducedMotion(): boolean {
    const [reduce, setReduce] = useState<boolean>(() => isReducedMotion());
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia(REDUCED_MOTION_QUERY);
        const onChange = () => setReduce(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return reduce;
}
