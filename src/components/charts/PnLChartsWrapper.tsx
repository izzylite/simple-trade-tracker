import React, { useState } from 'react';
import { Box, Paper } from '@mui/material';
import CumulativePnLChart from './CumulativePnLChart';
import DailyPnLChart from './DailyPnLChart';
import RoundedTabs, { TabPanel } from '../common/RoundedTabs';

interface PnLChartsWrapperProps {
  chartData: any[];
  targetValue: number | null;
  monthly_target?: number;
  drawdownViolationValue: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'year' | 'all';
}



const PnLChartsWrapper: React.FC<PnLChartsWrapperProps> = ({
  chartData,
  targetValue,
  monthly_target,
  drawdownViolationValue,
  setMultipleTradesDialog,
  timePeriod
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Define tabs for P&L charts
  const pnlTabs = [
    { label: 'Cumulative P&L' },
    { label: 'Daily P&L' }
  ];

  return (
    <Paper sx={{ p: 0, mb: 3, borderRadius: 2 }}>
      <Box sx={{ px: 3, pt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'start', mb: 2 }}>
          <RoundedTabs
            tabs={pnlTabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </Box>
      </Box>

      <Box sx={{ px: 3, pb: 3 }}>
        {/* Cumulative P&L Tab */}
        <TabPanel value={activeTab} index={0}>
          <CumulativePnLChart
            chartData={chartData}
            targetValue={targetValue}
            monthly_target={monthly_target}
            setMultipleTradesDialog={setMultipleTradesDialog}
            timePeriod={timePeriod}
          />
        </TabPanel>

        {/* Daily P&L Tab */}
        <TabPanel value={activeTab} index={1}>
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

export default PnLChartsWrapper;
