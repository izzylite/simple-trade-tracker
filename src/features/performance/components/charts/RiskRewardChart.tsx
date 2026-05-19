import React from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import { Box, useTheme, Tooltip } from '@mui/material';
import { InfoOutlined, ShowChart } from '@mui/icons-material';
import CardShell from 'components/common/CardShell';
import StatTile from 'components/common/StatTile';

interface RiskRewardChartProps {
  riskRewardStats: {
    average: number;
    max: number;
    data: Array<{
      date: string;
      rr: number;
    }>;
  };
}

const RiskRewardChart: React.FC<RiskRewardChartProps> = ({ riskRewardStats }) => {
  const theme = useTheme();

  if (riskRewardStats.data.length === 0) {
    return null;
  }

  const renderTooltipIcon = (tooltip: string) => (
    <Tooltip title={tooltip} arrow placement="top">
      <InfoOutlined
        sx={{
          fontSize: 13,
          color: 'text.tertiary',
          cursor: 'help',
        }}
      />
    </Tooltip>
  );

  return (
    <CardShell
      head={{
        icon: <ShowChart sx={{ fontSize: 16 }} />,
        title: 'Risk / Reward',
        eyebrow: 'Per-trade RR distribution',
      }}
      sx={{ mb: 2 }}
    >
      {/* Body */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.25,
          }}
        >
          <StatTile
            label="Average RR"
            value={riskRewardStats.average.toFixed(2)}
            icon={renderTooltipIcon(
              'Average Risk to reward ratio (RR) per trade. An RR of 2 means that for every 1$ you risk you will make 2$.'
            )}
          />
          <StatTile
            label="Max RR"
            value={riskRewardStats.max.toFixed(2)}
            icon={renderTooltipIcon(
              'Maximum Risk to reward Ratio between all your trades. You can use the small graph at the bottom of this card to see the RR of every one of your trades.'
            )}
          />
        </Box>

        {/* RR Trend Line Graph */}
        <Box sx={{ height: 60, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={riskRewardStats.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="rr"
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                fill="url(#rrGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </CardShell>
  );
};

export default RiskRewardChart;
