import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Skeleton,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  TrendingUp,
  TrendingDown,
  Warning,
  Info,
  HelpOutline,
  Tune,
} from '@mui/icons-material';
import { Trade } from 'features/calendar/types/dualWrite';
import { TagPatternInsight } from 'features/performance/types/score';
import { tagPatternService } from 'features/performance/services/tagPatternService';
import { getTagChipStyles, formatTagForDisplay } from 'utils/tagColors';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import TagSelectionDialog, { SelectableItem } from 'features/calendar/components/TagSelectionDialog';

interface TagPatternAnalysisProps {
  trades: Trade[];
  selectedDate?: Date;
  /** Calendar.tags — full known tag list for the exclude picker. */
  allTags?: string[];
  /** Tags currently excluded from pattern analysis (Calendar.excluded_tags_from_patterns). */
  excludedTags?: string[];
  /** Persist a new excluded-tags list (wired to the calendar). */
  onExcludedTagsChange?: (tags: string[]) => void;
}

const MIN_TRADES = 10;

/**
 * Compact "tag patterns" panel for the Performance page. Surfaces the
 * highest-conviction tag-combination insights, the top combinations as a
 * proportion-bar list, and any combinations that are slipping — plus a
 * settings affordance to exclude noisy tags from the analysis (persisted on
 * `Calendar.excluded_tags_from_patterns`).
 */
