import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CumulativePnLChart from './CumulativePnLChart';
import DailyPnLChart from './DailyPnLChart';

interface PnLChartsWrapperProps {
  chartData: any[];
  targetValue: number | null;
  monthlyTarget?: number;
  drawdownViolationValue: number;
  setMultipleTradesDialog: (dialogState: any) => void;
  timePeriod: 'month' | 'year' | 'all';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pnl-tabpanel-${index}`}
      aria-labelledby={`pnl-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const PnLChartsWrapper: React.FC<PnLChartsWrapperProps> = ({
  chartData,
  targetValue,
  monthlyTarget,
  drawdownViolationValue,
  setMultipleTradesDialog,
  timePeriod
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Paper sx={{ p: 0, mb: 3, borderRadius: 2 }}>
      <Box sx={{ px: 3, pt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'start', mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              minHeight: 40,
              backgroundColor: theme.palette.mode === 'light'
                ? '#f0f0f0'
                : alpha(theme.palette.background.paper, 0.4),
              borderRadius: '20px',
              padding: '4px',
              '& .MuiTabs-flexContainer': {
                gap: '4px'
              },
              '& .MuiTabs-indicator': {
                display: 'none'
              }
            }}
          >
            <Tab
              label="Cumulative P&L"
              sx={{
                minHeight: 32,
                my: 0.2,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.secondary',
                borderRadius: '16px',
                padding: '6px 18px',
                '&.Mui-selected': {
                  color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                  backgroundColor: 'primary.main',
                  boxShadow: theme.shadows[1]
                },
                '&:hover:not(.Mui-selected)': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: 'primary.main'
                }
              }}
            />
            <Tab
              label="Daily P&L"
              sx={{
                minHeight: 32,
                my: 0.2,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.secondary',
                borderRadius: '16px',
                padding: '6px 18px',
                '&.Mui-selected': {
                  color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                  backgroundColor: 'primary.main',
                  boxShadow: theme.shadows[1]
                },
                '&:hover:not(.Mui-selected)': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: 'primary.main'
                }
              }}
            />
          </Tabs>
        </Box>
      </Box>

      <Box sx={{ px: 3, pb: 3 }}>
        {/* Cumulative P&L Tab */}
        <TabPanel value={activeTab} index={0}>
          <CumulativePnLChart
            chartData={chartData}
            targetValue={targetValue}
            monthlyTarget={monthlyTarget}
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
