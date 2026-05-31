import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Autocomplete,
  TextField,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Splitscreen as SplitIcon,
  LinkOff,
} from '@mui/icons-material';
import { ImportFileData } from '../../types/import';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { Z_INDEX } from 'styles/zIndex';
import { getInstrumentMappings } from 'features/events/services/instrumentCatalog';

const TNUM = "'tnum' on, 'lnum' on";
const INSTRUMENT_MAPPINGS = getInstrumentMappings();

// Heuristic substring → instrument suggestion. Used to seed a one-click "Use EURUSD"
// chip below each group when the value looks like a known shorthand.
// Order matters: longer/more specific matches first to avoid e.g. "EU" eating
// "EURJPY". Direct instrument names match first.
const SUGGEST_HINTS: Array<{ keywords: string[]; symbol: string }> = [
  { keywords: ['EURUSD'], symbol: 'EURUSD' },
  { keywords: ['GBPUSD'], symbol: 'GBPUSD' },
  { keywords: ['USDJPY'], symbol: 'USDJPY' },
  { keywords: ['GBPJPY'], symbol: 'GBPJPY' },
  { keywords: ['EURJPY'], symbol: 'EURJPY' },
  { keywords: ['AUDUSD'], symbol: 'AUDUSD' },
  { keywords: ['NZDUSD'], symbol: 'NZDUSD' },
  { keywords: ['USDCAD'], symbol: 'USDCAD' },
  { keywords: ['USDCHF'], symbol: 'USDCHF' },
  { keywords: ['XAUUSD', 'GOLD', 'XAU'], symbol: 'XAUUSD' },
  { keywords: ['XAGUSD', 'SILVER', 'XAG'], symbol: 'XAGUSD' },
  { keywords: ['BTCUSD', 'BITCOIN', 'BTC'], symbol: 'BTCUSD' },
  { keywords: ['ETHUSD', 'ETHEREUM', 'ETH'], symbol: 'ETHUSD' },
  { keywords: ['CABLE', 'GU', 'POUND', 'GBP'], symbol: 'GBPUSD' },
  { keywords: ['EURO', 'EU', 'EUR'], symbol: 'EURUSD' },
  { keywords: ['UJ', 'YEN', 'JPY'], symbol: 'USDJPY' },
  { keywords: ['AU', 'AUD', 'AUSSIE'], symbol: 'AUDUSD' },
  { keywords: ['NU', 'NZD', 'KIWI'], symbol: 'NZDUSD' },
  { keywords: ['UC', 'LOONIE', 'CAD'], symbol: 'USDCAD' },
  { keywords: ['SWISSY', 'SWISS', 'CHF'], symbol: 'USDCHF' },
];

function suggestInstrumentFor(display: string): string | null {
  const upper = display.toUpperCase().trim();
  if (!upper) return null;
  for (const hint of SUGGEST_HINTS) {
    for (const kw of hint.keywords) {
      if (upper === kw || upper.includes(kw)) return hint.symbol;
    }
  }
  return null;
}

export interface Group {
  /** Normalized (uppercase, trimmed) key — used as the assignment lookup key. */
  key: string;
  /** Original-cased display value. */
  display: string;
  count: number;
}

interface Props {
  fileData: ImportFileData;
  splitColumn: string | null;
  onSplitColumnChange: (col: string | null) => void;
  assetAssignments: Record<string, string>;
  onAssetAssignmentsChange: (next: Record<string, string>) => void;
}

/**
 * Groups file rows by the chosen split column and lets the user assign an
 * asset to each group. Assignments get applied as `Asset:XXX` tags
 * on import so trades join the economic-events index. Optional — user can
 * leave everything unassigned and click Next to skip.
 */
