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
  compact?: boolean;
  onClick?: () => void;
  showImages?: boolean;
}

const TradeCard: React.FC<TradeCardProps> = ({
  trade,
  compact = true,
  onClick,
  showImages = false
}) => {
  const theme = useTheme();

  const getTradeTypeIcon = () => {
    switch (trade.type) {
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
    switch (trade.type) {
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
    switch (trade.type) {
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
    return `${sign}$${amount.toFixed(2)}`;
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

  return (
    <Card
      sx={{
        maxWidth: compact ? 400 : 500,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        border: '1px solid',
        borderColor: alpha(getTradeTypeColorValue(), 0.2),
        backgroundColor: alpha(getTradeTypeColorValue(), 0.05),
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(getTradeTypeColorValue(), 0.2)}`,
          borderColor: getTradeTypeColorValue()
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: compact ? 2 : 3, '&:last-child': { pb: compact ? 2 : 3 } }}>
        <Stack spacing={compact ? 1 : 1.5}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              {trade.name && (
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {trade.name}
                </Typography>
              )}
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
            {trade.riskToReward && compact && (
              <Tooltip title={`Risk to Reward: ${trade.riskToReward.toFixed(2)}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RiskIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {trade.riskToReward.toFixed(2)}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {trade.partialsTaken && (
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
          </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(trade.date), 'MMM dd, yyyy')}
                </Typography>
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
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getTradeTypeIcon()}
              <Typography
                variant="h6"
                fontWeight="bold"
                color={`${getTradeTypeColorName()}.main`}
                sx={{ fontSize: compact ? '1rem' : '1.25rem' }}
              >
                {formatAmount(trade.amount)}
              </Typography>
            </Box>
          </Box>

          {/* Trade Details */}
          {!compact && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {trade.entry && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Entry</Typography>
                  <Typography variant="body2" fontWeight="medium">{trade.entry}</Typography>
                </Box>
              )}
              {trade.exit && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Exit</Typography>
                  <Typography variant="body2" fontWeight="medium">{trade.exit}</Typography>
                </Box>
              )}
              {trade.riskToReward && (
                <Box>
                  <Typography variant="caption" color="text.secondary">R:R</Typography>
                  <Typography variant="body2" fontWeight="medium">{trade.riskToReward.toFixed(2)}</Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Tags */}
          {/* {trade.tags && trade.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(groupedTags).map(([group, groupTags]) => (
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
            </Box>
          )} */}

         
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TradeCard;
