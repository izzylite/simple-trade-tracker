/**
 * AccountStats — Account balance + risk telemetry card.
 *
 * Layout (compact, panel-friendly):
 *  ┌─────────────────────────────────────────────┐
 *  │ ACCOUNT BALANCE              $10,000.00     │
 *  │ ┌────────────────┬────────────────┐         │
 *  │ │ CURRENT P&L    │ TOTAL VALUE    │         │
 *  │ │ +$7,552,661    │ $7,562,661     │         │
 *  │ │ +75,526.61%    │                │         │
 *  │ ├────────────────┼────────────────┤         │
 *  │ │ 🛡 RISK 1%     │ 📉 DAILY DD 1% │         │
 *  │ │ $75,626        │ $75,626        │         │
 *  │ └────────────────┴────────────────┘         │
 *  │ DYNAMIC RISK  ● Using actual amounts   ⓘ    │
 *  └─────────────────────────────────────────────┘
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  alpha,
  Switch,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Security as SecurityIcon,
  InfoOutlined as InfoIcon,
  TrendingDown as DrawdownIcon,
} from '@mui/icons-material';
import { Trade } from 'features/calendar/types/dualWrite';
import { DynamicRiskSettings } from 'features/calendar/utils/dynamicRiskUtils';
import { EYEBROW_SX, TNUM, getInsetSurface, getCardShellSx } from 'styles/designTokens';
import { isDarkMode } from 'utils/themeMode';

interface AccountStatsProps {
  balance: number;
  totalProfit: number;
  trades: Trade[];
  onPerformanceClick?: () => void;
  risk_per_trade?: number;
  dynamicRiskSettings?: DynamicRiskSettings;
  onToggleDynamicRisk?: (useActualAmounts: boolean) => void;
  isDynamicRiskToggled?: boolean;
  isReadOnly?: boolean;
  max_daily_drawdown?: number;
}

const AccountStats: React.FC<AccountStatsProps> = ({
  balance,
  trades,
  totalProfit,
  risk_per_trade,
  dynamicRiskSettings,
  onToggleDynamicRisk,
  isDynamicRiskToggled = true,
  isReadOnly = false,
  max_daily_drawdown,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);

  const profitPercentage =
    trades.length > 0 && balance > 0 ? (totalProfit / balance) * 100 : 0;

  const effectiveRiskPercentage = useMemo(() => {
    if (!risk_per_trade) return undefined;
    if (
      dynamicRiskSettings?.dynamic_risk_enabled &&
      dynamicRiskSettings.increased_risk_percentage &&
      dynamicRiskSettings.profit_threshold_percentage &&
      profitPercentage >= dynamicRiskSettings.profit_threshold_percentage
    ) {
      return dynamicRiskSettings.increased_risk_percentage;
    }
    return risk_per_trade;
  }, [risk_per_trade, dynamicRiskSettings, profitPercentage]);

  const totalAccountValue = balance + totalProfit;

  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
  const surfaceInset = getInsetSurface(theme);

  // PnL color signals — green/red/neutral
  const pnlColor =
    totalProfit > 0
      ? theme.palette.success.main
      : totalProfit < 0
        ? theme.palette.error.main
        : theme.palette.text.secondary;
  const totalValueColor =
    totalAccountValue > balance
      ? theme.palette.success.main
      : totalAccountValue < balance
        ? theme.palette.error.main
        : theme.palette.text.secondary;

  const riskActive = !!risk_per_trade;
  const ddActive = !!max_daily_drawdown;
  const dynamicConfigured =
    !!dynamicRiskSettings?.dynamic_risk_enabled &&
    !!dynamicRiskSettings.profit_threshold_percentage &&
    !!dynamicRiskSettings.increased_risk_percentage;
  const dynamicActive =
    dynamicConfigured &&
    profitPercentage >=
      (dynamicRiskSettings?.profit_threshold_percentage ?? Infinity);

  return (
    <Paper
      elevation={0}
      sx={{
        ...getCardShellSx(theme, 'lg'),
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: 1.75,
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Title + balance ─────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Typography sx={EYEBROW_SX}>Account balance</Typography>
        <Typography
          sx={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'text.primary',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 0.25,
            fontFeatureSettings: TNUM,
            letterSpacing: '-0.01em',
          }}
        >
          <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.disabled', fontWeight: 500 }}>
            $
          </Box>
          {balance.toLocaleString()}
        </Typography>
      </Box>

      {/* ── P&L + Total Value ───────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          bgcolor: surfaceInset,
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 1.25 }}>
          <Typography sx={{ ...EYEBROW_SX, fontSize: '0.62rem' }}>Current P&L</Typography>
          <Typography
            sx={{
              mt: 0.375,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: pnlColor,
              fontFeatureSettings: TNUM,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}
          >
            {trades.length > 0 ? (totalProfit >= 0 ? '+' : '−') : ''}$
            {trades.length > 0 ? Math.abs(totalProfit).toLocaleString() : '0'}
          </Typography>
          <Typography
            sx={{
              mt: 0.125,
              fontSize: '0.7rem',
              fontWeight: 600,
              color: pnlColor,
              fontFeatureSettings: TNUM,
            }}
          >
            {trades.length > 0
              ? `${totalProfit >= 0 ? '+' : '−'}${Math.abs(profitPercentage).toFixed(2)}%`
              : '—'}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 1.25,
            borderLeft: `1px solid ${hairline}`,
            textAlign: 'right',
          }}
        >
          <Typography sx={{ ...EYEBROW_SX, fontSize: '0.62rem' }}>Total value</Typography>
          <Typography
            sx={{
              mt: 0.375,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: totalValueColor,
              fontFeatureSettings: TNUM,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}
          >
            ${totalAccountValue.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* ── Risk / Drawdown row ─────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <RiskTile
          icon={<SecurityIcon sx={{ fontSize: 14 }} />}
          label="Risk"
          accent={theme.palette.primary.main}
          active={riskActive}
          percent={effectiveRiskPercentage}
          amount={
            effectiveRiskPercentage
              ? (totalAccountValue * effectiveRiskPercentage) / 100
              : 0
          }
          boosted={
            riskActive &&
            !!dynamicRiskSettings?.dynamic_risk_enabled &&
            effectiveRiskPercentage !== risk_per_trade
          }
        />
        <RiskTile
          icon={<DrawdownIcon sx={{ fontSize: 14 }} />}
          label="Daily DD"
          accent={theme.palette.error.main}
          active={ddActive}
          percent={max_daily_drawdown}
          amount={
            max_daily_drawdown ? (totalAccountValue * max_daily_drawdown) / 100 : 0
          }
        />
      </Box>

      {/* ── Dynamic Risk strip ──────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          rowGap: 0.5,
          px: 1,
          py: 0.875,
          borderRadius: '10px',
          bgcolor: surfaceInset,
          opacity: dynamicConfigured ? 1 : 0.55,
        }}
      >
        <Typography sx={{ ...EYEBROW_SX, fontSize: '0.6rem' }}>Dynamic risk</Typography>
        <Box
          component="span"
          sx={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: dynamicActive
              ? 'success.main'
              : dynamicConfigured
                ? 'text.secondary'
                : 'text.disabled',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {dynamicActive ? 'Active' : dynamicConfigured ? 'Inactive' : 'Off'}
        </Box>

        {dynamicConfigured && (
          <Box
            component="span"
            sx={{
              fontSize: '0.66rem',
              color: 'text.disabled',
              fontFeatureSettings: TNUM,
              ml: 0.25,
            }}
          >
            · Threshold {dynamicRiskSettings?.profit_threshold_percentage}%
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Switch
            checked={isDynamicRiskToggled}
            onChange={
              isReadOnly
                ? undefined
                : (e) => onToggleDynamicRisk?.(e.target.checked)
            }
            disabled={isReadOnly || !dynamicConfigured}
            size="small"
            color="primary"
          />
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: dynamicConfigured ? 'text.secondary' : 'text.disabled',
              fontWeight: 500,
            }}
          >
            {isDynamicRiskToggled ? 'Actual amounts' : 'Calculated amounts'}
          </Typography>
          <Tooltip
            title={
              <Box sx={{ maxWidth: 280 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Why this matters
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Compare your real trade outcomes against what optimal risk-based
                  position sizing would have produced — surfaces sizing discipline
                  gaps and shows your true profit potential.
                </Typography>
              </Box>
            }
            arrow
            placement="top"
            enterDelay={300}
          >
            <InfoIcon
              sx={{
                fontSize: 14,
                color: dynamicConfigured ? 'text.secondary' : 'text.disabled',
                cursor: 'help',
                '&:hover': dynamicConfigured ? { color: 'primary.main' } : {},
              }}
            />
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
};

// ─── RiskTile ──────────────────────────────────────────────────────────────
// Compact, identical-footprint tile used for both Risk and Daily Drawdown so
// the two cells line up consistently.

interface RiskTileProps {
  icon: React.ReactNode;
  label: string;
  accent: string;
  active: boolean;
  percent: number | undefined;
  amount: number;
  boosted?: boolean;
}

const RiskTile: React.FC<RiskTileProps> = ({
  icon,
  label,
  accent,
  active,
  percent,
  amount,
  boosted,
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        px: 1.125,
        py: 1,
        borderRadius: '10px',
        bgcolor: alpha(accent, active ? 0.08 : 0.03),
        border: `1px solid ${alpha(accent, active ? 0.25 : 0.1)}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ display: 'inline-flex', color: active ? accent : 'text.disabled' }}>
          {icon}
        </Box>
        <Typography
          sx={{
            ...EYEBROW_SX,
            fontSize: '0.6rem',
            color: active ? 'text.secondary' : 'text.disabled',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.62rem',
            fontWeight: 700,
            color: active ? accent : 'text.disabled',
            fontFeatureSettings: TNUM,
          }}
        >
          {percent ? `${percent}%` : 'N/A'}
        </Typography>
        {boosted && (
          <Box
            component="span"
            sx={{
              fontSize: '0.58rem',
              fontWeight: 700,
              color: 'success.main',
              ml: 'auto',
              letterSpacing: '0.04em',
            }}
          >
            UP
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: '0.92rem',
          fontWeight: 700,
          color: active ? accent : theme.palette.text.disabled,
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}
      >
        ${amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Typography>
    </Box>
  );
};

export default React.memo(AccountStats);
