import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  alpha,
  TextField,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Security as SecurityIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { Trade } from '../types/dualWrite';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';



interface AccountBalanceProps {
  balance: number;
  totalProfit: number;
  onChange: (balance: number) => void;
  trades: Trade[];
  onPerformanceClick?: () => void;
  risk_per_trade?: number;
  dynamicRiskSettings?: DynamicRiskSettings;
  onToggleDynamicRisk?: (useActualAmounts: boolean) => void;
  isDynamicRiskToggled?: boolean;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}


const AccountBalance: React.FC<AccountBalanceProps> = ({
  balance,
  onChange,
  trades,
  totalProfit,
  onPerformanceClick,
  risk_per_trade,
  dynamicRiskSettings,
  onToggleDynamicRisk,
  isDynamicRiskToggled = true, // Default to true (using actual amounts)
  isReadOnly = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState(balance.toString());

  // Profit percentage calculation - should be based on original account balance for threshold comparison
  const profitPercentage = trades.length > 0 && balance > 0 ? (totalProfit / balance * 100).toFixed(2) : '0';

  // Calculate the effective risk percentage based on dynamic risk settings
  const effectiveRiskPercentage = useMemo(() => {
    if (!risk_per_trade) return undefined;

    if (dynamicRiskSettings?.dynamic_risk_enabled &&
      dynamicRiskSettings.increased_risk_percentage &&
      dynamicRiskSettings.profit_threshold_percentage &&
      parseFloat(profitPercentage) >= dynamicRiskSettings.profit_threshold_percentage) {
      return dynamicRiskSettings.increased_risk_percentage;
    }

    return risk_per_trade;
  }, [risk_per_trade, dynamicRiskSettings, profitPercentage]);

  // Calculate total account value
  const totalAccountValue = balance + totalProfit;

  const handleSubmit = () => {
    const newBalance = parseFloat(tempBalance);
    if (!isNaN(newBalance) && newBalance > 0) {
      onChange(newBalance);
      setIsEditing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempBalance(balance.toString());
    }
  };




  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        minHeight: '320px'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, pl: 1 }}>
            Account Balance
          </Typography>
        </Box>
        {isEditing ? (
          <TextField
            value={tempBalance}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setTempBalance(value);
              }
            }}
            onBlur={handleSubmit}
            onKeyDown={handleKeyPress}
            size="small"
            autoFocus
            sx={{
              width: '150px',
              '& .MuiInputBase-input': {
                py: 0.8,
                px: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'text.primary'
              }
            }}
            InputProps={{
              startAdornment: (
                <Typography sx={{ color: 'text.secondary', fontSize: '1.1rem', mr: 0.5, fontWeight: 600 }}>
                  $
                </Typography>
              )
            }}
          />
        ) : (
          <Typography
            onClick={isReadOnly ? undefined : () => setIsEditing(true)}
            sx={{
              cursor: isReadOnly ? 'default' : 'pointer',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'text.primary',
              '&:hover': isReadOnly ? {} : {
                color: 'primary.main'
              },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <Box component="span" sx={{ fontSize: '1.1rem', color: 'text.secondary', fontWeight: 500 }}>$</Box>
            {balance.toLocaleString()}
          </Typography>
        )}
      </Box>

      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme => alpha(theme.palette.background.default, 0.5),
        p: 1.5,
        borderRadius: 1.5,
        mt: 0.5
      }}>
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 0.5,
              fontWeight: 500
            }}
          >
            Current P&L
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.2rem',
              color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            ${trades.length > 0 ? Math.abs(totalProfit).toLocaleString() : '0'}
            <Typography
              component="span"
              sx={{
                fontSize: '0.9rem',
                color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
                fontWeight: 600
              }}
            >
              ({profitPercentage}%)
            </Typography>
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 0.5,
              fontWeight: 500,
              textAlign: 'right'
            }}
          >
            Total Value
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.2rem',
              color: totalAccountValue > balance ? 'success.main' : totalAccountValue < balance ? 'error.main' : 'text.secondary',
              fontWeight: 700
            }}
          >
            ${totalAccountValue.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Risk Per Trade Section - Always visible but disabled when not configured */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        opacity: risk_per_trade ? 1 : 0.4,
        pointerEvents: risk_per_trade ? 'auto' : 'none',
      }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme => alpha(theme.palette.primary.main, risk_per_trade ? 0.08 : 0.03),
          p: 1.5,
          borderRadius: 1.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ fontSize: '1rem', color: risk_per_trade ? 'primary.main' : 'text.disabled' }} />
            <Typography
              variant="body2"
              sx={{
                color: risk_per_trade ? 'text.secondary' : 'text.disabled',
                fontWeight: 500
              }}
            >
              Risk Per Trade ({effectiveRiskPercentage || 0}%)
              {risk_per_trade && dynamicRiskSettings?.dynamic_risk_enabled && effectiveRiskPercentage !== risk_per_trade && (
                <Box component="span" sx={{ ml: 1, color: 'success.main', fontSize: '0.75rem', fontWeight: 700 }}>
                  INCREASED
                </Box>
              )}
              {!risk_per_trade && (
                <Box component="span" sx={{ ml: 1, color: 'text.disabled', fontSize: '0.75rem', fontWeight: 600 }}>
                  (Not Configured)
                </Box>
              )}
            </Typography>
          </Box>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              color: risk_per_trade ? 'primary.main' : 'text.disabled'
            }}
          >
            ${effectiveRiskPercentage ? ((totalAccountValue * effectiveRiskPercentage) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </Typography>
        </Box>

        {/* Dynamic Risk Section - Always visible but disabled when not configured */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundColor: theme => alpha(theme.palette.background.default, dynamicRiskSettings?.dynamic_risk_enabled ? 0.5 : 0.2),
          p: 1,
          mt: 1,
          borderRadius: 1.5,
          fontSize: '0.75rem',
          opacity: (dynamicRiskSettings?.dynamic_risk_enabled && dynamicRiskSettings.profit_threshold_percentage && dynamicRiskSettings.increased_risk_percentage) ? 1 : 0.4,
          pointerEvents: (dynamicRiskSettings?.dynamic_risk_enabled && dynamicRiskSettings.profit_threshold_percentage && dynamicRiskSettings.increased_risk_percentage) ? 'auto' : 'none',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: dynamicRiskSettings?.dynamic_risk_enabled ? 'text.secondary' : 'text.disabled' }}>
              Dynamic Risk: {dynamicRiskSettings?.dynamic_risk_enabled && dynamicRiskSettings.profit_threshold_percentage && parseFloat(profitPercentage) >= dynamicRiskSettings.profit_threshold_percentage ?
                <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>Active</Box> :
                dynamicRiskSettings?.dynamic_risk_enabled ?
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>Inactive</Box> :
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 600 }}>Not Configured</Box>}
            </Typography>
            <Typography variant="caption" sx={{ color: dynamicRiskSettings?.dynamic_risk_enabled ? 'text.secondary' : 'text.disabled' }}>
              Threshold: {dynamicRiskSettings?.profit_threshold_percentage || 0}% profit
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isDynamicRiskToggled}
                  onChange={isReadOnly ? undefined : (e) => {
                    if (onToggleDynamicRisk) {
                      onToggleDynamicRisk(e.target.checked);
                    }
                  }}
                  disabled={isReadOnly || !dynamicRiskSettings?.dynamic_risk_enabled}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="caption" sx={{ color: dynamicRiskSettings?.dynamic_risk_enabled ? 'text.secondary' : 'text.disabled' }}>
                  {isDynamicRiskToggled ? "Using actual trade amounts" : "Using calculated amounts"}
                </Typography>
              }
              sx={{ m: 0 }}
            />
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    🎯 Why This Tool Matters
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Discover your true potential:</strong> See how much more profitable you could be with consistent risk management
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Identify position sizing issues:</strong> Compare your actual trades vs. what optimal risk sizing would look like
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Improve your discipline:</strong> Understand the impact of inconsistent position sizes on your overall performance
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    💰 Many traders discover they could be 20-50% more profitable with better risk management!
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
              enterDelay={300}
              leaveDelay={200}
            >
              <InfoIcon
                sx={{
                  fontSize: 16,
                  color: dynamicRiskSettings?.dynamic_risk_enabled ? 'text.secondary' : 'text.disabled',
                  cursor: 'help',
                  '&:hover': dynamicRiskSettings?.dynamic_risk_enabled ? {
                    color: 'primary.main'
                  } : {}
                }}
              />
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default AccountBalance;
