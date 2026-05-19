import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Button,
  alpha,
  Tooltip as MuiTooltip,
  CircularProgress,
} from '@mui/material';
import { InfoOutlined, BarChart as BarChartIcon } from '@mui/icons-material';
import { isSameMonth } from 'date-fns';
import { Trade } from 'features/calendar/types/dualWrite';
import { formatValue } from 'utils/formatters';
import TagFilterDialog from 'features/calendar/components/TagFilterDialog';
import { performanceCalculationService } from 'features/performance/services/performanceCalculationService';
import { EYEBROW_SX, getInsetSurface } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';

interface TagPerformanceAnalysisProps {
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'quarter' | 'ytd' | 'year' | 'all';
  allTags: string[];
  primaryTags: string[];
  secondaryTags: string[];
  setPrimaryTags: (tags: string[]) => void;
  setSecondaryTags: (tags: string[]) => void;
  setMultipleTradesDialog: (dialogState: any) => void;
}

const TagPerformanceAnalysis: React.FC<TagPerformanceAnalysisProps> = ({
  trades,
  selectedDate,
  timePeriod,
  allTags,
  primaryTags,
  secondaryTags,
  setPrimaryTags,
  setSecondaryTags,
  setMultipleTradesDialog,
}) => {
  const theme = useTheme();
  const [primaryTagsDialogOpen, setPrimaryTagsDialogOpen] = useState(false);
  const [secondaryTagsDialogOpen, setSecondaryTagsDialogOpen] = useState(false);
  const [filteredTagStats, setFilteredTagStats] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Calculate filtered tag stats client-side (no DB query needed)
  useEffect(() => {
    const calculateFilteredStats = () => {
      if (primaryTags.length === 0) {
        setFilteredTagStats([]);
        return;
      }

      setIsCalculating(true);
      try {
        // Use client-side calculation from already-fetched trades
        const tagPerformanceData = performanceCalculationService.calculateTagPerformanceFromTrades(
          trades,
          primaryTags,
          secondaryTags,
        );

        // Transform data to match component expectations
        const tagStats = tagPerformanceData.map((tagData: any) => ({
          tag: tagData.tag.substring(tagData.tag.indexOf(':') + 1, tagData.tag.length),
          wins: tagData.wins,
          losses: tagData.losses,
          breakevens: tagData.breakevens,
          total_trades: tagData.total_trades,
          win_rate: tagData.win_rate,
          total_pnl: tagData.total_pnl,
          avg_pnl: tagData.avg_pnl,
          max_win: tagData.max_win,
          max_loss: tagData.max_loss,
          trades: [], // Can be populated client-side if needed for clicks
        }));

        setFilteredTagStats(tagStats);
      } catch (error) {
        console.error('Error calculating filtered tag stats:', error);
        setFilteredTagStats([]);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateFilteredStats();
  }, [trades, primaryTags, secondaryTags]);

  // ── Tokens ──────────────────────────────────────────────────────────
  const radius = theme.palette.custom.radius;
  const hairline = theme.palette.divider;
  const insetBg = getInsetSurface(theme);

  const COLORS = {
    win: theme.palette.success.main,
    loss: theme.palette.error.main,
    zero: theme.palette.text.secondary,
    breakEven: theme.palette.text.tertiary,
  };

  // ── Header band right-slot controls ─────────────────────────────────
  const headerRight = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <MuiTooltip
        title="Select primary tags to filter trades that have ANY of these tags. These are your main strategies or setups to analyze."
        arrow
        placement="top"
      >
        <Button
          variant="outlined"
          size="small"
          onClick={() => setPrimaryTagsDialogOpen(true)}
          sx={{
            textTransform: 'none',
            borderColor: primaryTags.length > 0 ? 'primary.main' : undefined,
            '&:focus-visible': { boxShadow: theme.palette.custom.focusRing },
          }}
        >
          {primaryTags.length > 0 ? `Primary: ${primaryTags.length} tags` : 'Select Primary Tags'}
        </Button>
      </MuiTooltip>
      <MuiTooltip
        title="Select secondary tags to further filter trades that have ALL of these tags. Use this to analyze specific conditions within your primary strategies."
        arrow
        placement="top"
      >
        <Button
          variant="outlined"
          size="small"
          onClick={() => setSecondaryTagsDialogOpen(true)}
          color={secondaryTags.length > 0 ? 'secondary' : 'primary'}
          sx={{
            textTransform: 'none',
            borderColor: secondaryTags.length > 0 ? 'secondary.main' : undefined,
            '&:focus-visible': { boxShadow: theme.palette.custom.focusRing },
          }}
        >
          {secondaryTags.length > 0 ? `Secondary: ${secondaryTags.length} tags` : 'Select Secondary Tags'}
        </Button>
      </MuiTooltip>
      <TagFilterDialog
        open={primaryTagsDialogOpen}
        onClose={() => setPrimaryTagsDialogOpen(false)}
        title="Select Primary Tags"
        allTags={allTags}
        selectedTags={primaryTags}
        onTagsChange={(tags) => setPrimaryTags(tags)}
        showApplyButton={true}
        showClearButton={true}
      />
      <TagFilterDialog
        open={secondaryTagsDialogOpen}
        onClose={() => setSecondaryTagsDialogOpen(false)}
        title="Select Secondary Tags"
        allTags={allTags}
        selectedTags={secondaryTags}
        onTagsChange={(tags) => setSecondaryTags(tags)}
        showApplyButton={true}
        showClearButton={true}
      />
    </Box>
  );

  return (
    <CardShell
      radius="lg"
      head={{
        icon: <BarChartIcon sx={{ fontSize: 16 }} />,
        title: (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            Tag Performance Analysis
            <MuiTooltip
              title="Analyze how different tags perform. Select primary tags to filter, and optionally secondary tags to see how they perform in combination."
              arrow
              placement="top"
            >
              <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
            </MuiTooltip>
          </Box>
        ),
        right: headerRight,
      }}
    >
      {primaryTags.length === 0 && secondaryTags.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 0.75,
              p: 3,
              borderRadius: '10px',
              bgcolor: insetBg,
              border: `1px solid ${hairline}`,
            }}
          >
            <Typography sx={EYEBROW_SX}>No tags selected</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
              Select primary or secondary tags to view performance analysis.
            </Typography>
          </Box>
        </Box>
      ) : isCalculating ? (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.25,
              py: 6,
              borderRadius: '10px',
              bgcolor: insetBg,
              border: `1px solid ${hairline}`,
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Calculating tag performance…
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 2 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={filteredTagStats}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              maxBarSize={50}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={hairline}
              />
              <XAxis
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.25,
                          bgcolor: 'background.paper',
                          border: `1px solid ${hairline}`,
                          borderRadius: `${radius.md}px`,
                          boxShadow: 'none',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            mb: 0.5,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.win }}>
                          Wins: {data.wins}
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.loss }}>
                          Losses: {data.losses}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Win Rate: {data.win_rate}%
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: data.total_pnl > 0 ? COLORS.win : COLORS.loss,
                            fontWeight: 600,
                            mt: 0.5,
                          }}
                        >
                          P&L: {formatValue(data.total_pnl)}
                        </Typography>
                      </Paper>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar
                dataKey="wins"
                name="Wins"
                stackId="trades"
                fill={COLORS.win}
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data && data.payload) {
                    const tag = data.payload.tag;
                    // Filter trades client-side for click handler
                    const fullTag = primaryTags.find((t) => t.endsWith(`:${tag}`)) || tag;
                    const filteredTrades = trades.filter((trade) => {
                      // Check if trade has the tag
                      if (!trade.tags?.includes(fullTag)) return false;
                      // Check if trade has all secondary tags
                      if (secondaryTags.length > 0 && !secondaryTags.every((t) => trade.tags?.includes(t)))
                        return false;
                      // Check trade type
                      if (trade.trade_type !== 'win') return false;
                      // Check time period
                      if (timePeriod === 'month') return isSameMonth(new Date(trade.trade_date), selectedDate);
                      if (timePeriod === 'year')
                        return new Date(trade.trade_date).getFullYear() === selectedDate.getFullYear();
                      return true;
                    });
                    if (filteredTrades.length > 0) {
                      setMultipleTradesDialog({
                        open: true,
                        trades: filteredTrades,
                        date: `Winning trades with tag: ${[fullTag, ...secondaryTags].join(', ')}`,
                        expandedTradeId: filteredTrades.length === 1 ? filteredTrades[0].id : null,
                      });
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <Bar
                dataKey="losses"
                name="Losses"
                stackId="trades"
                fill={COLORS.loss}
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data && data.payload) {
                    const tag = data.payload.tag;
                    // Filter trades client-side for click handler
                    const fullTag = primaryTags.find((t) => t.endsWith(`:${tag}`)) || tag;
                    const filteredTrades = trades.filter((trade) => {
                      // Check if trade has the tag
                      if (!trade.tags?.includes(fullTag)) return false;
                      // Check if trade has all secondary tags
                      if (secondaryTags.length > 0 && !secondaryTags.every((t) => trade.tags?.includes(t)))
                        return false;
                      // Check trade type
                      if (trade.trade_type !== 'loss') return false;
                      // Check time period
                      if (timePeriod === 'month') return isSameMonth(new Date(trade.trade_date), selectedDate);
                      if (timePeriod === 'year')
                        return new Date(trade.trade_date).getFullYear() === selectedDate.getFullYear();
                      return true;
                    });
                    if (filteredTrades.length > 0) {
                      setMultipleTradesDialog({
                        open: true,
                        trades: filteredTrades,
                        date: `Losing trades with tag: ${[fullTag, ...secondaryTags].join(', ')}`,
                        expandedTradeId: filteredTrades.length === 1 ? filteredTrades[0].id : null,
                      });
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </CardShell>
  );
};

export default TagPerformanceAnalysis;
