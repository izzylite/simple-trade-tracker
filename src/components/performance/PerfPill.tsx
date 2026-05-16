import React from 'react';
import { Box } from '@mui/material';
import { perfTokens as t } from './performanceTokens';

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
  const padY = size === 'small' ? 6 : 7;
  const padX = size === 'small' ? 11 : 13;
  const font = size === 'small' ? '0.78rem' : '0.8rem';

  return (
    <Box
      role="tablist"
      sx={{
        display: 'inline-flex',
        gap: '4px',
        padding: '4px',
        borderRadius: `${t.radius.pill}px`,
        border: `1px solid ${t.hair}`,
        bgcolor: t.bgAlt,
        width: fullWidth ? '100%' : 'fit-content',
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
              background: active ? t.violet : 'transparent',
              border: 0,
              color: active ? t.fg : t.fgMute,
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: font,
              padding: `${padY}px ${padX}px`,
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'color 150ms, background 150ms',
              '&:hover': {
                color: t.fg,
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
