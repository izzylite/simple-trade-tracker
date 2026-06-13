// Numbered step indicator — violet circles connected by hairlines,
// mono uppercase labels. Mirrors the import dialog's step rail visually
// so the two wizards feel like the same family of dialog.

import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { useIsMobile } from 'hooks/useResponsive';

interface Props {
  steps: readonly string[];
  current: number;
}

const StepRail: React.FC<Props> = ({ steps, current }) => {
  const theme = useTheme();
  const { violet, hairline, surfaceInset } = useDialogTokens();
  // On phones the mono uppercase step labels can't fit four-across at 360px
  // (non-wrapping, letter-spaced). Collapse to numbered circles + connectors
  // and lift the current step's name into a single line above the rail.
  const isMobile = useIsMobile();
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 1.25,
        border: `1px solid ${hairline}`,
        backgroundColor: surfaceInset,
      }}
    >
      {isMobile && (
        <Typography
          sx={{
            fontFamily: MONO_FONT, fontSize: '0.65rem', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: theme.palette.text.primary, mb: 1,
          }}
        >
          {`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        {steps.map((label, idx) => {
          const active = idx === current;
          const completed = idx < current;
          return (
            <React.Fragment key={label}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  component="span"
                  sx={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO_FONT, fontSize: '0.65rem', fontWeight: 700,
                    border: `1.5px solid ${active || completed ? violet : hairline}`,
                    backgroundColor: active ? violet : 'transparent',
                    color: active
                      ? '#fff'
                      : completed
                        ? violet
                        : alpha(theme.palette.text.secondary, 0.6),
                    lineHeight: 1, transition: 'all 120ms ease', flexShrink: 0,
                  }}
                >
                  {completed ? <CheckCircleIcon sx={{ fontSize: 14, color: violet }} /> : idx + 1}
                </Box>
                {!isMobile && (
                  <Typography
                    sx={{
                      fontFamily: MONO_FONT, fontSize: '0.7rem', fontWeight: 500,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: active ? theme.palette.text.primary : alpha(theme.palette.text.secondary, 0.7),
                    }}
                  >
                    {label}
                  </Typography>
                )}
              </Box>
              {idx < steps.length - 1 && (
                <Box
                  sx={{
                    flex: 1, maxWidth: 56, height: '1px',
                    backgroundColor: idx < current ? violet : hairline,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

export default StepRail;
