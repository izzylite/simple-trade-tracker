/**
 * TradeCard Component for AI Chat
 * Compact trade card specifically designed for displaying trade information in AI chat responses
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Tooltip,
  alpha
} from '@mui/material';
import {
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  Schedule as SessionIcon,
  Note as NoteIcon,
  Image as ImageIcon,
  Balance as RiskIcon,
  CalendarToday as DateIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from '../../types/trade';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../../utils/tagColors';

interface TradeCardProps {
  trade: Trade;
  showTags?: boolean;
  onClick?: () => void;
  showImages?: boolean;
}

const TradeCard: React.FC<TradeCardProps> = ({
  trade,
  onClick,
  showTags,
  showImages = false
}) => {
  const theme = useTheme();

  const getTradeTypeIcon = () => {
    switch (trade.trade_type) {
      case 'win':
        return <WinIcon sx={{ fontSize: '1rem', color: 'success.main' }} />;
      case 'loss':
        return <LossIcon sx={{ fontSize: '1rem', color: 'error.main' }} />;
      case 'breakeven':
        return <BreakevenIcon sx={{ fontSize: '1rem', color: 'info.main' }} />;
      default:
        return null;
    }
  };

  const getTradeTypeColorName = () => {
    switch (trade.trade_type) {
      case 'win':
        return 'success';
      case 'loss':
        return 'error';
      case 'breakeven':
        return 'info';
      default:
        return 'primary';
    }
  };

  const getTradeTypeColorValue = () => {
    switch (trade.trade_type) {
      case 'win':
        return theme.palette.success.main;
      case 'loss':
        return theme.palette.error.main;
      case 'breakeven':
        return theme.palette.info.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Group tags by category for compact display
  const groupedTags = trade.tags?.reduce((groups, tag) => {
    if (isGroupedTag(tag)) {
      const group = getTagGroup(tag);
      if (!groups[group]) groups[group] = [];
      groups[group].push(tag);
    } else {
      if (!groups['Other']) groups['Other'] = [];
      groups['Other'].push(tag);
    }
    return groups;
  }, {} as Record<string, string[]>) || {};

  // Limit to first 5 tag groups
  const MAX_VISIBLE_TAGS = 5;
  const tagEntries = Object.entries(groupedTags);
  const visibleTags = tagEntries.slice(0, MAX_VISIBLE_TAGS);
  const remainingTagsCount = tagEntries.length - MAX_VISIBLE_TAGS;
  const hasMoreTags = remainingTagsCount > 0;

  return (
    <Card
      sx={{
        maxWidth: 400,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        border: '1px solid',
        borderColor: alpha(getTradeTypeColorValue(), 0.2),
        backgroundColor: alpha(getTradeTypeColorValue(), 0.05),
        '&:hover': onClick ? { 
          boxShadow: `0 4px 12px ${alpha(getTradeTypeColorValue(), 0.2)}`,
          borderColor: getTradeTypeColorValue()
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2, pt: 1, '&:last-child': { pb: 1 } }}>
        <Stack spacing={1}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  {trade.name && (
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
                      {trade.name}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTradeTypeIcon()}
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    color={`${getTradeTypeColorName()}.main`}
                    sx={{ fontSize: '1rem' }}
                  >
                    {formatAmount(trade.amount)}
                  </Typography>
                </Box>
              </Box>
              {/* Additional Info Icons */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {trade.notes && (
                  <Tooltip title="Has notes">
                    <NoteIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                  </Tooltip>
                )}
                {trade.images && trade.images.length > 0 && showImages && (
                  <Tooltip title={`${trade.images.length} image(s)`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ImageIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {trade.images.length}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
                {trade.risk_to_reward &&  (
                  <Tooltip title={`Risk to Reward: ${trade.risk_to_reward.toFixed(2)}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <RiskIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {trade.risk_to_reward.toFixed(2)}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
                {trade.partials_taken && (
                  <Tooltip title="Partials taken">
                    <Chip
                      label="Partials"
                      size="small"
                      variant="outlined"
                      sx={{
                        height: '18px',
                        fontSize: '0.65rem',
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                  </Tooltip>
                )}

                <>
                  <DateIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" noWrap>{format(new Date(trade.trade_date), 'MMM dd, yyyy')}</Typography>
                </>

                {trade.session && (
                  <>
                    <SessionIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {trade.session}
                    </Typography>
                  </>
                )}
              </Box>




            </Box>
          </Box>
         

          {/* Tags */}
          {showTags && trade.tags && trade.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {visibleTags.map(([group, groupTags]) => (
                <Tooltip
                  key={group}
                  title={
                    <Box sx={{ p: 0.5 }}>
                      {groupTags.map(tag => (
                        <Typography key={tag} variant="body2">
                          {formatTagForDisplay(tag, true)}
                        </Typography>
                      ))}
                    </Box>
                  }
                  arrow
                >
                  <Chip
                    label={`${group}${groupTags.length > 1 ? ` (${groupTags.length})` : ''}`}
                    size="small"
                    sx={{
                      ...getTagChipStyles(groupTags[0], theme),
                      height: '20px',
                      fontSize: '0.7rem',
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                </Tooltip>
              ))}

              {/* Show +N chip if there are more tags */}
              {hasMoreTags && (
                 <Chip
                    label={`+${remainingTagsCount}`}
                    size="small"
                    sx={{
                      height: '20px',
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.08)',
                      color: 'text.secondary',
                      fontWeight: 600,
                      border: '1px dashed',
                      borderColor: 'divider',
                      fontSize: '0.7rem',
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
              )}
            </Box>
          )}


        </Stack>
      </CardContent>
    </Card>
  );
};

export default TradeCard;
