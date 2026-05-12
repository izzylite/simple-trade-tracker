import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { perfTokens as t } from './performanceTokens';
import { PerformanceCalculationResult } from '../../services/performanceCalculationService';

interface KpiStripProps {
  performanceData: PerformanceCalculationResult | null;
}

interface KpiCardProps {
  label: string;
  value: string;
  tone?: 'win' | 'loss' | 'neutral';
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, tone = 'neutral' }) => {
  const color = tone === 'win' ? t.win : tone === 'loss' ? t.loss : t.fg;
  return (
    <Box
      sx={{
        bgcolor: t.bgAlt,
        border: `1px solid ${t.hair}`,
        borderRadius: `${t.radius.stat}px`,
        padding: 2,
      }}
    >
      <Box
        sx={{
          fontSize: '0.72rem',
          color: t.fgLow,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontSize: '1.65rem',
          fontWeight: 800,
          letterSpacing: '-0.025em',
          mt: '6px',
          color,
          fontFeatureSettings: t.fontFeatures.tabular,
        }}
      >
        {value}
      </Box>
    </Box>
  );
};

const KpiStrip: React.FC<KpiStripProps> = ({ performanceData }) => {
  const kpis = useMemo(() => {
    const w = performanceData?.winLossStats;
    const winnersTotal = w?.winners?.total ?? 0;
    const winnersAvg = w?.winners?.avgAmount ?? 0;
    const losersTotal = w?.losers?.total ?? 0;
    const losersAvg = w?.losers?.avgAmount ?? 0;
    const beTotal = w?.breakevens?.total ?? 0;
    const beAvg = w?.breakevens?.avgAmount ?? 0;

    const grossWin = winnersTotal * winnersAvg;
    const grossLoss = losersTotal * losersAvg; // already negative
    const grossBe = beTotal * beAvg;
    const netPnl = grossWin + grossLoss + grossBe;
    const winRate = w?.win_rate ?? 0;
    const profitFactor = grossLoss !== 0 ? grossWin / Math.abs(grossLoss) : grossWin > 0 ? Infinity : 0;
    const avgR = performanceData?.riskRewardStats?.average ?? 0;

    return { netPnl, winRate, profitFactor, avgR };
  }, [performanceData]);

  const netTone: 'win' | 'loss' | 'neutral' =
    kpis.netPnl > 0 ? 'win' : kpis.netPnl < 0 ? 'loss' : 'neutral';
  const netValue = `${kpis.netPnl > 0 ? '+' : ''}${formatCurrency(kpis.netPnl)}`;
  const winRateValue = formatPercentage(kpis.winRate, 1);
  const profitFactorValue = !isFinite(kpis.profitFactor)
    ? '∞'
    : kpis.profitFactor.toFixed(2);
  const avgRValue = `${kpis.avgR >= 0 ? '+' : ''}${kpis.avgR.toFixed(2)}R`;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 1.5,
        mb: 2.5,
      }}
    >
      <KpiCard label="Net P&L" value={netValue} tone={netTone} />
      <KpiCard label="Win rate" value={winRateValue} />
      <KpiCard label="Profit factor" value={profitFactorValue} />
      <KpiCard label="Avg R" value={avgRValue} />
    </Box>
  );
};

export default KpiStrip;
