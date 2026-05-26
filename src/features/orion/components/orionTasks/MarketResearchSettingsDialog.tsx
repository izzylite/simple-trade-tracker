// Modal dialog for Market Research task creation and editing. Replaces the
// inline panel — the dialog overlay was preferred over inline expansion
// because the form is dense (5 fields, autocompletes with large catalogs) and
// the inline mount competed with the result-feed scroll region for vertical
// space.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { ManageSearch as ManageSearchIcon } from '@mui/icons-material';

import BaseDialog from 'components/common/BaseDialog';
import type {
  AlertFrequency,
  AlertMinSignificance,
  MarketResearchConfig,
  OrionTask,
} from 'features/orion/types/orionTask';
import {
  MAX_MACRO_QUERIES,
  MARKET_OPTIONS,
  YAHOO_SYMBOL_CATALOG,
  formatFrequencyLabel,
  hydrateMarketResearchConfig,
  type YahooSymbolOption,
} from 'features/orion/components/orionTasks/marketResearchHelpers';
import {
  filterMacroQueries,
  type MacroQueryEntry,
  type Market,
} from 'features/orion/data/macroQueryCatalog';
import { getMacroQueryCatalog } from 'features/orion/services/macroQueryCatalogService';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { logger } from 'utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketResearchSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  existingTask: OrionTask | null;
  onSave: (config: MarketResearchConfig) => Promise<void>;
}

// ---------------------------------------------------------------------------
// FieldGroup — local layout helper
// ---------------------------------------------------------------------------

