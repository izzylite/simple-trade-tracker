import React from 'react';
import { Box, useTheme } from '@mui/material';

export interface PerfPillOption<V extends string> {
  label: string;
  value: V;
}

interface PerfPillProps<V extends string> {
  options: ReadonlyArray<PerfPillOption<V>>;
  value: V;
  onChange: (next: V) => void;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

function PerfPill<V extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
  size = 'medium',
}: PerfPillProps<V>) {
  const theme = useTheme();
  const padY = size === 'small' ? 6 : 7;
  const padX = size === 'small' ? 11 : 13;
  const font = size === 'small' ? '0.78rem' : '0.8rem';

  return (
    <Box
      role="tablist"
      sx={{
        display: fullWidth ? 'flex' : 'inline-flex',
        gap: '4px',
        padding: '4px',
        borderRadius: '10px',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        width: fullWidth ? '100%' : 'fit-content',
        // On phones the 5 segments share the row at flex:1; if they still
        // overflow a 320px floor, allow the pill to scroll horizontally
        // rather than push the page wider.
        maxWidth: '100%',
        overflowX: fullWidth ? 'auto' : 'visible',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Box
            key={opt.value}
            component="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            sx={{
              flex: fullWidth ? 1 : 'unset',
              whiteSpace: 'nowrap',
              background: active ? theme.palette.primary.main : 'transparent',
              border: 0,
              color: active ? theme.palette.primary.contrastText : theme.palette.text.secondary,
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: font,
              padding: `${padY}px ${padX}px`,
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'color 150ms cubic-bezier(0.22, 1, 0.36, 1), background 150ms cubic-bezier(0.22, 1, 0.36, 1)',
              '&:hover': {
                color: active ? theme.palette.primary.contrastText : theme.palette.text.primary,
              },
            }}
          >
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

export default PerfPill;
