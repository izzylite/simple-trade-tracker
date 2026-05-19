import React, { useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import { formatCurrency, formatPercentage } from 'utils/formatters';
import { PerformanceCalculationResult } from 'features/performance/services/performanceCalculationService';
import StatTile from 'components/common/StatTile';
import PnlValue from 'components/common/PnlValue';

interface KpiStripProps {
  performanceData: PerformanceCalculationResult | null;
}

const KpiStrip: React.FC<KpiStripProps> = ({ performanceData }) => {
  const theme = useTheme();

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

  const winRateValue = formatPercentage(kpis.winRate, 1);

  const profitFactorValue = !isFinite(kpis.profitFactor)
    ? '∞'
    : kpis.profitFactor.toFixed(2);
  const profitFactorColor = !isFinite(kpis.profitFactor)
    ? theme.palette.success.main
    : kpis.profitFactor > 1
    ? theme.palette.success.main
    : kpis.profitFactor < 1 && kpis.profitFactor > 0
    ? theme.palette.error.main
    : theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          md: 'repeat(auto-fit, minmax(180px, 1fr))',
        },
        gap: 1.5,
        mb: 2.5,
      }}
    >
      <StatTile
        label="Net P&L"
        value={
          <PnlValue
            amount={kpis.netPnl}
            format={formatCurrency}
            size="lg"
          />
        }
      />
      <StatTile label="Win rate" value={winRateValue} />
      <StatTile
        label="Profit factor"
        value={profitFactorValue}
        valueColor={profitFactorColor}
      />
      <StatTile
        label="Avg R"
        value={
          <PnlValue
            amount={kpis.avgR}
            format={(n) => `${n.toFixed(2)}R`}
            size="lg"
          />
        }
      />
    </Box>
  );
};

export default KpiStrip;
