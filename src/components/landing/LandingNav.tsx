import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

interface Props {
    onLogin: () => void;
}

const ACCENT = '#7c3aed';

const ANCHOR_IDS = ['calendar', 'performance', 'events', 'notes', 'orion'] as const;
type AnchorId = (typeof ANCHOR_IDS)[number];

const LandingNav: React.FC<Props> = ({ onLogin }) => {
    const [scrolled, setScrolled] = useState(false);
    const [activeAnchor, setActiveAnchor] = useState<AnchorId | null>(null);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    /* Scroll-spy: pick the section whose top is closest to the nav's bottom edge.
       IntersectionObserver tracks all anchors; on each intersection change we rescan
       the cached entries and choose the topmost section that's currently in the
       upper half of the viewport. */
    useEffect(() => {
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
        const sections = ANCHOR_IDS
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null);
        if (sections.length === 0) return;

        const visibility = new Map<string, number>();
        const recompute = () => {
            let bestId: AnchorId | null = null;
            let bestRatio = 0;
            visibility.forEach((ratio, id) => {
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestId = id as AnchorId;
                }
            });
            setActiveAnchor(bestId);
        };

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    visibility.set(e.target.id, e.intersectionRatio);
                });
                recompute();
            },
            {
                // Treat the area below the fixed nav as the "live" zone.
                rootMargin: '-96px 0px -55% 0px',
                threshold: [0, 0.25, 0.5, 0.75, 1],
            },
        );
        sections.forEach((s) => io.observe(s));
        return () => io.disconnect();
    }, []);

    const handleAnchor = (id: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    const linkSx = useMemo(
        () => ({
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            cursor: 'pointer',
            position: 'relative' as const,
            transition: 'color 150ms',
            '&::after': {
                content: '""',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -6,
                height: '1px',
                bgcolor: ACCENT,
                transform: 'scaleX(0)',
                transformOrigin: 'left',
                transition: 'transform 220ms cubic-bezier(.2,.7,.2,1)',
            },
            '&:hover': { color: '#f1f5f9' },
            '&:hover::after': { transform: 'scaleX(1)' },
            '&:focus-visible': {
                color: '#f1f5f9',
                outline: `2px solid ${ACCENT}`,
                outlineOffset: 4,
                borderRadius: '2px',
            },
            '&:focus-visible::after': { transform: 'scaleX(1)' },
            // Active-section state from scroll-spy. Brighter color + persistent
            // underline so the reader always knows where they are on the page.
            '&[data-active="true"]': {
                color: '#f1f5f9',
            },
            '&[data-active="true"]::after': {
                transform: 'scaleX(1)',
            },
        }),
        [],
    );

    return (
        <Box
            component="nav"
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 999,
                px: { xs: 3, md: 6 },
                py: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backdropFilter: scrolled ? 'blur(20px) saturate(160%)' : 'none',
                bgcolor: scrolled ? 'rgba(8,8,8,0.85)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                transition: 'background 200ms, border-color 200ms',
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.25}>
                <Box
                    aria-hidden
                    sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '2px',
                        bgcolor: ACCENT,
                    }}
                />
                <Typography
                    sx={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: '#f1f5f9',
                        letterSpacing: '-0.01em',
                    }}
                >
                    JournoTrades
                </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, md: 2 }}>
                {/* Anchor links — md+ only */}
                <Stack
                    direction="row"
                    spacing={{ md: 2.25, lg: 3 }}
                    sx={{ display: { xs: 'none', md: 'flex' }, mr: 1.5 }}
                >
                    {(
                        [
                            { id: 'calendar', label: 'Calendar' },
                            { id: 'performance', label: 'Performance' },
                            { id: 'events', label: 'Events' },
                            { id: 'notes', label: 'Notes' },
                            { id: 'orion', label: 'Assistant' },
                        ] as const
                    ).map((a) => (
                        <Box
                            key={a.id}
                            component="a"
                            href={`#${a.id}`}
                            onClick={handleAnchor(a.id)}
                            data-active={activeAnchor === a.id}
                            aria-current={activeAnchor === a.id ? 'true' : undefined}
                            sx={linkSx}
                        >
                            {a.label}
                        </Box>
                    ))}
                </Stack>

                <Button
                    onClick={onLogin}
                    sx={{
                        color: 'rgba(255,255,255,0.65)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'none',
                        px: 1.5,
                        py: 0.5,
                        minWidth: 'auto',
                        '&:hover': {
                            color: '#f1f5f9',
                            bgcolor: 'transparent',
                        },
                    }}
                >
                    Log in
                </Button>
            </Stack>
        </Box>
    );
};

export default LandingNav;
