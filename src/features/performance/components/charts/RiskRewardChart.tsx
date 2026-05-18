import React from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer
} from 'recharts';
import { Box, Paper, Typography, useTheme, Tooltip } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

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

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Average RR
            </Typography>
            <Tooltip
              title="Average Risk to reward ratio (RR) per trade. An RR of 2 means that for every 1$ you risk you will make 2$."
              arrow
              placement="top"
            >
              <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
            </Tooltip>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {riskRewardStats.average.toFixed(2)}
          </Typography>
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Max RR
            </Typography>
            <Tooltip
              title="Maximum Risk to reward Ratio between all your trades. You can use the small graph at the bottom of this card to see the RR of every one of your trades."
              arrow
              placement="top"
            >
              <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
            </Tooltip>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {riskRewardStats.max.toFixed(2)}
          </Typography>
        </Box>
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
    </Paper>
  );
};

export default RiskRewardChart;
