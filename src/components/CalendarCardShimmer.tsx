import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Stack,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import Shimmer from './Shimmer';

/**
 * Reusable shimmer loading component for calendar cards
 * Used in Home and CalendarTrash components
 */
const CalendarCardShimmer: React.FC = () => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        width: '350px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-in-out',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0, 
          zIndex: 1
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 2.5 }}>
          {/* Title shimmer */}
          <Shimmer
            height={28}
            width="60%"
            borderRadius={8}
            variant="wave"
            intensity="medium"
            sx={{ mb: 1 }}
          />

          {/* Date shimmer */}
          <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
            <Shimmer
              height={20}
              width="30%"
              borderRadius={4}
              variant="default"
              intensity="low"
            />
            <Shimmer
              height={20}
              width="30%"
              borderRadius={4}
              variant="default"
              intensity="low"
            />
          </Stack>
        </Box>

        <Divider sx={{ my: 2, opacity: 0.6 }} />

        {/* Stats shimmer */}
        <Stack spacing={2}>
          {/* Main stats box with gradient */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              mb: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Shimmer
                height={40}
                width={40}
                borderRadius="50%"
                variant="pulse"
                intensity="medium"
              />
              <Box sx={{ width: '100%' }}>
                <Shimmer
                  height={24}
                  width="40%"
                  borderRadius={6}
                  variant="wave"
                  intensity="high"
                  sx={{ mb: 1 }}
                />
                <Shimmer
                  height={16}
                  width="30%"
                  borderRadius={4}
                  variant="default"
                  intensity="low"
                />
              </Box>
            </Box>
          </Box>

          {/* Grid stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
              <Shimmer
                height={16}
                width="60%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mb: 1 }}
              />
              <Shimmer
                height={24}
                width="40%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
              />
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
              <Shimmer
                height={16}
                width="60%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mb: 1 }}
              />
              <Shimmer
                height={24}
                width="40%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
              />
            </Box>
          </Box>

          {/* Additional stats */}
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
            <Shimmer
              height={16}
              width="40%"
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {[1, 2, 3].map((i) => (
                <Box key={i}>
                  <Shimmer
                    height={14}
                    width="70%"
                    borderRadius={4}
                    variant="default"
                    intensity="low"
                    sx={{ mb: 0.5 }}
                  />
                  <Shimmer
                    height={20}
                    width="50%"
                    borderRadius={6}
                    variant={i === 2 ? "pulse" : "default"}
                    intensity="medium"
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{
        justifyContent: 'flex-end',
        p: 2,
        pt: 1,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
      }}>
        {/* Action buttons shimmer */}
        <Stack direction="row" spacing={1}>
          {[1, 2, 3].map((i) => (
            <Shimmer
              key={i}
              height={32}
              width={80}
              borderRadius={8}
              variant={i === 1 ? "pulse" : "default"}
              intensity={i === 1 ? "high" : "medium"}
            />
          ))}
        </Stack>
      </CardActions>
    </Card>
  );
};

export default CalendarCardShimmer;

