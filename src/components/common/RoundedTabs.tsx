import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';

export interface TabItem {
  label: string;
  value?: string | number;
  disabled?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`rounded-tabpanel-${index}`}
      aria-labelledby={`rounded-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

interface RoundedTabsProps {
  tabs: TabItem[];
  activeTab: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  variant?: 'contained' | 'outlined';
  fullWidth?: boolean;
  sx?: any;
}

const RoundedTabs: React.FC<RoundedTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
  size = 'medium',
  variant = 'contained',
  fullWidth = false,
  sx = {}
}) => {
  const theme = useTheme();

  // Size configurations
  const sizeConfig = {
    small: {
      minHeight: 32,
      fontSize: '0.75rem',
      padding: '4px 12px',
      borderRadius: '14px',
      containerPadding: '2px'
    },
    medium: {
      minHeight: 40,
      fontSize: '0.875rem',
      padding: '6px 18px',
      borderRadius: '16px',
      containerPadding: '4px'
    },
    large: {
      minHeight: 48,
      fontSize: '1rem',
      padding: '8px 24px',
      borderRadius: '20px',
      containerPadding: '6px'
    }
  };

  const config = sizeConfig[size];

  // Variant configurations
  const getVariantStyles = () => {
    if (variant === 'outlined') {
      return {
        backgroundColor: 'transparent',
        border: `1px solid ${theme.palette.divider}`,
        '& .MuiTab-root': {
          '&.Mui-selected': {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.mode === 'dark' ? 'white' : 'white',
            boxShadow: theme.shadows[1]
          },
          '&:hover:not(.Mui-selected)': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            color: 'primary.main'
          }
        }
      };
    }

    // Default contained variant
    return {
      backgroundColor: theme.palette.mode === 'light'
        ? '#f0f0f0'
        : alpha(theme.palette.background.paper, 0.4),
      '& .MuiTab-root': {
        '&.Mui-selected': {
          color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
          backgroundColor: 'primary.main',
          boxShadow: theme.shadows[1]
        },
        '&:hover:not(.Mui-selected)': {
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          color: 'primary.main'
        }
      }
    };
  };

  return (
    <Box sx={sx}>
      <Tabs
        value={activeTab}
        onChange={onTabChange}
        variant={fullWidth ? 'fullWidth' : 'standard'}
        sx={{
          minHeight: config.minHeight,
          borderRadius: config.borderRadius,
          padding: config.containerPadding,
          ...getVariantStyles(),
          '& .MuiTabs-flexContainer': {
            gap: '4px'
          },
          '& .MuiTabs-indicator': {
            display: 'none'
          }
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            label={tab.label}
            disabled={tab.disabled}
            sx={{
              minHeight: config.minHeight - 8,
              my: 0.2,
              textTransform: 'none',
              fontSize: config.fontSize,
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: config.borderRadius,
              padding: config.padding,
              minWidth: fullWidth ? 'auto' : 'fit-content'
            }}
          />
        ))}
      </Tabs>
      
      {children}
    </Box>
  );
};

export default RoundedTabs;
