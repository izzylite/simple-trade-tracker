/**
 * Economic Calendar Filters Component
 * Compact redesign: chip toggles, scrollable area, minimal padding
 */

import React from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Chip,
  Button,
  Collapse,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { startOfMonth } from 'date-fns';
import { Currency, ImpactLevel } from '../../types/economicCalendar';

const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
const IMPACTS: ImpactLevel[] = ['High', 'Medium', 'Low'];

interface EconomicCalendarFiltersProps {
  isExpanded: boolean;
  currentDate: Date;
  pendingCurrencies: Currency[];
  pendingImpacts: ImpactLevel[];
  pendingOnlyUpcoming: boolean;
  filtersModified: boolean;
  loading: boolean;
  onCurrencyChange: (currency: Currency) => void;
  onImpactChange: (impact: ImpactLevel) => void;
  onUpcomingEventsChange: (checked: boolean) => void;
  onMonthChange: (date: Date | null) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

const EconomicCalendarFilters: React.FC<EconomicCalendarFiltersProps> = ({
  isExpanded,
  currentDate,
  pendingCurrencies,
  pendingImpacts,
  pendingOnlyUpcoming,
  filtersModified,
  loading,
  onCurrencyChange,
  onImpactChange,
  onUpcomingEventsChange,
  onMonthChange,
  onApplyFilters,
  onResetFilters,
}) => {
  const theme = useTheme();

  return (
    <Collapse in={isExpanded}>
      <Box sx={{
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}>

        {/* Month */}
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
            Month
          </Typography>
          <DatePicker
            value={startOfMonth(currentDate)}
            onChange={onMonthChange}
            views={['year', 'month']}
            openTo="month"
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
                sx: {
                  mt: 0.75,
                  '& .MuiInputBase-root': {
                    borderRadius: 1.5,
                    fontSize: '0.8rem',
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: alpha(theme.palette.primary.main, 0.25) },
                    '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.5) },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                  },
                  '& input': { py: 0.75 },
                  '& .MuiInputAdornment-root .MuiIconButton-root': {
                    padding: '4px',
                    '& svg': { fontSize: '1rem' },
                  },
                },
              },
              desktopPaper: {
                sx: {
                  fontSize: '0.75rem',
                  overflow: 'hidden',
                  '& .MuiPickersLayout-root': { minWidth: 'unset' },
                  '& .MuiPickersLayout-contentWrapper': { gridRow: 1, pb: 0 },
                  '& .MuiPickersCalendarHeader-root': { minHeight: 36, pl: 1.5, pr: 0.5 },
                  '& .MuiPickersCalendarHeader-label': { fontSize: '0.8rem', fontWeight: 600 },
                  '& .MuiDateCalendar-root': { height: 'auto', minHeight: 'unset' },
                  '& .MuiMonthCalendar-root': {
                    width: 'auto', pt: '4px', px: '8px', pb: '4px',
                    height: 'auto',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                  },
                  '& .MuiPickersMonth-monthButton': {
                    fontSize: '0.75rem',
                    height: 32,
                    margin: '2px 0',
                  },
                  '& .MuiYearCalendar-root': { width: 'auto' },
                  '& .MuiPickersYear-yearButton': { fontSize: '0.75rem', height: 28 },
                },
              },
            }}
          />
        </Box>

        <Divider sx={{ opacity: 0.4 }} />

        {/* Currencies */}
        <Box sx={{ px: 2, pt: 1.25, pb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
            Currencies
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
            {CURRENCIES.map((currency) => {
              const selected = pendingCurrencies.includes(currency);
              return (
                <Chip
                  key={currency}
                  label={currency}
                  size="small"
                  onClick={() => onCurrencyChange(currency)}
                  sx={{
                    height: 22,
                    fontSize: '0.72rem',
                    fontWeight: selected ? 700 : 400,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.divider, 0.08),
                    color: selected ? 'primary.main' : 'text.secondary',
                    border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.4) : 'transparent'}`,
                    '&:hover': {
                      bgcolor: selected ? alpha(theme.palette.primary.main, 0.25) : alpha(theme.palette.divider, 0.15),
                    },
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ opacity: 0.4 }} />

        {/* Impact */}
        <Box sx={{ px: 2, pt: 1.25, pb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
            Impact
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
            {IMPACTS.map((impact) => {
              const selected = pendingImpacts.includes(impact);
              const color = impact === 'High' ? theme.palette.error.main : impact === 'Medium' ? theme.palette.warning.main : theme.palette.success.main;
              return (
                <Chip
                  key={impact}
                  label={impact}
                  size="small"
                  onClick={() => onImpactChange(impact)}
                  sx={{
                    height: 22,
                    fontSize: '0.72rem',
                    fontWeight: selected ? 700 : 400,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(color, 0.18) : alpha(theme.palette.divider, 0.08),
                    color: selected ? color : 'text.secondary',
                    border: `1px solid ${selected ? alpha(color, 0.4) : 'transparent'}`,
                    '&:hover': {
                      bgcolor: selected ? alpha(color, 0.25) : alpha(theme.palette.divider, 0.15),
                    },
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ opacity: 0.4 }} />

        {/* Upcoming events */}
        <Box sx={{ px: 1.5, py: 0.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={pendingOnlyUpcoming}
                onChange={(e) => onUpcomingEventsChange(e.target.checked)}
                size="small"
                sx={{ color: 'primary.main', '&.Mui-checked': { color: 'primary.main' }, p: 0.75 }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.78rem' }}>
                  Upcoming only
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                  (future dates)
                </Typography>
              </Box>
            }
            sx={{ mx: 0 }}
          />
        </Box>

        <Divider sx={{ opacity: 0.4 }} />

        {/* Actions */}
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
            {pendingCurrencies.length}c · {pendingImpacts.length}i{pendingOnlyUpcoming ? ' · upcoming' : ''}
            {filtersModified && (
              <Box component="span" sx={{ color: 'warning.main', ml: 0.5 }}>· unsaved</Box>
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Button
              onClick={onResetFilters}
              size="small"
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 500, px: 1.5, py: 0.25, fontSize: '0.75rem', minWidth: 0 }}
            >
              Reset
            </Button>
            <Button
              onClick={onApplyFilters}
              size="small"
              variant="contained"
              disabled={!filtersModified}
              startIcon={loading ? <CircularProgress size={12} /> : undefined}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, px: 1.5, py: 0.25, fontSize: '0.75rem', minWidth: 0 }}
            >
              Apply
            </Button>
          </Box>
        </Box>

      </Box>
    </Collapse>
  );
};

export default EconomicCalendarFilters;
