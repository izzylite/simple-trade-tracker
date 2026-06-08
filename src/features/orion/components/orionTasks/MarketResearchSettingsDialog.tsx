// Modal dialog for Market Research task creation and editing. Replaces the
// inline panel — the dialog overlay was preferred over inline expansion
// because the form is dense (5 fields, autocompletes with large catalogs) and
// the inline mount competed with the result-feed scroll region for vertical
// space.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Z_INDEX } from 'styles/zIndex';
import { logger } from 'utils/logger';

// TODO(Task 9): Remove this shim when MarketResearchSettingsDialog is replaced.
// MAX_MACRO_QUERIES was removed from marketResearchHelpers in Task 8.
const MAX_MACRO_QUERIES = 10;

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

  // Re-hydrate on the open→true transition only. We deliberately do NOT
  // depend on `existingTask` reference identity: if a realtime postgres_changes
  // UPDATE fires mid-edit (e.g. the dispatcher just finished a successful run
  // and zeroed `consecutive_failures`), React's parent will pass a fresh
  // existingTask object — re-hydrating on that would silently wipe the user's
  // in-progress form edits. The `wasOpen` ref captures the previous open value
  // so we only fire the effect on the false→true edge.
  const wasOpen = useRef(open);
  useEffect(() => {
    const isOpenEdge = open && !wasOpen.current;
    wasOpen.current = open;
    if (!isOpenEdge) return;
    setConfig(
      hydrateMarketResearchConfig(
        existingTask
          ? (existingTask.config as unknown as Record<string, unknown>)
          : {},
      ),
    );
    // existingTask is read at the open-transition; subsequent realtime updates
    // to the task while the dialog is open are intentionally ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    getMacroQueryCatalog()
      .then((entries) => { if (!cancelled) setCatalog(entries); })
      .catch((err) => logger.error('Failed to load macro query catalog', err))
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  const availableMacroQueries = useMemo(
    // @ts-expect-error -- replaced in Task 9 (config.markets/watchlist_symbols removed from MarketResearchConfig)
    () => filterMacroQueries(catalog, config.markets as Market[], config.watchlist_symbols),
    // @ts-expect-error -- replaced in Task 9 (config.markets/watchlist_symbols removed)
    [catalog, config.markets, config.watchlist_symbols],
  );

  const selectedMacroEntries = useMemo(() => {
    const byQuery = new Map(catalog.map((e) => [e.query, e]));
    // @ts-expect-error -- replaced in Task 9 (config.macro_queries removed from MarketResearchConfig)
    return (config.macro_queries ?? []).map(
      (q: string) => byQuery.get(q) ?? {
        id: `legacy:${q}`, query: q,
        markets: [] as Market[], isMarketWide: false,
        symbols: [], category: 'Custom (legacy)', displayOrder: 0,
      },
    );
    // @ts-expect-error -- replaced in Task 9
  }, [catalog, config.macro_queries]);

  // @ts-expect-error -- replaced in Task 9 (config.macro_queries removed from MarketResearchConfig)
  const atMacroLimit = (config.macro_queries ?? []).length >= MAX_MACRO_QUERIES;
  // @ts-expect-error -- replaced in Task 9 (config.watchlist_symbols removed from MarketResearchConfig)
  const canSave = config.watchlist_symbols.length > 0;

  // Segmented chip button — shared shape for Frequency + Significance fields
  const segChipSx = (selected: boolean) => ({
    ...chipStyle(selected),
    border: 'none',
    '&:focus-visible': { outline: `2px solid ${violet}`, outlineOffset: 2 },
  });

  const toggleMarket = (value: string) => {
    // @ts-expect-error -- replaced in Task 9 (config.markets removed from MarketResearchConfig)
    const next = config.markets.includes(value)
      // @ts-expect-error -- replaced in Task 9
      ? config.markets.filter((m) => m !== value)
      // @ts-expect-error -- replaced in Task 9
      : [...config.markets, value];
    // @ts-expect-error -- replaced in Task 9 (config.watchlist_symbols/macro_queries removed)
    const macros = pruneOrphanedMacros(catalog, next as Market[], config.watchlist_symbols, config.macro_queries);
    // @ts-expect-error -- replaced in Task 9
    setConfig({ ...config, markets: next, macro_queries: macros });
  };

  const updateWatchlistSymbols = (symbols: string[]) => {
    // @ts-expect-error -- replaced in Task 9 (config.markets/macro_queries removed from MarketResearchConfig)
    const macros = pruneOrphanedMacros(catalog, config.markets as Market[], symbols, config.macro_queries);
    // @ts-expect-error -- replaced in Task 9
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
              // @ts-expect-error -- replaced in Task 9 (config.markets removed from MarketResearchConfig)
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
            // @ts-expect-error -- replaced in Task 9 (config.watchlist_symbols removed from MarketResearchConfig)
            value={YAHOO_SYMBOL_CATALOG.filter((o) => config.watchlist_symbols.includes(o.symbol))}
            onChange={(_, v) => updateWatchlistSymbols(v.map((o) => o.symbol))}
            slotProps={{ popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } } }}
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
                // @ts-expect-error -- replaced in Task 9 (config.watchlist_symbols removed)
                error={config.watchlist_symbols.length === 0}
                // @ts-expect-error -- replaced in Task 9
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
            // @ts-expect-error -- replaced in Task 9 (config.macro_queries removed from MarketResearchConfig)
            getOptionDisabled={(opt) => atMacroLimit && !(config.macro_queries ?? []).includes(opt.query)}
            value={selectedMacroEntries}
            // @ts-expect-error -- replaced in Task 9
            onChange={(_, v) => setConfig({ ...config, macro_queries: v.slice(0, MAX_MACRO_QUERIES).map((e) => e.query) })}
            slotProps={{ popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } } }}
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
            {/* @ts-expect-error -- replaced in Task 9 (config.macro_queries removed from MarketResearchConfig) */}
            {(config.macro_queries ?? []).length}/{MAX_MACRO_QUERIES} selected
          </Typography>
        </FieldGroup>

      </Box>
    </BaseDialog>
  );
};

export default MarketResearchSettingsDialog;
