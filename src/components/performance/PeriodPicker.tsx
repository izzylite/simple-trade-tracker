import React, { useMemo, useRef, useState } from 'react';
import { Box, Popover } from '@mui/material';
import { format, addMonths, addQuarters, addYears, startOfQuarter, startOfYear, startOfMonth } from 'date-fns';
import { TimePeriod } from '../PerformanceCharts';
import { perfTokens as t } from './performanceTokens';

interface PeriodPickerProps {
  period: TimePeriod;
  value: Date;
  onChange: (next: Date) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLabel(period: TimePeriod, date: Date): string {
  switch (period) {
    case 'month':
      return format(date, 'MMM yyyy');
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    case 'ytd':
      return `YTD ${date.getFullYear()}`;
    case 'year':
      return format(date, 'yyyy');
    case 'all':
      return 'All time';
  }
}

function stepPeriod(period: TimePeriod, date: Date, direction: 1 | -1): Date {
  switch (period) {
    case 'month':
      return startOfMonth(addMonths(date, direction));
    case 'quarter':
      return startOfQuarter(addQuarters(date, direction));
    case 'ytd':
    case 'year':
      return startOfYear(addYears(date, direction));
    case 'all':
      return date;
  }
}

const ArrowBtn: React.FC<{ disabled?: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode; ariaLabel: string }> = ({
  disabled,
  onClick,
  children,
  ariaLabel,
}) => (
  <Box
    component="button"
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
    sx={{
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 0,
      color: disabled ? t.fgLow : t.fgMute,
      cursor: disabled ? 'default' : 'pointer',
      borderRadius: '6px',
      fontFamily: 'inherit',
      fontSize: '0.95rem',
      fontWeight: 600,
      transition: 'color 150ms, background 150ms',
      '&:hover': disabled
        ? undefined
        : { color: t.fg, background: 'rgba(255,255,255,0.04)' },
    }}
  >
    {children}
  </Box>
);

const PeriodPicker: React.FC<PeriodPickerProps> = ({ period, value, onChange }) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  // year shown in the popover (independent of value while browsing)
  const [browseYear, setBrowseYear] = useState<number>(value.getFullYear());

  const label = useMemo(() => formatLabel(period, value), [period, value]);
  const disabled = period === 'all';

  const handleOpen = () => {
    if (disabled) return;
    setBrowseYear(value.getFullYear());
    setOpen(true);
  };
  const handleClose = () => setOpen(false);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(stepPeriod(period, value, -1));
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(stepPeriod(period, value, 1));
  };

  const pickMonth = (monthIdx: number) => {
    onChange(new Date(browseYear, monthIdx, 1));
    setOpen(false);
  };
  const pickQuarter = (qIdx: number) => {
    onChange(new Date(browseYear, qIdx * 3, 1));
    setOpen(false);
  };
  const pickYear = (year: number) => {
    onChange(new Date(year, value.getMonth(), 1));
    setOpen(false);
  };

  const renderBody = () => {
    if (period === 'month') {
      const currentMonth = value.getMonth();
      const currentYear = value.getFullYear();
      return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {MONTHS.map((m, idx) => {
            const isCurrent = browseYear === currentYear && idx === currentMonth;
            return (
              <Box
                key={m}
                component="button"
                onClick={() => pickMonth(idx)}
                sx={{
                  py: 1,
                  px: 1.5,
                  background: isCurrent ? t.violet : 'transparent',
                  color: isCurrent ? t.fg : t.fgMute,
                  border: 0,
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  '&:hover': { background: isCurrent ? t.violet : 'rgba(255,255,255,0.06)', color: t.fg },
                }}
              >
                {m}
              </Box>
            );
          })}
        </Box>
      );
    }
    if (period === 'quarter') {
      const currentQ = Math.floor(value.getMonth() / 3);
      const currentYear = value.getFullYear();
      return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
          {[0, 1, 2, 3].map((q) => {
            const isCurrent = browseYear === currentYear && q === currentQ;
            return (
              <Box
                key={q}
                component="button"
                onClick={() => pickQuarter(q)}
                sx={{
                  py: 1.25,
                  px: 1.5,
                  background: isCurrent ? t.violet : 'transparent',
                  color: isCurrent ? t.fg : t.fgMute,
                  border: 0,
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  '&:hover': { background: isCurrent ? t.violet : 'rgba(255,255,255,0.06)', color: t.fg },
                }}
              >
                {`Q${q + 1}`}
              </Box>
            );
          })}
        </Box>
      );
    }
    // year + ytd both use a year list
    const currentYear = value.getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 6; y <= currentYear + 1; y++) years.push(y);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
        {years.map((y) => {
          const isCurrent = y === currentYear;
          return (
            <Box
              key={y}
              component="button"
              onClick={() => pickYear(y)}
              sx={{
                py: 1,
                px: 1.5,
                background: isCurrent ? t.violet : 'transparent',
                color: isCurrent ? t.fg : t.fgMute,
                border: 0,
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                '&:hover': { background: isCurrent ? t.violet : 'rgba(255,255,255,0.06)', color: t.fg },
              }}
            >
              {y}
            </Box>
          );
        })}
      </Box>
    );
  };

  // For month + quarter views, show a browseYear stepper at the top
  const showYearStepper = period === 'month' || period === 'quarter';

  return (
    <>
      <Box
        ref={anchorRef}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '2px',
          borderRadius: `${t.radius.pill}px`,
          border: `1px solid ${t.hair}`,
          bgcolor: t.bgAlt,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <ArrowBtn ariaLabel="Previous period" disabled={disabled} onClick={handlePrev}>
          ‹
        </ArrowBtn>
        <Box
          component="button"
          onClick={handleOpen}
          disabled={disabled}
          sx={{
            minWidth: 96,
            background: 'transparent',
            border: 0,
            color: t.fg,
            fontFamily: 'inherit',
            fontWeight: 600,
            fontSize: '0.82rem',
            padding: '6px 10px',
            borderRadius: '7px',
            cursor: disabled ? 'default' : 'pointer',
            fontFeatureSettings: t.fontFeatures.tabular,
            transition: 'background 150ms',
            '&:hover': disabled ? undefined : { background: 'rgba(255,255,255,0.04)' },
          }}
        >
          {label}
        </Box>
        <ArrowBtn ariaLabel="Next period" disabled={disabled} onClick={handleNext}>
          ›
        </ArrowBtn>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              bgcolor: t.bgPaper,
              border: `1px solid ${t.hair}`,
              borderRadius: '12px',
              boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
              minWidth: 220,
              p: 1.25,
            },
          },
        }}
      >
        {showYearStepper && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 0.75,
              px: 0.5,
            }}
          >
            <ArrowBtn ariaLabel="Previous year" onClick={() => setBrowseYear((y) => y - 1)}>
              ‹
            </ArrowBtn>
            <Box sx={{ color: t.fg, fontWeight: 700, fontSize: '0.9rem', fontFeatureSettings: t.fontFeatures.tabular }}>
              {browseYear}
            </Box>
            <ArrowBtn ariaLabel="Next year" onClick={() => setBrowseYear((y) => y + 1)}>
              ›
            </ArrowBtn>
          </Box>
        )}
        {renderBody()}
      </Popover>
    </>
  );
};

export default PeriodPicker;
