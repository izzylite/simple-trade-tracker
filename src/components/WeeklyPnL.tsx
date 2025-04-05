import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface WeeklyStat {
  weekNumber: number;
  netAmount: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
}

interface WeeklyPnLProps {
  weeklyStats: WeeklyStat[];
}

export const WeeklyStatsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  width: '250px',
  minHeight: '600px',
}));

export const WeeklyStatCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[2],
  }
}));

export const StatLabel = styled(Typography)({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'text.secondary',
});

export const StatValue = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 600,
}));

export const WeeklyPnL: React.FC<WeeklyPnLProps> = ({ weeklyStats }) => {
  return (
    <WeeklyStatsContainer>
      {weeklyStats.map((stats: WeeklyStat, index: number) => (
        <WeeklyStatCard key={index}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatLabel>Week {stats.weekNumber}</StatLabel>
            <Typography 
              variant="caption" 
              sx={{ 
                color: stats.netAmount >= 0 ? 'success.main' : 'error.main',
                fontWeight: 500 
              }}
            >
              {stats.winRate}% Win Rate
            </Typography>
          </Box>
          <StatValue sx={{ color: stats.netAmount >= 0 ? 'success.main' : 'error.main' }}>
            ${Math.abs(stats.netAmount).toFixed(2)}
          </StatValue>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stats.totalTrades} trades
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              •
            </Typography>
            <Typography variant="caption" sx={{ color: 'success.main' }}>
              {stats.wins} W
            </Typography>
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {stats.losses} L
            </Typography>
          </Box>
        </WeeklyStatCard>
      ))}
    </WeeklyStatsContainer>
  );
}; 