export const AssetMappingPanel: React.FC<Props> = ({
  fileData,
  splitColumn,
  onSplitColumnChange,
  assetAssignments,
  onAssetAssignmentsChange,
}) => {
  const theme = useTheme();
  const {
    violet,
    violetSoft,
    violetBorder,
    surfaceInset,
    hairline,
    monoSectionLabelSx,
  } = useDialogTokens();

  // Group rows by the chosen split column. Normalize the lookup key (uppercase,
  // trimmed) so "EU" and "eu" merge, but keep the first-seen display casing.
  const groups: Group[] = useMemo(() => {
    if (!splitColumn) return [];
    const map = new Map<string, { display: string; count: number }>();
    for (const row of fileData.rows) {
      const raw = String(row[splitColumn] ?? '').trim();
      const key = raw.toUpperCase() || '(EMPTY)';
      const display = raw || '(empty)';
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { display, count: 1 });
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, display: val.display, count: val.count }))
      .sort((a, b) => b.count - a.count);
  }, [fileData, splitColumn]);

  const assignedCount = groups.filter((g) => assetAssignments[g.key]).length;
  const totalTradesAssigned = groups
    .filter((g) => assetAssignments[g.key])
    .reduce((sum, g) => sum + g.count, 0);

  const instrumentOptions = INSTRUMENT_MAPPINGS.map((m) => ({
    symbol: m.symbol,
    category: m.category,
  }));

  const handleAssign = (key: string, symbol: string | null) => {
    const next = { ...assetAssignments };
    if (symbol) next[key] = symbol;
    else delete next[key];
    onAssetAssignmentsChange(next);
  };

  const handleSplitColumnChange = (col: string | null) => {
    // Reset assignments when the split key changes — stale keys would tag
    // the wrong rows.
    if (col !== splitColumn) onAssetAssignmentsChange({});
    onSplitColumnChange(col);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Split-by column selector */}
      <Box
        sx={{
          border: `1px solid ${hairline}`,
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: surfaceInset,
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${hairline}`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <SplitIcon sx={{ fontSize: 14, color: violet }} />
          <Typography sx={monoSectionLabelSx}>Split by</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select
              value={splitColumn || ''}
              displayEmpty
              onChange={(e) => handleSplitColumnChange(e.target.value || null)}
              MenuProps={{
                sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                PaperProps: {
                  sx: {
                    maxHeight: 320,
                    borderRadius: 1.25,
                    border: `1px solid ${hairline}`,
                    boxShadow: theme.shadows[12],
                    backgroundImage: 'none',
                  },
                },
              }}
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.82rem',
                bgcolor: 'transparent',
                borderRadius: 1,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: hairline,
                },
                '& .MuiSelect-select': {
                  py: 0.75,
                  pl: 1.25,
                  pr: 4,
                },
              }}
            >
              <MenuItem
                value=""
                sx={{ fontSize: '0.82rem', fontStyle: 'italic' }}
              >
                Pick a column to group by…
              </MenuItem>
              {fileData.columns.map((col) => (
                <MenuItem key={col} value={col} sx={{ fontSize: '0.82rem' }}>
                  {col}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography
            sx={{
              mt: 0.85,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.74rem',
              color: alpha(theme.palette.text.secondary, 0.8),
              lineHeight: 1.5,
            }}
          >
            Group your trades by a column, then assign each group an asset
            to attach economic events. Skip this step entirely if you don't
            need economic event correlation.
          </Typography>
        </Box>
      </Box>

      {/* Empty state — no column picked yet. Includes a concrete worked
          example so the abstraction is obvious before the user commits. */}
      {!splitColumn && (
        <Box
          sx={{
            border: `1px dashed ${hairline}`,
            borderRadius: 1.5,
            overflow: 'hidden',
          }}
        >
          {/* Top: empty-state icon + copy */}
          <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
            <LinkOff
              sx={{
                fontSize: 24,
                color: alpha(theme.palette.text.secondary, 0.45),
                mb: 1,
              }}
            />
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: alpha(theme.palette.text.secondary, 0.8),
                mb: 0.5,
              }}
            >
              No column selected
            </Typography>
            <Typography
              sx={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.78rem',
                color: alpha(theme.palette.text.secondary, 0.65),
                maxWidth: 320,
                mx: 'auto',
                lineHeight: 1.5,
              }}
            >
              Pick a column above to start grouping, or click Next to skip and
              import without economic events.
            </Typography>
          </Box>

          {/* Bottom: worked example — Name column → grouped → assigned */}
          <Box
            sx={{
              borderTop: `1px solid ${hairline}`,
              bgcolor: surfaceInset,
              px: 1.5,
              py: 1.25,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography sx={monoSectionLabelSx}>Example</Typography>
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.62rem',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: alpha(theme.palette.text.secondary, 0.65),
                }}
              >
                Split by{' '}
                <Box
                  component="span"
                  sx={{
                    color: violet,
                    bgcolor: violetSoft,
                    border: `1px solid ${violetBorder}`,
                    borderRadius: 0.5,
                    px: 0.5,
                    py: 0.15,
                    ml: 0.25,
                  }}
                >
                  Name
                </Box>
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[
                { value: 'EU', count: 42, pair: 'EURUSD' },
                { value: 'GU', count: 28, pair: 'GBPUSD' },
                { value: 'UJ', count: 15, pair: 'USDJPY' },
              ].map((row) => (
                <Box
                  key={row.value}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 18px 1fr',
                    gap: 0.85,
                    alignItems: 'center',
                  }}
                >
                  {/* Source value pill */}
                  <Box
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      bgcolor: alpha(theme.palette.text.primary, 0.04),
                      border: `1px solid ${hairline}`,
                      borderRadius: 0.75,
                      px: 0.75,
                      py: 0.35,
                      textAlign: 'center',
                    }}
                  >
                    {row.value}
                  </Box>
                  {/* Trade count */}
                  <Typography
                    sx={{
                      fontFamily: MONO_FONT,
                      fontFeatureSettings: TNUM,
                      fontSize: '0.65rem',
                      color: alpha(theme.palette.text.secondary, 0.75),
                      letterSpacing: '0.06em',
                    }}
                  >
                    {row.count} trades
                  </Typography>
                  {/* Arrow */}
                  <Box
                    aria-hidden
                    sx={{
                      color: violet,
                      fontFamily: MONO_FONT,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      lineHeight: 1,
                    }}
                  >
                    →
                  </Box>
                  {/* Assigned pair pill */}
                  <Box
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: violet,
                      bgcolor: violetSoft,
                      border: `1px solid ${violetBorder}`,
                      borderRadius: 0.75,
                      px: 0.75,
                      py: 0.35,
                      textAlign: 'center',
                    }}
                  >
                    {row.pair}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Status strip + group cards */}
      {splitColumn && groups.length > 0 && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 1.25,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontFeatureSettings: TNUM,
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.palette.text.primary,
              }}
            >
              {assignedCount} of {groups.length} groups assigned
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontFeatureSettings: TNUM,
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '0.06em',
                color:
                  assignedCount > 0
                    ? violet
                    : alpha(theme.palette.text.secondary, 0.6),
              }}
            >
              {totalTradesAssigned} trade{totalTradesAssigned === 1 ? '' : 's'} tagged
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
            {groups.map((group) => {
              const assignedInstrument = assetAssignments[group.key] || null;
              const isAssigned = !!assignedInstrument;
              const suggestion = suggestInstrumentFor(group.display);
              const matchedOption =
                instrumentOptions.find((o) => o.symbol === assignedInstrument) || null;

              return (
                <Box
                  key={group.key}
                  sx={{
                    border: `1px solid ${isAssigned ? violetBorder : hairline}`,
                    borderRadius: 1.5,
                    bgcolor: isAssigned ? violetSoft : surfaceInset,
                    p: 1.25,
                    transition:
                      'background-color 120ms ease, border-color 120ms ease',
                  }}
                >
                  {/* Group header — value + count + status tick */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: theme.palette.text.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                      >
                        {group.display}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontFeatureSettings: TNUM,
                          fontSize: '0.66rem',
                          fontWeight: 500,
                          letterSpacing: '0.08em',
                          color: alpha(theme.palette.text.secondary, 0.8),
                        }}
                      >
                        {group.count} trade{group.count === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Box
                      aria-label={isAssigned ? 'assigned' : 'unassigned'}
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `1.5px solid ${
                          isAssigned
                            ? theme.palette.success.main
                            : alpha(theme.palette.text.secondary, 0.3)
                        }`,
                        color: isAssigned
                          ? theme.palette.success.main
                          : 'transparent',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </Box>
                  </Box>

                  {/* Instrument selector */}
                  <Autocomplete
                    value={matchedOption}
                    onChange={(_, newValue) =>
                      handleAssign(group.key, newValue?.symbol ?? null)
                    }
                    options={instrumentOptions}
                    getOptionLabel={(o) => o.symbol}
                    groupBy={(o) =>
                      o.category.charAt(0).toUpperCase() + o.category.slice(1)
                    }
                    isOptionEqualToValue={(a, b) => a.symbol === b.symbol}
                    size="small"
                    componentsProps={{
                      popper: {
                        sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                      },
                      paper: {
                        sx: {
                          borderRadius: 1.25,
                          border: `1px solid ${hairline}`,
                          boxShadow: theme.shadows[12],
                          backgroundImage: 'none',
                        },
                      },
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={
                          suggestion
                            ? `Pick an instrument (suggested: ${suggestion})`
                            : 'Pick an instrument…'
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontFamily: MONO_FONT,
                            fontSize: '0.8rem',
                            borderRadius: 1,
                            backgroundColor: isAssigned
                              ? alpha(violet, 0.06)
                              : theme.palette.background.paper,
                            '& fieldset': {
                              borderColor: isAssigned ? violetBorder : hairline,
                            },
                            '&:hover fieldset': {
                              borderColor: alpha(violet, 0.5),
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: violet,
                              borderWidth: 1,
                            },
                          },
                          '& .MuiOutlinedInput-input': {
                            py: 0.5,
                          },
                        }}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props as any;
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...rest}
                          sx={{
                            fontFamily: MONO_FONT,
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            py: 0.5,
                          }}
                        >
                          {option.symbol}
                        </Box>
                      );
                    }}
                  />

                  {/* One-click suggestion pill — only when unassigned and we have a guess */}
                  {!isAssigned && suggestion && (
                    <Box
                      onClick={() => handleAssign(group.key, suggestion)}
                      sx={{
                        mt: 0.85,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 0.85,
                        py: 0.4,
                        borderRadius: 0.75,
                        cursor: 'pointer',
                        bgcolor: violetSoft,
                        border: `1px dashed ${violetBorder}`,
                        fontFamily: MONO_FONT,
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: violet,
                        transition: 'background-color 120ms ease',
                        '&:hover': {
                          bgcolor: alpha(violet, 0.18),
                        },
                      }}
                    >
                      Use {suggestion}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
};

export default AssetMappingPanel;
