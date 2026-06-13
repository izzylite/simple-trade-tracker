import React, { useState } from 'react';
import { Box, Paper } from '@mui/material';
import CumulativePnLChart from 'features/performance/components/charts/CumulativePnLChart';
import DailyPnLChart from 'features/performance/components/charts/DailyPnLChart';
import PnLHeatmap from 'features/performance/components/charts/PnLHeatmap';
import RoundedTabs, { TabPanel } from 'components/common/RoundedTabs';
import { Trade } from 'features/calendar/types/dualWrite';
import { TimePeriod } from 'features/performance/utils/chartDataUtils';

interface PnLChartsWrapperProps {
  chartData: any[];
  targetValue: number | null;
  monthly_target?: number;
  drawdownViolationValue: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: TimePeriod;
  trades: Trade[];
  selectedDate: Date;
}



const PnLChartsWrapper: React.FC<PnLChartsWrapperProps> = ({
  chartData,
  targetValue,
  monthly_target,
  drawdownViolationValue,
  setMultipleTradesDialog,
  timePeriod,
  trades,
  selectedDate
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const pnlTabs = [
    { label: 'Heatmap' },
    { label: 'Cumulative P&L' },
    { label: 'Daily P&L' }
  ];

  return (
    <Paper sx={{ p: 0, mb: 3, borderRadius: 2 }}>
      <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'start', mb: 2 }}>
          <RoundedTabs
            tabs={pnlTabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 3 }}>
        {/* Heatmap Tab */}
        <TabPanel value={activeTab} index={0}>
          <PnLHeatmap
            trades={trades}
            timePeriod={timePeriod}
            selectedDate={selectedDate}
            setMultipleTradesDialog={setMultipleTradesDialog}
          />
        </TabPanel>

        {/* Cumulative P&L Tab */}
        <TabPanel value={activeTab} index={1}>
          <CumulativePnLChart
            chartData={chartData}
            targetValue={targetValue}
            monthly_target={monthly_target}
            setMultipleTradesDialog={setMultipleTradesDialog}
            timePeriod={timePeriod}
          />
        </TabPanel>

        {/* Daily P&L Tab */}
        <TabPanel value={activeTab} index={2}>
          <DailyPnLChart
            chartData={chartData}
            drawdownViolationValue={drawdownViolationValue}
            setMultipleTradesDialog={setMultipleTradesDialog}
            timePeriod={timePeriod}
          />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default React.memo(PnLChartsWrapper);
