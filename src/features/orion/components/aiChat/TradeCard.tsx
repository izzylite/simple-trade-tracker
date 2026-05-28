/**
 * TradeCard
 * Compact, glanceable trade card. Used in AI chat results, the search
 * panel, and any list that needs to render a single trade as a row.
 *
 * Design language: paper-surface card + hairline border, 12 px radius,
 * eyebrow date · session, colored PnL with arrow glyph (tnum), optional
 * tag chips, optional meta footer (R:R, notes, images, partials).
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip, Tooltip, alpha } from '@mui/material';
import {
  ArrowUpward as WinArrow,
  ArrowDownward as LossArrow,
  HorizontalRule as BreakevenArrow,
  StickyNote2Outlined as NoteIcon,
  ImageOutlined as ImageIcon,
  Balance as RiskIcon,
  PieChartOutline as PartialsIcon,
  Schedule as SessionIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from 'features/calendar/types/trade';
import {
  getTagChipStyles,
  isGroupedTag,
  getTagGroup,
} from 'utils/tagColors';
import { isDarkMode } from 'utils/themeMode';

interface TradeCardProps {
  trade: Trade;
  showTags?: boolean;
  onClick?: () => void;
  showImages?: boolean;
}

const MAX_VISIBLE_TAG_GROUPS = 4;

/** PnL formatter — always sign + 2dp, comma-grouped. Caller picks the arrow. */
const formatAmount = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const TradeCard: React.FC<TradeCardProps> = ({
  trade,
  onClick,
  showTags,
  showImages = false,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);
  const interactive = !!onClick;

  // ── Trade-type signal (color, icon glyph) ─────────────────────────────
  const typeColor =
    trade.trade_type === 'win'
      ? theme.palette.success.main
      : trade.trade_type === 'loss'
        ? theme.palette.error.main
        : theme.palette.info.main;

  const ArrowGlyph =
    trade.trade_type === 'win'
      ? WinArrow
      : trade.trade_type === 'loss'
        ? LossArrow
        : BreakevenArrow;

  // ── Tag grouping (one chip per category, "+N" for the overflow) ───────
  const { visibleTagGroups, overflowCount } = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const tag of trade.tags ?? []) {
      const key = isGroupedTag(tag) ? getTagGroup(tag) : 'Other';
      (groups[key] ??= []).push(tag);
    }
    const entries = Object.entries(groups);
    return {
      visibleTagGroups: entries.slice(0, MAX_VISIBLE_TAG_GROUPS),
      overflowCount: Math.max(0, entries.length - MAX_VISIBLE_TAG_GROUPS),
    };
  }, [trade.tags]);

  const hasTags = showTags && visibleTagGroups.length > 0;
  const imageCount = Array.isArray(trade.images) ? trade.images.length : 0;
  const hasImages = showImages && imageCount > 0;

  // ── Tokens ────────────────────────────────────────────────────────────
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
  const restingShadow = isDark
    ? '0 2px 8px rgba(0,0,0,0.30)'
    : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';

  const metaItemSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.375,
    color: 'text.secondary',
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFeatureSettings: "'tnum' on, 'lnum' on",
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        bgcolor: 'background.paper',
        border: `1px solid ${hairline}`,
        borderRadius: '12px',
        boxShadow: restingShadow,
        cursor: interactive ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'background-color 150ms ease-out',
        '&:hover': interactive
          ? {
              bgcolor: isDark
                ? alpha(theme.palette.common.white, 0.04)
                : alpha(theme.palette.common.black, 0.025),
            }
          : undefined,
      }}
    >
      <Box sx={{ px: 1.75, py: 1.25 }}>
        {/* ── Title row: trade name · PnL ────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 0.75,
          }}
        >
          {trade.name ? (
            <Typography
              sx={{
                fontSize: '0.88rem',
                fontWeight: 600,
                lineHeight: 1.35,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minWidth: 0,
                flex: 1,
              }}
            >
              {trade.name}
            </Typography>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}

          {/* Right cluster: note icon + PnL */}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {trade.notes && (
              <Tooltip title="Has notes" arrow>
                <NoteIcon sx={{ fontSize: '0.95rem', color: 'text.secondary' }} />
              </Tooltip>
            )}

            {/* PnL — colored, tabular, arrow glyph */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.375,
                color: typeColor,
                fontWeight: 700,
                fontSize: '0.95rem',
                letterSpacing: '-0.01em',
                fontFeatureSettings: "'tnum' on, 'lnum' on",
              }}
            >
              <ArrowGlyph sx={{ fontSize: '0.9rem', alignSelf: 'center' }} />
              {formatAmount(trade.amount)}
            </Box>
          </Box>
        </Box>

        {/* ── Tag chips ────────────────────────────────────────────── */}
        {hasTags && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              mb: 0.875,
            }}
          >
            {visibleTagGroups.map(([group, groupTags]) => (
              <Chip
                key={group}
                label={
                  groupTags.length > 1 ? `${group} · ${groupTags.length}` : group
                }
                size="small"
                sx={{
                  ...getTagChipStyles(groupTags[0], theme),
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ))}
            {overflowCount > 0 && (
              <Tooltip title={`${overflowCount} more tag group${overflowCount === 1 ? '' : 's'}`} arrow>
                <Chip
                  label={`+${overflowCount}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    color: 'text.disabled',
                    bgcolor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                    border: `1px dashed ${hairline}`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}

        {/* ── Meta footer: left (R:R) · center (date) · right (icons + session) ── */}
        <Box
          sx={{
            pt: 0.875,
            mt: hasTags ? 0 : 0.25,
            borderTop: `1px solid ${hairline}`,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
          }}
        >
          {/* Left — financial metric */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'start' }}>
            {typeof trade.risk_to_reward === 'number' && (
              <Tooltip title="Risk-to-reward ratio" arrow>
                <Box sx={metaItemSx}>
                  <RiskIcon sx={{ fontSize: '0.85rem' }} />
                  R:R {trade.risk_to_reward.toFixed(2)}
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* Center — date */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
            <Box sx={metaItemSx}>
              {format(new Date(trade.trade_date), 'MMM dd')}
            </Box>
          </Box>

          {/* Right — attachments + flags + session */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'end' }}>
            {hasImages && (
              <Tooltip title={`${imageCount} image${imageCount === 1 ? '' : 's'}`} arrow>
                <Box sx={metaItemSx}>
                  <ImageIcon sx={{ fontSize: '0.95rem' }} />
                  {imageCount}
                </Box>
              </Tooltip>
            )}
            {trade.partials_taken && (
              <Tooltip title="Partial profits taken" arrow>
                <Box sx={metaItemSx}>
                  <PartialsIcon sx={{ fontSize: '0.85rem' }} />
                  Partials
                </Box>
              </Tooltip>
            )}
            {trade.session && (
              <Tooltip title={`${trade.session} session`} arrow>
                <Box sx={metaItemSx}>
                  <SessionIcon sx={{ fontSize: '0.85rem' }} />
                  {trade.session}
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TradeCard;