const TagPatternAnalysis: React.FC<TagPatternAnalysisProps> = ({
  trades,
  selectedDate = new Date(),
  allTags,
  excludedTags,
  onExcludedTagsChange,
}) => {
  const theme = useTheme();
  const [analysis, setAnalysis] = useState<Awaited<
    ReturnType<typeof tagPatternService.analyzeTagPatterns>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);

  const excluded = useMemo(() => excludedTags ?? [], [excludedTags]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (trades.length < MIN_TRADES) {
        if (!cancelled) setAnalysis(null);
        return;
      }
      // Only show skeleton on first compute. Subsequent re-runs (e.g. when
      // toggling excluded tags) keep prior analysis visible to avoid the
      // dialog flickering during re-mount.
      if (!cancelled) setIsLoading((prev) => prev || analysis === null);
      try {
        const next = await tagPatternService.analyzeTagPatterns(trades, selectedDate, excluded);
        if (!cancelled) setAnalysis(next);
      } catch (err) {
        console.error('Error analyzing tag patterns:', err);
        if (!cancelled) setAnalysis(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, selectedDate, excluded]);

  // ---- shared bits -----------------------------------------------------

  const winRateColor = (wr: number) =>
    wr >= 70 ? theme.palette.success.main : wr >= 50 ? theme.palette.warning.main : theme.palette.error.main;
  const fmtPct = (wr: number) => `${wr.toFixed(1)}%`;
  const fmtSigned = (v: number) =>
    `${v > 0 ? '+' : ''}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tone = (type: TagPatternInsight['type']) =>
    type === 'high_performance'
      ? theme.palette.success.main
      : type === 'declining_pattern'
      ? theme.palette.error.main
      : theme.palette.warning.main;
  const insightIcon = (type: TagPatternInsight['type']) => {
    const Icon = type === 'high_performance' ? TrendingUp : type === 'declining_pattern' ? TrendingDown : Warning;
    return <Icon sx={{ fontSize: 18, color: tone(type) }} />;
  };

  const tagChips = (tags: string[]) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {tags.map((t) => (
        <Chip key={t} label={formatTagForDisplay(t)} size="small" sx={{ ...getTagChipStyles(t, theme), height: 22 }} />
      ))}
    </Stack>
  );

  const cardSx = {
    p: { xs: 2, sm: 3 },
    mb: 3,
    borderRadius: 3,
    boxShadow: 'none',
    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.02) : theme.palette.background.paper,
    border: `1px solid ${theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : theme.palette.divider}`,
  } as const;

  const sectionLabelSx = { color: theme.palette.text.disabled, letterSpacing: 1 } as const;
  const emptyBoxSx = {
    py: 4,
    textAlign: 'center' as const,
    color: theme.palette.text.secondary,
    border: `1px dashed ${alpha(theme.palette.divider, 0.6)}`,
    borderRadius: 2,
  };

  const Header = (
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            color: theme.palette.primary.main,
            fontSize: 16,
          }}
        >
          🏷️
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Tag patterns
        </Typography>
        <Tooltip title="Combinations of tags that consistently win or lose, and patterns that are slipping recently">
          <IconButton size="small" sx={{ color: theme.palette.text.disabled }}>
            <HelpOutline sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        {excluded.length > 0 && (
          <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
            {excluded.length} excluded
          </Typography>
        )}
        {onExcludedTagsChange && (
          <Tooltip title="Exclude tags from this analysis">
            <IconButton size="small" onClick={() => setExcludeOpen(true)} sx={{ color: theme.palette.text.secondary }}>
              <Tune sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );

  const excludeDialog = onExcludedTagsChange && (
    <ExcludeTagsDialog
      open={excludeOpen}
      onClose={() => setExcludeOpen(false)}
      trades={trades}
      allTags={allTags}
      excluded={excluded}
      onChange={onExcludedTagsChange}
    />
  );

  // ---- states ----------------------------------------------------------

  if (isLoading && !analysis) {
    return (
      <>
        <Paper sx={cardSx}>
          {Header}
          <Stack spacing={1.5}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 2 }} />
            ))}
          </Stack>
        </Paper>
        {excludeDialog}
      </>
    );
  }

  if (!analysis || trades.length < MIN_TRADES) {
    return (
      <>
        <Paper sx={cardSx}>
          {Header}
          <Box sx={emptyBoxSx}>
            <Info sx={{ fontSize: 20, mb: 0.5, opacity: 0.6 }} />
            <Typography variant="body2">Add at least {MIN_TRADES} trades to surface tag patterns.</Typography>
          </Box>
        </Paper>
        {excludeDialog}
      </>
    );
  }

  const insights = analysis.insights.slice(0, 3);
  const topCombos = analysis.topCombinations.slice(0, 5);
  const declining = analysis.decliningCombinations.slice(0, 3);
  const nothing = insights.length === 0 && topCombos.length === 0 && declining.length === 0;

  return (
    <>
      <Paper sx={cardSx}>
        {Header}

      {nothing && (
        <Box sx={emptyBoxSx}>
          <Typography variant="body2">No clear tag patterns yet — keep logging trades with tags.</Typography>
        </Box>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Box mb={topCombos.length || declining.length ? 3 : 0}>
          <Typography variant="overline" sx={sectionLabelSx}>
            Key insights
          </Typography>
          <Stack spacing={1} mt={0.5}>
            {insights.map((ins, i) => (
              <Box
                key={i}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(tone(ins.type), 0.08),
                  border: `1px solid ${alpha(tone(ins.type), 0.18)}`,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ mt: '1px' }}>{insightIcon(ins.type)}</Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {ins.title}
                      </Typography>
                      {tagChips(ins.tagCombination)}
                    </Stack>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.25 }}>
                      {ins.recommendation}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Top combinations — proportion-bar list */}
      {topCombos.length > 0 && (
        <Box mb={declining.length ? 3 : 0}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="overline" sx={sectionLabelSx}>
              Top combinations
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
              by win rate
            </Typography>
          </Stack>
          <Stack spacing={1} mt={0.5}>
            {topCombos.map((c, i) => {
              const col = winRateColor(c.win_rate);
              return (
                <Box
                  key={i}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(0,1fr) 120px auto' },
                    alignItems: 'center',
                    columnGap: 1.5,
                    rowGap: 0.5,
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.02 : 0),
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    {tagChips(c.tags)}
                    <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
                      {c.total_trades} trades · avg {fmtSigned(c.avgPnL)}
                      {c.trend !== 'stable' && (
                        <Box
                          component="span"
                          sx={{
                            ml: 1,
                            color: c.trend === 'improving' ? theme.palette.success.main : theme.palette.error.main,
                            fontWeight: 600,
                          }}
                        >
                          {c.trend === 'improving' ? '▲ improving' : '▼ declining'}
                        </Box>
                      )}
                    </Typography>
                  </Box>
                  {/* bar */}
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.06 : 0.1),
                      overflow: 'hidden',
                      order: { xs: 3, sm: 0 },
                      gridColumn: { xs: '1 / -1', sm: 'auto' },
                    }}
                  >
                    <Box sx={{ width: `${Math.max(2, Math.min(100, c.win_rate))}%`, height: '100%', bgcolor: col, borderRadius: 4 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: col, textAlign: 'right', justifySelf: 'end' }}>
                    {fmtPct(c.win_rate)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Declining */}
      {declining.length > 0 && (
        <Box>
          <Typography variant="overline" sx={{ color: theme.palette.error.main, letterSpacing: 1, opacity: 0.85 }}>
            Slipping
          </Typography>
          <Stack spacing={1} mt={0.5}>
            {declining.map((c, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.18)}`,
                }}
              >
                <TrendingDown sx={{ fontSize: 18, color: theme.palette.error.main }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>{tagChips(c.tags)}</Box>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
                  {fmtPct(c.historicalWinRate)} → {fmtPct(c.recentWinRate)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.error.main, whiteSpace: 'nowrap' }}>
                  ▼{(c.historicalWinRate - c.recentWinRate).toFixed(1)}%
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      </Paper>
      {excludeDialog}
    </>
  );
};

