import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { PieChart as PieChartIcon, TouchApp } from '@mui/icons-material';
import { TNUM, getInsetSurface } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import InfoStrip from 'components/common/InfoStrip';

interface WinLossDistributionProps {
  winLossData: any[];
  onPieClick?: (category: string) => void;
}

const WinLossDistribution: React.FC<WinLossDistributionProps> = ({
  winLossData,
  onPieClick,
}) => {
  const theme = useTheme();

  // Add a style element to remove focus outlines from SVG elements
  React.useEffect(() => {
    // Create a style element
    const style = document.createElement('style');
    // Add CSS to remove focus outlines from SVG elements
    style.innerHTML = `
      .recharts-sector:focus,
      .recharts-sector:focus-visible,
      .recharts-pie:focus,
      .recharts-pie:focus-visible,
      .recharts-pie-sector:focus,
      .recharts-pie-sector:focus-visible,
      .recharts-layer:focus,
      .recharts-layer:focus-visible,
      .recharts-surface:focus,
      .recharts-surface:focus-visible {
        outline: none !important;
        stroke: none !important;
        stroke-width: 0 !important;
        box-shadow: none !important;
      }

      /* Target all SVG elements in the chart */
      .recharts-wrapper svg *:focus,
      .recharts-wrapper svg *:focus-visible,
      .win-loss-chart-container svg *:focus,
      .win-loss-chart-container svg *:focus-visible {
        outline: none !important;
        stroke-width: 0 !important;
      }
    `;
    // Append the style element to the document head
    document.head.appendChild(style);

    // Clean up the style element when the component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Define colors with enhanced visual appeal
  const COLORS = {
    win: theme.palette.success.main,
    loss: theme.palette.error.main,
    zero: theme.palette.text.secondary,
    breakEven: theme.palette.text.tertiary || theme.palette.text.secondary,
  };

  // Define chart styling
  const chartStyle = {
    outerRadius: 100,
    innerRadius: 60,
    paddingAngle: 3,
    cornerRadius: 4,
  };

  const radius = theme.palette.custom.radius;
  const hairline = theme.palette.divider;
  const insetBg = getInsetSurface(theme);

  const totalTrades = winLossData.reduce((sum, item) => sum + item.value, 0);

  const colorFor = (name: string): string =>
    name === 'Wins'
      ? COLORS.win
      : name === 'Losses'
        ? COLORS.loss
        : name === 'Breakeven'
          ? COLORS.breakEven
          : COLORS.zero;

  return (
    <CardShell
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      head={{
        icon: <PieChartIcon sx={{ fontSize: 16 }} />,
        title: 'Win / Loss Distribution',
        eyebrow: `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} total`,
      }}
    >
      {/* ── Body ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 280 }} className="win-loss-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              style={{ outline: 'none' }}
              tabIndex={-1}
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const accent = colorFor(data.name);
                    const pct =
                      totalTrades > 0
                        ? ((data.value / totalTrades) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <Box
                        sx={{
                          bgcolor: 'background.paper',
                          border: `1px solid ${hairline}`,
                          borderRadius: `${radius.md}px`,
                          p: 1.25,
                          minWidth: 140,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mb: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '2px',
                              bgcolor: accent,
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: '0.8125rem',
                              fontWeight: 700,
                              color: 'text.primary',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {data.name}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: accent,
                            fontFeatureSettings: TNUM,
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {data.value} trade{data.value !== 1 ? 's' : ''}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            fontFeatureSettings: TNUM,
                            mt: 0.25,
                          }}
                        >
                          {pct}% of total
                        </Typography>
                        {onPieClick && (
                          <Typography
                            sx={{
                              fontSize: '0.6875rem',
                              color: 'primary.main',
                              fontWeight: 600,
                              mt: 0.5,
                              letterSpacing: '0.02em',
                            }}
                          >
                            Click to view trades
                          </Typography>
                        )}
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={winLossData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={chartStyle.outerRadius}
                strokeWidth={0}
                innerRadius={chartStyle.innerRadius}
                fill="#7c3aed"
                dataKey="value"
                label={({ name, percent }) => {
                  // Only show labels for segments with significant percentage
                  if (percent < 0.05) return null;
                  return `${name} ${(percent * 100).toFixed(0)}%`;
                }}
                paddingAngle={chartStyle.paddingAngle}
                cornerRadius={chartStyle.cornerRadius}
                onClick={(data) => {
                  if (onPieClick) {
                    onPieClick(data.name);
                  }
                }}
                cursor={'pointer'}
                style={{ outline: 'none' }}
                tabIndex={-1}
              >
                {winLossData.map((entry, index) => {
                  const fillColor = colorFor(entry.name);
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      strokeWidth={1}
                      stroke={theme.palette.background.paper}
                      style={{
                        outline: 'none',
                        transition: 'opacity 0.3s',
                      }}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* ── Custom legend as inset rows ─────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: `repeat(${Math.min(winLossData.length || 1, 3)}, 1fr)`,
            },
            gap: 1,
          }}
        >
          {winLossData.map((entry, index) => {
            const accent = colorFor(entry.name);
            const pct =
              totalTrades > 0
                ? ((entry.value / totalTrades) * 100).toFixed(1)
                : '0.0';
            const interactive = !!onPieClick;
            return (
              <Box
                key={`legend-${index}`}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={
                  interactive
                    ? (e) => {
                        e.stopPropagation();
                        onPieClick!(entry.name);
                      }
                    : undefined
                }
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onPieClick!(entry.name);
                        }
                      }
                    : undefined
                }
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.875,
                  px: 1.25,
                  py: 1,
                  borderRadius: '10px',
                  bgcolor: insetBg,
                  border: `1px solid ${hairline}`,
                  cursor: interactive ? 'pointer' : 'default',
                  transition: interactive ? 'background-color 150ms ease' : 'none',
                  '&:hover': interactive ? { bgcolor: alpha(accent, 0.08) } : {},
                  '&:focus-visible': interactive
                    ? { outline: 'none', boxShadow: `0 0 0 3px ${alpha(accent, 0.25)}` }
                    : {},
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '3px',
                    bgcolor: accent,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'text.primary',
                    fontFeatureSettings: TNUM,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {entry.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'text.tertiary',
                    fontFeatureSettings: TNUM,
                    minWidth: 44,
                    textAlign: 'right',
                  }}
                >
                  {pct}%
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* ── Footer / hint ──────────────────────────────────────── */}
        {onPieClick && (
          <InfoStrip
            tone="violet"
            icon={<TouchApp sx={{ fontSize: 14 }} />}
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.625,
              px: 1.25,
              py: 0.875,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'primary.main',
                letterSpacing: '0.01em',
              }}
            >
              Click a segment or row to view trades
            </Typography>
          </InfoStrip>
        )}
      </Box>
    </CardShell>
  );
};

export default WinLossDistribution;
