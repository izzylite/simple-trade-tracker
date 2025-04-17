import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  alpha,
  Tooltip,
  useTheme,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  TrendingUp,
  Security as SecurityIcon,
  Info as InfoIcon,
  InfoOutlined
} from '@mui/icons-material';
import { Trade } from '../types/trade';



interface AccountBalanceProps {
  balance: number;
  totalProfit: number;
  onChange: (balance: number) => void;
  trades: Trade[];
  onPerformanceClick?: () => void;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  onToggleDynamicRisk?: (useActualAmounts: boolean) => void;
  isDynamicRiskToggled?: boolean;
}


const AccountBalance: React.FC<AccountBalanceProps> = ({
  balance,
  onChange,
  trades,
  totalProfit,
  onPerformanceClick,
  riskPerTrade,
  dynamicRiskEnabled,
  increasedRiskPercentage,
  profitThresholdPercentage,
  onToggleDynamicRisk,
  isDynamicRiskToggled = true // Default to true (using actual amounts)
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState(balance.toString());

  const theme = useTheme();

  // Profit percentage calculation
  const profitPercentage = trades.length > 0 && balance > 0 ? (totalProfit / balance * 100).toFixed(2) : '0';

  // Calculate the effective risk percentage based on dynamic risk settings
  const effectiveRiskPercentage = useMemo(() => {
    if (!riskPerTrade) return undefined;

    if (dynamicRiskEnabled &&
      increasedRiskPercentage &&
      profitThresholdPercentage &&
      parseFloat(profitPercentage) >= profitThresholdPercentage) {
      return increasedRiskPercentage;
    }

    return riskPerTrade;
  }, [riskPerTrade, dynamicRiskEnabled, increasedRiskPercentage, profitThresholdPercentage, profitPercentage]);

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
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, pl: 1 }}>
            Account Balance
          </Typography>
          <Tooltip title="View Performance Analytics">
            <IconButton
              size="small"
              onClick={onPerformanceClick}
              sx={{
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                }
              }}
            >
              <TrendingUp fontSize="small" />
            </IconButton>
          </Tooltip>
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
            onClick={() => setIsEditing(true)}
            sx={{
              cursor: 'pointer',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'text.primary',
              '&:hover': {
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

      {riskPerTrade && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mt: 1
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme => alpha(theme.palette.primary.main, 0.08),
            p: 1.5,
            borderRadius: 1.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500
                }}
              >
                Risk Per Trade ({effectiveRiskPercentage}%)
                {dynamicRiskEnabled && effectiveRiskPercentage !== riskPerTrade && (
                  <Box component="span" sx={{ ml: 1, color: 'success.main', fontSize: '0.75rem', fontWeight: 700 }}>
                    INCREASED
                  </Box>
                )}
              </Typography>
            </Box>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: 'primary.main'
              }}
            >
              ${effectiveRiskPercentage ? ((totalAccountValue * effectiveRiskPercentage) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </Typography>
          </Box>

          {dynamicRiskEnabled && profitThresholdPercentage && increasedRiskPercentage && (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              backgroundColor: theme => alpha(theme.palette.background.default, 0.5),
              p: 1,
              borderRadius: 1.5,
              fontSize: '0.75rem'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Dynamic Risk: {parseFloat(profitPercentage) >= profitThresholdPercentage ?
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>Active</Box> :
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>Inactive</Box>}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Threshold: {profitThresholdPercentage}% profit
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isDynamicRiskToggled}
                      onChange={(e) => {
                        if (onToggleDynamicRisk) {
                          onToggleDynamicRisk(e.target.checked);
                        }
                      }}
                      size="small"
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {isDynamicRiskToggled ? "Using actual trade amounts" : "Using calculated amounts"}
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
                <Tooltip
                  title={
                    <Typography variant="body2">
                      Toggle between actual trade amounts from your history and calculated amounts based on risk management rules.
                      When using calculated amounts, trades will be recalculated based on your risk per trade setting and risk-to-reward ratios,
                      showing how your account would have performed with strict risk management.
                    </Typography>
                  }
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      display: 'inline-flex', 
                      cursor: 'help',
                      ml: 0.5, mb: 0.5,
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7,   display: 'inline-flex' }} />
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default AccountBalance;
