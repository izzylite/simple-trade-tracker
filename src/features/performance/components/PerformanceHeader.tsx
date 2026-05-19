import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { format } from 'date-fns';
import PerfPill, { PerfPillOption } from 'features/performance/components/PerfPill';
import { TimePeriod } from 'features/performance/components/PerformanceCharts';
import PeriodPicker from 'features/performance/components/PeriodPicker';
import { EYEBROW_SX } from 'styles/designTokens';

const PILL_OPTIONS: ReadonlyArray<PerfPillOption<TimePeriod>> = [
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'YTD', value: 'ytd' },
  { label: 'Year', value: 'year' },
  { label: 'All', value: 'all' },
];

interface PerformanceHeaderProps {
  calendarName?: string;
  selectedDate?: Date;
  onSelectedDateChange?: (next: Date) => void;
  timePeriod: TimePeriod;
  onTimePeriodChange: (next: TimePeriod) => void;
  /** Optional subtitle suffix (e.g. "47 trades · 21 sessions"). */
  subtitleSuffix?: string;
}

function formatPeriod(period: TimePeriod, date: Date): string {
  switch (period) {
    case 'month':
      return format(date, 'MMMM yyyy');
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `Q${q} ${date.getFullYear()}`;
    }
    case 'ytd':
      return `YTD ${date.getFullYear()}`;
    case 'year':
      return format(date, 'yyyy');
    case 'all':
      return 'All time';
  }
}

const PerformanceHeader: React.FC<PerformanceHeaderProps> = ({
  calendarName,
  selectedDate,
  onSelectedDateChange,
  timePeriod,
  onTimePeriodChange,
  subtitleSuffix,
}) => {
  const theme = useTheme();
  const date = selectedDate || new Date();
  const title = formatPeriod(timePeriod, date);
  const subParts = [calendarName, subtitleSuffix].filter(Boolean) as string[];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={EYEBROW_SX}>Performance</Typography>
        <Typography
          component="h1"
          sx={{
            fontWeight: 700,
            fontSize: '1.85rem',
            letterSpacing: '-0.025em',
            color: theme.palette.text.primary,
            mt: '6px',
            mb: 0,
            lineHeight: 1.15,
          }}
        >
          {title}
        </Typography>
        {subParts.length > 0 && (
          <Typography
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.875rem',
              mt: '6px',
              lineHeight: 1.4,
            }}
          >
            {subParts.join(' · ')}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {onSelectedDateChange && (
          <PeriodPicker period={timePeriod} value={date} onChange={onSelectedDateChange} />
        )}
        <PerfPill<TimePeriod>
          options={PILL_OPTIONS}
          value={timePeriod}
          onChange={onTimePeriodChange}
          size="small"
        />
      </Box>
    </Box>
  );
};

export default PerformanceHeader;