// ---------------------------------------------------------------------------
// Exclude-tags dialog: searchable list of every known tag with its trade
// count. Excluded tags pinned to the top as removable chips; the rest are
// clickable rows that exclude on tap. Changes persist immediately.
// ---------------------------------------------------------------------------

interface ExcludeTagsDialogProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  allTags?: string[];
  excluded: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Thin wrapper around the generic TagSelectionDialog that maps trades →
 * SelectableItems with per-tag trade counts. The dialog itself is reusable
 * (also used by the "required tag groups" picker in TagManagement).
 */
const ExcludeTagsDialog: React.FC<ExcludeTagsDialogProps> = ({
  open,
  onClose,
  trades,
  allTags,
  excluded,
  onChange,
}) => {
  const theme = useTheme();

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    trades.forEach((t) => t.tags?.forEach((tag) => m.set(tag, (m.get(tag) ?? 0) + 1)));
    return m;
  }, [trades]);

  const items = useMemo<SelectableItem[]>(() => {
    const set = new Set<string>(allTags ?? []);
    if (set.size === 0) trades.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set)
      .filter((t) => !t.startsWith('Partials:'))
      .sort(
        (a, b) =>
          (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0) ||
          formatTagForDisplay(a).localeCompare(formatTagForDisplay(b)),
      )
      .map((tag) => {
        const n = tagCounts.get(tag) ?? 0;
        return {
          id: tag,
          label: formatTagForDisplay(tag),
          meta: `${n} trade${n === 1 ? '' : 's'}`,
          chipSx: getTagChipStyles(tag, theme),
        };
      });
  }, [allTags, trades, tagCounts, theme]);

  return (
    <TagSelectionDialog
      open={open}
      onClose={onClose}
      title="Exclude tags from analysis"
      description="Excluded tags are skipped when finding tag-combination patterns. Good for noisy or one-off tags."
      icon={<Tune sx={{ fontSize: 18, color: theme.palette.text.secondary }} />}
      accent="error"
      selectedLabel="Excluded"
      actionVerb="Exclude"
      items={items}
      selected={excluded}
      onChange={onChange}
      emptyText="No tags yet — add tags to your trades first."
    />
  );
};

export default TagPatternAnalysis;
