/**
 * Economic Calendar Filters Component
 * Provides filtering options for economic events
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Button,
  Grid,
  useTheme,
  SelectChangeEvent
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import {
  EconomicCalendarFilters as FiltersType,
  Currency,
  ImpactLevel,
  CURRENCY_FLAGS,
  IMPACT_COLORS,
  DEFAULT_FILTERS
} from '../../types/economicCalendar';

interface EconomicCalendarFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  compact?: boolean;
}

const MENU_PROPS = {
  PaperProps: {
    style: {
      maxHeight: 224,
      width: 250,
    },
  },
};

const EconomicCalendarFilters: React.FC<EconomicCalendarFiltersProps> = ({
  filters,
  onFiltersChange,
  compact = false
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!compact);

  const handleCurrencyChange = (event: SelectChangeEvent<Currency[]>) => {
    const value = event.target.value as Currency[];
    onFiltersChange({
      ...filters,
      currencies: value
    });
  };

  const handleImpactChange = (event: SelectChangeEvent<ImpactLevel[]>) => {
    const value = event.target.value as ImpactLevel[];
    onFiltersChange({
      ...filters,
      impacts: value
    });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchTerm: event.target.value
    });
  };

  const handleDateRangeChange = (field: 'start' | 'end') => (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: event.target.value
      }
    });
  };

  const handleShowPastEventsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      showPastEvents: event.target.checked
    });
  };

  const handleResetFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  // Quick filter presets
  const handleQuickFilter = (preset: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    switch (preset) {
      case 'high-impact':
        onFiltersChange({
          ...filters,
          impacts: ['High'],
          dateRange: { start: today, end: nextWeek }
        });
        break;
      case 'eur-usd':
        onFiltersChange({
          ...filters,
          currencies: ['EUR', 'USD'],
          dateRange: { start: today, end: nextWeek }
        });
        break;
      case 'major-currencies':
        onFiltersChange({
          ...filters,
          currencies: ['EUR', 'USD', 'GBP', 'JPY'],
          dateRange: { start: today, end: nextWeek }
        });
        break;
      case 'today':
        onFiltersChange({
          ...filters,
          dateRange: { start: today, end: today }
        });
        break;
      case 'this-week':
        onFiltersChange({
          ...filters,
          dateRange: { start: today, end: nextWeek }
        });
        break;
    }
  };

  const hasActiveFilters = () => {
    return (
      filters.searchTerm ||
      filters.currencies.length !== DEFAULT_FILTERS.currencies.length ||
      filters.impacts.length !== DEFAULT_FILTERS.impacts.length ||
      filters.showPastEvents !== DEFAULT_FILTERS.showPastEvents ||
      filters.dateRange.start !== DEFAULT_FILTERS.dateRange.start ||
      filters.dateRange.end !== DEFAULT_FILTERS.dateRange.end
    );
  };

  const renderCurrencyChip = (value: Currency) => (
    <Chip
      key={value}
      label={`${CURRENCY_FLAGS[value]} ${value}`}
      size="small"
      sx={{ m: 0.5 }}
    />
  );

  const renderImpactChip = (value: ImpactLevel) => (
    <Chip
      key={value}
      label={value}
      size="small"
      sx={{
        m: 0.5,
        backgroundColor: IMPACT_COLORS[value],
        color: 'white',
        fontWeight: 600
      }}
    />
  );

  const filterContent = (
    <Box>
      <Grid container spacing={2}>
        {/* Quick Filter Buttons */}
        <Grid size={12}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter('today')}
              sx={{ minWidth: 'auto' }}
            >
              Today
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter('this-week')}
              sx={{ minWidth: 'auto' }}
            >
              This Week
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter('high-impact')}
              sx={{ minWidth: 'auto', color: IMPACT_COLORS.High, borderColor: IMPACT_COLORS.High }}
            >
              🔴 High Impact
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter('eur-usd')}
              sx={{ minWidth: 'auto' }}
            >
              🇪🇺🇺🇸 EUR/USD
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter('major-currencies')}
              sx={{ minWidth: 'auto' }}
            >
              Major Pairs
            </Button>
          </Box>
        </Grid>

        {/* Search */}
        <Grid size={12}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search events..."
            value={filters.searchTerm || ''}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            }}
          />
        </Grid>

        {/* Currencies */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Currencies</InputLabel>
            <Select
              multiple
              value={filters.currencies}
              onChange={handleCurrencyChange}
              input={<OutlinedInput label="Currencies" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map(renderCurrencyChip)}
                </Box>
              )}
              MenuProps={MENU_PROPS}
            >
              {(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'] as Currency[]).map((currency) => (
                <MenuItem key={currency} value={currency}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography sx={{ fontSize: '1.2em' }}>
                      {CURRENCY_FLAGS[currency]}
                    </Typography>
                    <Typography>{currency}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Impact Levels */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Impact Levels</InputLabel>
            <Select
              multiple
              value={filters.impacts}
              onChange={handleImpactChange}
              input={<OutlinedInput label="Impact Levels" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map(renderImpactChip)}
                </Box>
              )}
              MenuProps={MENU_PROPS}
            >
              {(['High', 'Medium', 'Low', 'Holiday', 'Non-Economic'] as ImpactLevel[]).map((impact) => (
                <MenuItem key={impact} value={impact}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: IMPACT_COLORS[impact]
                      }}
                    />
                    <Typography>{impact}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Date Range */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="Start Date"
            value={filters.dateRange.start}
            onChange={handleDateRangeChange('start')}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="End Date"
            value={filters.dateRange.end}
            onChange={handleDateRangeChange('end')}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        {/* Options */}
        <Grid size={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={filters.showPastEvents || false}
                  onChange={handleShowPastEventsChange}
                  size="small"
                />
              }
              label="Show past events"
            />
            
            {hasActiveFilters() && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleResetFilters}
                color="secondary"
              >
                Reset Filters
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  if (compact) {
    return (
      <Accordion 
        expanded={expanded} 
        onChange={(_, isExpanded) => setExpanded(isExpanded)}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterIcon color="primary" />
            <Typography variant="subtitle2">
              Filters
            </Typography>
            {hasActiveFilters() && (
              <Chip 
                label="Active" 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {filterContent}
        </AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        backgroundColor: 'background.paper',
        mb: 2
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <FilterIcon color="primary" />
        <Typography variant="subtitle2" fontWeight={600}>
          Filter Events
        </Typography>
        {hasActiveFilters() && (
          <Chip 
            label="Active" 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        )}
      </Box>
      {filterContent}
    </Box>
  );
};

export default EconomicCalendarFilters;