const FieldGroup: React.FC<{
  label: string;
  helper?: string;
  children: React.ReactNode;
}> = ({ label, helper, children }) => {
  const { monoLabelSx } = useDialogTokens();
  return (
    <Box>
      <Typography sx={{ ...monoLabelSx, mb: 0.75 }}>{label}</Typography>
      {children}
      {helper && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCY_OPTIONS: Array<{ value: AlertFrequency; label: string }> = [
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
  { value: 360, label: '6h' },
  { value: 1440, label: '24h' },
];

const SIGNIFICANCE_OPTIONS: Array<{ value: AlertMinSignificance; label: string }> = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

// ---------------------------------------------------------------------------
// Helper: prune macros that no longer match markets/watchlist
// ---------------------------------------------------------------------------

function pruneOrphanedMacros(
  catalog: MacroQueryEntry[],
  nextMarkets: Market[],
  nextWatchlist: string[],
  currentMacros: string[],
): string[] {
  if (catalog.length === 0) return currentMacros;
  const allCatalogQueries = new Set(catalog.map((e) => e.query));
  const allowed = new Set(
    filterMacroQueries(catalog, nextMarkets, nextWatchlist).map((e) => e.query),
  );
  return currentMacros.filter((q) => !allCatalogQueries.has(q) || allowed.has(q));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MarketResearchSettingsDialog: React.FC<MarketResearchSettingsDialogProps> = ({
  open,
  onClose,
  existingTask,
  onSave,
}) => {
  const theme = useTheme();
  const {
    violet, violetSoft, violetBorder,
    hairline, surfaceInset,
    chipStyle, inputSx,
  } = useDialogTokens();

  const isEditMode = existingTask !== null;

  const [config, setConfig] = useState<MarketResearchConfig>(() =>
    hydrateMarketResearchConfig(
      isEditMode ? (existingTask.config as unknown as Record<string, unknown>) : {},
    ),
  );
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<MacroQueryEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Re-hydrate when the dialog opens with a different existingTask. Without
  // this, switching from "edit task A" → close → "edit task B" would show A's
  // stale config. Also handles the create → edit transition (open with a task
  // that wasn't there on mount).
  useEffect(() => {
    if (!open) return;
    setConfig(
      hydrateMarketResearchConfig(
        existingTask
          ? (existingTask.config as unknown as Record<string, unknown>)
          : {},
      ),
    );
  }, [open, existingTask]);

  useEffect(() => {
    let cancelled = false;
    getMacroQueryCatalog()
      .then((entries) => { if (!cancelled) setCatalog(entries); })
      .catch((err) => logger.error('Failed to load macro query catalog', err))
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const availableMacroQueries = useMemo(
    () => filterMacroQueries(catalog, config.markets as Market[], config.watchlist_symbols),
    [catalog, config.markets, config.watchlist_symbols],
  );

  const selectedMacroEntries = useMemo(() => {
    const byQuery = new Map(catalog.map((e) => [e.query, e]));
    return (config.macro_queries ?? []).map(
      (q) => byQuery.get(q) ?? {
        id: `legacy:${q}`, query: q,
        markets: [] as Market[], isMarketWide: false,
        symbols: [], category: 'Custom (legacy)', displayOrder: 0,
      },
    );
  }, [catalog, config.macro_queries]);

  const atMacroLimit = (config.macro_queries ?? []).length >= MAX_MACRO_QUERIES;
  const canSave = config.watchlist_symbols.length > 0;

  // Segmented chip button — shared shape for Frequency + Significance fields
  const segChipSx = (selected: boolean) => ({
    ...chipStyle(selected),
    border: 'none',
    '&:focus-visible': { outline: `2px solid ${violet}`, outlineOffset: 2 },
  });

  const toggleMarket = (value: string) => {
    const next = config.markets.includes(value)
      ? config.markets.filter((m) => m !== value)
      : [...config.markets, value];
    const macros = pruneOrphanedMacros(catalog, next as Market[], config.watchlist_symbols, config.macro_queries);
    setConfig({ ...config, markets: next, macro_queries: macros });
  };

  const updateWatchlistSymbols = (symbols: string[]) => {
    const macros = pruneOrphanedMacros(catalog, config.markets as Market[], symbols, config.macro_queries);
    setConfig({ ...config, watchlist_symbols: symbols, macro_queries: macros });
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(config);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={isEditMode ? 'Edit Market Research' : 'Set Up Market Research'}
      headerIcon={<ManageSearchIcon sx={{ fontSize: 20 }} />}
      primaryButtonText={isEditMode ? 'Save' : 'Set Up'}
      primaryButtonAction={handleSave}
      isSubmitting={saving}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Markets */}
        <FieldGroup label="Markets">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {MARKET_OPTIONS.map((m) => (
              <Box key={m.value} component="button" onClick={() => toggleMarket(m.value)} sx={segChipSx(config.markets.includes(m.value))}>
                {m.label}
              </Box>
            ))}
          </Box>
        </FieldGroup>

        {/* Frequency */}
        <FieldGroup label="Frequency" helper={`Orion sweeps every ${formatFrequencyLabel(config.frequency_minutes)}`}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <Box key={opt.value} component="button" onClick={() => setConfig({ ...config, frequency_minutes: opt.value })} sx={segChipSx(config.frequency_minutes === opt.value)}>
                {opt.label}
              </Box>
            ))}
          </Box>
        </FieldGroup>

        {/* Minimum significance */}
        <FieldGroup label="Minimum significance" helper="Only catalysts at or above this level trigger a briefing.">
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {SIGNIFICANCE_OPTIONS.map((opt) => (
              <Box key={opt.value} component="button" onClick={() => setConfig({ ...config, min_significance: opt.value })} sx={segChipSx(config.min_significance === opt.value)}>
                {opt.label}
              </Box>
            ))}
          </Box>
        </FieldGroup>

        {/* Watchlist symbols */}
        <FieldGroup label="Watchlist symbols" helper="Required. Drives price grounding, per-instrument news, and currency filtering.">
          <Autocomplete<YahooSymbolOption, true>
            multiple
            size="small"
            options={YAHOO_SYMBOL_CATALOG}
            groupBy={(o) => o.group}
            getOptionLabel={(o) => `${o.label} (${o.symbol})`}
            isOptionEqualToValue={(a, b) => a.symbol === b.symbol}
            value={YAHOO_SYMBOL_CATALOG.filter((o) => config.watchlist_symbols.includes(o.symbol))}
            onChange={(_, v) => updateWatchlistSymbols(v.map((o) => o.symbol))}
            renderTags={(value, getTagProps) =>
              value.map((opt, i) => (
                <Chip
                  {...getTagProps({ index: i })}
                  key={opt.symbol}
                  label={opt.label}
                  size="small"
                  sx={{
                    height: 22, fontSize: '0.74rem', fontWeight: 600,
                    backgroundColor: violetSoft, color: violet,
                    border: `1px solid ${violetBorder}`, fontFamily: MONO_FONT,
                    '& .MuiChip-deleteIcon': { color: alpha(violet, 0.7), fontSize: 14, '&:hover': { color: violet } },
                  }}
                />
              ))
            }
            renderOption={(props, opt) => (
              <li {...props} key={opt.symbol}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{opt.label}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontFamily: MONO_FONT, fontSize: '0.72rem' }}>{opt.symbol}</Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search instruments…"
                error={config.watchlist_symbols.length === 0}
                helperText={config.watchlist_symbols.length === 0 ? 'Pick at least one instrument.' : undefined}
                sx={inputSx}
              />
            )}
          />
        </FieldGroup>

        {/* Macro queries */}
        <FieldGroup label="Macro queries" helper={`Pick up to ${MAX_MACRO_QUERIES} catalysts to monitor. Catalog filtered by selected markets.`}>
          <Autocomplete<MacroQueryEntry, true>
            multiple
            size="small"
            loading={catalogLoading}
            options={availableMacroQueries}
            groupBy={(opt) => opt.category}
            getOptionLabel={(opt) => opt.query}
            isOptionEqualToValue={(a, b) => a.query === b.query}
            getOptionDisabled={(opt) => atMacroLimit && !(config.macro_queries ?? []).includes(opt.query)}
            value={selectedMacroEntries}
            onChange={(_, v) => setConfig({ ...config, macro_queries: v.slice(0, MAX_MACRO_QUERIES).map((e) => e.query) })}
            loadingText={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption">Loading catalog…</Typography>
              </Box>
            }
            renderTags={(value, getTagProps) =>
              value.map((opt, i) => {
                const isLegacy = opt.id.startsWith('legacy:');
                return (
                  <Chip
                    {...getTagProps({ index: i })}
                    key={opt.query}
                    label={opt.query}
                    size="small"
                    sx={{
                      height: 24, fontSize: '0.74rem', fontWeight: 500,
                      backgroundColor: isLegacy ? alpha(theme.palette.warning.main, 0.12) : surfaceInset,
                      color: isLegacy ? theme.palette.warning.main : theme.palette.text.primary,
                      border: `1px solid ${isLegacy ? alpha(theme.palette.warning.main, 0.4) : hairline}`,
                      fontFamily: MONO_FONT,
                      '& .MuiChip-deleteIcon': { color: alpha(theme.palette.text.secondary, 0.6), fontSize: 14, '&:hover': { color: theme.palette.text.primary } },
                    }}
                  />
                );
              })
            }
            renderOption={(props, opt) => (
              <li {...props} key={opt.id}>
                <Typography sx={{ fontSize: '0.85rem' }}>{opt.query}</Typography>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={atMacroLimit ? `Limit reached (${MAX_MACRO_QUERIES})` : 'Search catalog…'}
                sx={inputSx}
              />
            )}
          />
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.disabled' }}>
            {(config.macro_queries ?? []).length}/{MAX_MACRO_QUERIES} selected
          </Typography>
        </FieldGroup>

      </Box>
    </BaseDialog>
  );
};

export default MarketResearchSettingsDialog;
