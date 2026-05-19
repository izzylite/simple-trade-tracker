import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Skeleton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  TrendingUp,
  TrendingDown,
  Warning,
  HelpOutline,
  Tune,
  Insights,
} from '@mui/icons-material';
import { Trade } from 'features/calendar/types/dualWrite';
import { TagPatternInsight } from 'features/performance/types/score';
import { tagPatternService } from 'features/performance/services/tagPatternService';
import { getTagChipStyles, formatTagForDisplay } from 'utils/tagColors';
import TagSelectionDialog, { SelectableItem } from 'features/calendar/components/TagSelectionDialog';
import { EYEBROW_SX, TNUM, getInsetTileSx } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import InfoStrip from 'components/common/InfoStrip';
import CompareBar from 'components/common/CompareBar';
import EyebrowRow from 'components/common/EyebrowRow';

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
  const infoStripTone = (type: TagPatternInsight['type']): 'success' | 'error' | 'warning' =>
    type === 'high_performance'
      ? 'success'
      : type === 'declining_pattern'
        ? 'error'
        : 'warning';
  const insightIcon = (type: TagPatternInsight['type']) => {
    const Icon = type === 'high_performance' ? TrendingUp : type === 'declining_pattern' ? TrendingDown : Warning;
    return <Icon sx={{ fontSize: 16 }} />;
  };

  const tagChips = (tags: string[]) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {tags.map((t) => (
        <Chip key={t} label={formatTagForDisplay(t)} size="small" sx={{ ...getTagChipStyles(t, theme), height: 22 }} />
      ))}
    </Stack>
  );

  // ── Header band ─────────────────────────────────────────────────────
  const headProps = {
    icon: <Insights sx={{ fontSize: 16 }} />,
    title: 'Pattern Insights',
    eyebrow: 'Tag combinations & trends',
    right: (
      <>
        <Tooltip title="Combinations of tags that consistently win or lose, and patterns that are slipping recently">
          <IconButton size="small" sx={{ color: 'text.disabled' }}>
            <HelpOutline sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {excluded.length > 0 && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {excluded.length} excluded
          </Typography>
        )}
        {onExcludedTagsChange && (
          <Tooltip title="Exclude tags from this analysis">
            <IconButton size="small" onClick={() => setExcludeOpen(true)} sx={{ color: 'text.secondary' }}>
              <Tune sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </>
    ),
  };

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
        <CardShell sx={{ mb: 3 }} head={headProps}>
          <Box sx={{ p: 2.5 }}>
            <Stack spacing={1.25}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rounded" height={56} sx={{ borderRadius: '10px' }} />
              ))}
            </Stack>
          </Box>
        </CardShell>
        {excludeDialog}
      </>
    );
  }

  if (!analysis || trades.length < MIN_TRADES) {
    return (
      <>
        <CardShell sx={{ mb: 3 }} head={headProps}>
          <Box sx={{ p: 2.5 }}>
            <InfoStrip tone="violet">
              Add at least {MIN_TRADES} trades to surface tag patterns.
            </InfoStrip>
          </Box>
        </CardShell>
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
      <CardShell sx={{ mb: 3 }} head={headProps}>
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {nothing && (
            <InfoStrip tone="violet">
              No clear tag patterns yet — keep logging trades with tags.
            </InfoStrip>
          )}

          {/* ── Insights — tone-tinted info strips ────────────────────── */}
          {insights.length > 0 && (
            <Box>
              <Typography sx={EYEBROW_SX}>Key insights</Typography>
              <Stack spacing={1} mt={1}>
                {insights.map((ins, i) => (
                  <InfoStrip
                    key={i}
                    tone={infoStripTone(ins.type)}
                    icon={insightIcon(ins.type)}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: 'text.primary' }}
                        >
                          {ins.title}
                        </Typography>
                        {tagChips(ins.tagCombination)}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          mt: 0.5,
                          lineHeight: 1.5,
                        }}
                      >
                        {ins.recommendation}
                      </Typography>
                    </Box>
                  </InfoStrip>
                ))}
              </Stack>
            </Box>
          )}

          {/* ── Top combinations — inset tiles with proportion bar ────── */}
          {topCombos.length > 0 && (
            <Box>
              <EyebrowRow label="Top combinations" rightLabel="By win rate" />
              <Stack spacing={1} mt={1}>
                {topCombos.map((c, i) => {
                  const col = winRateColor(c.win_rate);
                  return (
                    <Box
                      key={i}
                      sx={{
                        ...getInsetTileSx(theme),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.75,
                        minWidth: 0,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.25,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>{tagChips(c.tags)}</Box>
                        <Typography
                          sx={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: col,
                            fontFeatureSettings: TNUM,
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fmtPct(c.win_rate)}
                        </Typography>
                      </Box>

                      {/* proportion bar */}
                      <CompareBar value={Math.max(2, c.win_rate)} pct color={col} />

                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.tertiary',
                          fontFeatureSettings: TNUM,
                        }}
                      >
                        {c.total_trades} trades · avg {fmtSigned(c.avgPnL)}
                        {c.trend !== 'stable' && (
                          <Box
                            component="span"
                            sx={{
                              ml: 1,
                              color:
                                c.trend === 'improving'
                                  ? theme.palette.success.main
                                  : theme.palette.error.main,
                              fontWeight: 600,
                            }}
                          >
                            {c.trend === 'improving' ? '▲ improving' : '▼ declining'}
                          </Box>
                        )}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* ── Declining — tone-tinted info strips ───────────────────── */}
          {declining.length > 0 && (
            <Box>
              <Typography sx={{ ...EYEBROW_SX, color: theme.palette.error.main }}>
                Slipping
              </Typography>
              <Stack spacing={1} mt={1}>
                {declining.map((c, i) => (
                  <InfoStrip
                    key={i}
                    tone="error"
                    icon={<TrendingDown sx={{ fontSize: 16 }} />}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>{tagChips(c.tags)}</Box>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      {fmtPct(c.historicalWinRate)} → {fmtPct(c.recentWinRate)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: theme.palette.error.main,
                        whiteSpace: 'nowrap',
                        fontFeatureSettings: TNUM,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      ▼{(c.historicalWinRate - c.recentWinRate).toFixed(1)}%
                    </Typography>
                  </InfoStrip>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </CardShell>
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
