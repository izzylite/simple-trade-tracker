/**
 * CalendarsPanelShimmer
 *
 * Skeleton used while the calendars-list panel is loading. Rendered in two
 * places so the user sees one continuous shimmer instead of a spinner→
 * shimmer hand-off:
 *
 *   1. AppLayout's Suspense fallback — while the lazy CalendarsListContent
 *      chunk downloads.
 *   2. Inside CalendarsListContent — while useCalendars / useTrashCalendars
 *      fetch from Supabase.
 *
 * Lives in its own eagerly-loaded file (not inside CalendarsListContent)
 * so the Suspense fallback can reference it before the lazy chunk arrives.
 */

import React from 'react';
import { Box, Stack, alpha, useTheme } from '@mui/material';
import Shimmer from 'components/Shimmer';
import { isDarkMode } from 'utils/themeMode';

const CalendarsPanelShimmer: React.FC = () => {
  const theme = useTheme();
  const divider = alpha(theme.palette.common.white, 0.08);
  const surface = alpha(theme.palette.common.white, 0.03);

  return (
    <Stack spacing={1.5}>
      {/* Hero card */}
      <Box
        sx={{
          p: 1.75,
          borderRadius: '4px',
          bgcolor:
            isDarkMode(theme)
              ? surface
              : theme.palette.background.paper,
          border: `1px solid ${
            isDarkMode(theme) ? divider : theme.palette.divider
          }`,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ mb: 1.5 }}
        >
          <Shimmer width={28} height={28} borderRadius={4} variant="wave" />
          <Box sx={{ flex: 1 }}>
            <Shimmer
              width="60%"
              height={12}
              borderRadius={3}
              variant="wave"
              sx={{ mb: 0.5 }}
            />
            <Shimmer
              width="35%"
              height={10}
              borderRadius={3}
              variant="wave"
              intensity="low"
            />
          </Box>
        </Stack>
        <Shimmer
          width="55%"
          height={26}
          borderRadius={4}
          variant="wave"
          sx={{ mb: 1 }}
        />
        <Shimmer
          width="100%"
          height={72}
          borderRadius={4}
          variant="wave"
          intensity="low"
          sx={{ mb: 1.25 }}
        />
        <Shimmer
          width="100%"
          height={28}
          borderRadius={4}
          variant="wave"
          intensity="low"
        />
      </Box>

      {/* Watchlist */}
      <Box
        sx={{
          borderRadius: '4px',
          bgcolor:
            isDarkMode(theme)
              ? surface
              : theme.palette.background.paper,
          border: `1px solid ${
            isDarkMode(theme) ? divider : theme.palette.divider
          }`,
          overflow: 'hidden',
        }}
      >
        {[0, 1, 2, 3,4,5,6,7,8,9].map((i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1.125,
              borderBottom: i === 3 ? 0 : `1px solid ${divider}`,
            }}
          >
            <Shimmer width={28} height={28} borderRadius={4} variant="wave" />
            <Box sx={{ flex: 1 }}>
              <Shimmer
                width="55%"
                height={11}
                borderRadius={3}
                variant="wave"
                sx={{ mb: 0.5 }}
              />
              <Shimmer
                width="30%"
                height={9}
                borderRadius={3}
                variant="wave"
                intensity="low"
              />
            </Box>
            <Shimmer
              width={44}
              height={18}
              borderRadius={3}
              variant="wave"
              intensity="low"
            />
            <Shimmer width={70} height={28} borderRadius={4} variant="wave" />
          </Box>
        ))}
      </Box>
    </Stack>
  );
};

export default CalendarsPanelShimmer;
