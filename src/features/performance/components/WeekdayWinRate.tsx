import React, { useMemo } from 'react';
import { Box, Tooltip, useTheme } from '@mui/material';
import { Trade } from 'features/calendar/types/dualWrite';
import CardShell from 'components/common/CardShell';
import { TNUM } from 'styles/designTokens';

interface WeekdayWinRateProps {
  trades: Trade[];
}

interface DayStat {
  label: string;
  index: number; // 0=Sun .. 6=Sat
  total: number;
  wins: number;
  winRate: number; // 0..100
}

const ORDER: Array<{ label: string; index: number }> = [
  { label: 'Mon', index: 1 },
  { label: 'Tue', index: 2 },
  { label: 'Wed', index: 3 },
  { label: 'Thu', index: 4 },
  { label: 'Fri', index: 5 },
];

const WeekdayWinRate: React.FC<WeekdayWinRateProps> = ({ trades }) => {
  const theme = useTheme();
  const stats = useMemo<DayStat[]>(() => {
    const buckets = new Map<number, { wins: number; total: number }>();
    for (const trade of trades) {
      const d = trade.trade_date instanceof Date ? trade.trade_date : new Date(trade.trade_date);
      const dow = d.getDay();
      const b = buckets.get(dow) || { wins: 0, total: 0 };
      b.total += 1;
      if (trade.trade_type === 'win') b.wins += 1;
      buckets.set(dow, b);
    }
    return ORDER.map(({ label, index }) => {
      const b = buckets.get(index) || { wins: 0, total: 0 };
      const winRate = b.total > 0 ? (b.wins / b.total) * 100 : 0;
      return { label, index, total: b.total, wins: b.wins, winRate };
    });
  }, [trades]);

  const bestRate = useMemo(
    () => stats.reduce((m, s) => (s.total > 0 && s.winRate > m ? s.winRate : m), 0),
    [stats]
  );

  const anyData = stats.some((s) => s.total > 0);

  if (!anyData) return null;

  return (
    <Box sx={{ mb: 2.5 }}>
      <CardShell
        head={{
          icon: <span aria-hidden>▦</span>,
          title: 'By weekday',
          sub: 'Win rate',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-end',
            px: 2.5,
            py: 2.25,
            height: 160,
          }}
        >
          {stats.map((s) => {
            const isBest = s.total > 0 && s.winRate === bestRate;
            const barHeightPct = s.total > 0 ? Math.max(s.winRate, 4) : 0;
            return (
              <Box
                key={s.index}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  height: '100%',
                }}
              >
                <Tooltip
                  arrow
                  placement="top"
                  title={
                    s.total > 0
                      ? `${s.winRate.toFixed(1)}% · ${s.wins}/${s.total} wins`
                      : 'No trades'
                  }
                >
                  <Box
                    sx={{
                      flex: 1,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${barHeightPct}%`,
                        borderRadius: '4px 4px 2px 2px',
                        background: isBest
                          ? theme.palette.primary.main
                          : theme.palette.custom.tintViolet.strong,
                        border: `1px solid ${isBest ? theme.palette.primary.main : theme.palette.divider}`,
                        transition: 'opacity 150ms cubic-bezier(0.22, 1, 0.36, 1), background 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                        '&:hover': { opacity: 0.85 },
                      }}
                    />
                  </Box>
                </Tooltip>
                <Box
                  sx={{
                    fontSize: '0.72rem',
                    color: theme.palette.text.tertiary,
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </Box>
                <Box
                  sx={{
                    fontSize: '0.7rem',
                    color: isBest ? theme.palette.primary.main : theme.palette.text.secondary,
                    fontWeight: 700,
                    fontFeatureSettings: TNUM,
                  }}
                >
                  {s.total > 0 ? `${s.winRate.toFixed(0)}%` : '—'}
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardShell>
    </Box>
  );
};

export default WeekdayWinRate;
