import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  useMediaQuery,
  keyframes
} from '@mui/material';

// Restrained fade-in on first paint. Uses the design system's "rail's choice"
// easing (--easing) and --duration-slow. No translateY: the splash should
// feel like it is *present*, not arriving.
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

// Module-level state persists for the lifetime of the page (resets only on a
// full reload). The splash is rendered from multiple sites in the React tree
// during boot (App-level Suspense fallback, the isAuthLoading branch in
// AppContent, HomeRouteResolver, CalendarRoute) — each transition unmounts
// the old instance and mounts a fresh one at a different tree position. A
// fresh DOM element restarts the entrance keyframe from opacity:0, which is
// what the user perceives as the splash "flashing" on reload. Skipping the
// animation on every mount after the first keeps the visual continuous.
let hasPlayedFadeIn = false;
let cachedProgress = 0;
let cachedLoadingText = 'Loading';
let cachedDots = '';

const AppLoadingProgress: React.FC = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const isDarkMode = useMemo(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? savedMode === 'dark' : prefersDarkMode;
  }, [prefersDarkMode]);

  // Mirrors the canonical tokens from
  // .aidesigner/handoff/journotrades-design-system/project/colors_and_type.css
  // (--bg-page, --fg-primary, --fg-tertiary, --violet-primary, --divider).
  // Hard-coded here because the splash mounts above the MUI ThemeProvider in
  // the App-level Suspense fallback path.
  const colors = useMemo(() => ({
    background: isDarkMode ? '#080808' : '#e8edf4',
    fg: isDarkMode ? '#f1f5f9' : '#0f172a',
    fgTertiary: isDarkMode ? '#64748b' : '#94a3b8',
    violet: '#7c3aed',
    divider: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
  }), [isDarkMode]);

  // First mount of this page lifetime plays the entrance animation; every
  // subsequent mount skips it so a remount looks like a continuation rather
  // than a flash.
  const [shouldAnimate] = useState(() => {
    if (hasPlayedFadeIn) return false;
    hasPlayedFadeIn = true;
    return true;
  });

  // Initialize from the module cache so progress/text/dots visually continue
  // across remounts instead of snapping back to their defaults.
  const [progress, setProgress] = useState(cachedProgress);
  const [loadingText, setLoadingText] = useState(cachedLoadingText);
  const [dots, setDots] = useState(cachedDots);

  // Mirror state into the cache so the next mount picks up where this one
  // left off.
  useEffect(() => { cachedProgress = progress; }, [progress]);
  useEffect(() => { cachedLoadingText = loadingText; }, [loadingText]);
  useEffect(() => { cachedDots = dots; }, [dots]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return Math.min(prev + 0.5, 95);
        return Math.min(prev + Math.random() * 5, 90);
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(dotsTimer);
  }, []);

  useEffect(() => {
    if (progress < 60) setLoadingText('Loading');
    else if (progress < 90) setLoadingText('Finishing up');
    else setLoadingText('Almost ready');
  }, [progress]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: colors.background,
        // DM Sans is preloaded from index.html. The fallback chain matches
        // the design-system --font-sans token.
        fontFamily: '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5, // 40px between wordmark and progress
          ...(shouldAnimate && {
            '@media (prefers-reduced-motion: no-preference)': {
              animation: `${fadeIn} 0.24s cubic-bezier(0.22, 1, 0.36, 1) both`,
            },
          }),
        }}
      >
        {/* Wordmark — display treatment from --type-display
            (34px / 700 / -0.025em / slate-100). Bumped to 2.5rem at sm+
            because this is a hero moment. */}
        <Typography
          component="div"
          sx={{
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: { xs: '2rem', sm: '2.5rem' },
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            color: colors.fg,
            userSelect: 'none',
          }}
        >
          JournoTrades
        </Typography>

        {/* Progress + eyebrow caption */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2, // 16px between bar and caption
          }}
        >
          {/* Pill progress on a hairline track. Violet fill is the only
              saturated color on the surface — the Trader Violet rule. */}
          <Box
            sx={{
              width: { xs: 220, sm: 280 },
              height: 3,
              borderRadius: 999,
              bgcolor: colors.divider,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progress}%`,
                borderRadius: 999,
                bgcolor: colors.violet,
                transition: 'width 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </Box>

          {/* Eyebrow caption — uppercase tracked label, slate-500. */}
          <Box sx={{ minHeight: 14, display: 'flex', alignItems: 'center' }}>
            <Typography
              component="span"
              sx={{
                fontFamily: 'inherit',
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: colors.fgTertiary,
                fontFeatureSettings: "'tnum' on, 'lnum' on",
              }}
            >
              {loadingText}
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 18,
                  textAlign: 'left',
                  ml: 0.25,
                }}
              >
                {dots}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AppLoadingProgress;
