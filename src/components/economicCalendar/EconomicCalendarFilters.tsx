/**
 * Economic Calendar Filters Component
 * Extracted from EconomicCalendarDrawer for better readability
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
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  TextField,
  Paper,
  Stack
} from '@mui/material';
import { format } from 'date-fns';
import {
  Currency,
  ImpactLevel
} from '../../types/economicCalendar';

// Available currencies and impacts
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
  onMonthChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  onResetFilters
}) => {
  const theme = useTheme();

  return (
    <Collapse in={isExpanded}>
      <Box sx={{ px: 3, pb: 3, mt: 1, overflow: 'auto' }}>
        <Stack spacing={3}>
          {/* Month Picker */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ 
                mb: 1.5, 
                fontSize: '0.875rem', 
                fontWeight: 600,
                color: 'text.primary'
              }}>
                Month Filter
              </FormLabel>
              <TextField
                label="Select Month"
                type="month"
                value={format(currentDate, 'yyyy-MM')}
                onChange={onMonthChange}
                size="small"
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    borderRadius: 1.5,
                  },
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            </FormControl>
          </Paper>

          {/* Currency Filters */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ 
                mb: 1.5, 
                fontSize: '0.875rem', 
                fontWeight: 600,
                color: 'text.primary'
              }}>
                Currencies
              </FormLabel>
              <FormGroup row>
                {CURRENCIES.map((currency) => (
                  <FormControlLabel
                    key={currency}
                    control={
                      <Checkbox
                        checked={pendingCurrencies.includes(currency)}
                        onChange={() => onCurrencyChange(currency)}
                        size="small"
                        sx={{
                          color: 'primary.main',
                          '&.Mui-checked': {
                            color: 'primary.main',
                          },
                        }}
                      />
                    }
                    label={currency}
                    sx={{ 
                      mx: 0,
                      mr: 2,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }
                    }}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Paper>

          {/* Impact Filters */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ 
                mb: 1.5, 
                fontSize: '0.875rem', 
                fontWeight: 600,
                color: 'text.primary'
              }}>
                Impact Levels
              </FormLabel>
              <FormGroup row>
                {IMPACTS.map((impact) => (
                  <FormControlLabel
                    key={impact}
                    control={
                      <Checkbox
                        checked={pendingImpacts.includes(impact)}
                        onChange={() => onImpactChange(impact)}
                        size="small"
                        sx={{
                          color: 'primary.main',
                          '&.Mui-checked': {
                            color: 'primary.main',
                          },
                        }}
                      />
                    }
                    label={impact}
                    sx={{ 
                      mx: 0,
                      mr: 2,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }
                    }}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Paper>

          {/* Time Filter */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ 
                mb: 1.5, 
                fontSize: '0.875rem', 
                fontWeight: 600,
                color: 'text.primary'
              }}>
                Time Filter
              </FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={pendingOnlyUpcoming}
                      onChange={(e) => onUpcomingEventsChange(e.target.checked)}
                      size="small"
                      sx={{
                        color: 'primary.main',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Only Upcoming Events
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        (Future dates only)
                      </Typography>
                    </Box>
                  }
                  sx={{ 
                    mx: 0,
                    '& .MuiFormControlLabel-label': {
                      fontSize: '0.875rem',
                    }
                  }}
                />
              </FormGroup>
            </FormControl>
          </Paper>

          {/* Filter Actions */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {pendingCurrencies.length} currencies, {pendingImpacts.length} impact levels{pendingOnlyUpcoming ? ', upcoming only' : ''}
                </Typography>
                {filtersModified && (
                  <Chip
                    label="Modified"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ 
                      mx: 1,
                      fontSize: '0.75rem',
                      height: 20,
                      '& .MuiChip-label': {
                        px: 1,
                       
                      }
                    }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={onResetFilters}
                  size="small"
                  color="inherit"
                  variant="outlined"
                  sx={{
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 500,
                    px: 2,
                  }}
                >
                  Reset
                </Button>
                <Button
                  onClick={onApplyFilters}
                  size="small"
                  variant="contained"
                  disabled={!filtersModified}
                  startIcon={loading ? <CircularProgress size={16} /> : undefined}
                  sx={{
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                  }}
                >
                  Apply
                </Button>
              </Box>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </Collapse>
  );
};

export default EconomicCalendarFilters;
