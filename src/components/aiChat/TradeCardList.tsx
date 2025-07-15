/**
 * TradeCardList Component for AI Chat
 * Displays a list of trades in a compact card format for AI chat responses
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Collapse,
  Stack,
  Chip,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { Trade } from '../../types/trade';
import TradeCard from './TradeCard';

interface TradeCardListProps {
  trades: Trade[];
  title?: string;
  maxInitialDisplay?: number;
  onTradeClick?: (trade: Trade) => void;
  showSummary?: boolean;
  compact?: boolean;
}

const TradeCardList: React.FC<TradeCardListProps> = ({
  trades,
  title,
  maxInitialDisplay = 3,
  onTradeClick,
  showSummary = true,
  compact = true
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!trades || trades.length === 0) {
    return null;
  }

  const displayedTrades = trades.slice(0, maxInitialDisplay);
  const hasMoreTrades = trades.length > maxInitialDisplay;

  // Calculate summary statistics
  const totalPnL = trades.reduce((sum, trade) => sum + trade.amount, 0);
  const winTrades = trades.filter(trade => trade.type === 'win');
  const lossTrades = trades.filter(trade => trade.type === 'loss');
  const breakevenTrades = trades.filter(trade => trade.type === 'breakeven');
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
  };

  const getSummaryColor = () => {
    if (totalPnL > 0) return 'success';
    if (totalPnL < 0) return 'error';
    return 'info';
  };

  return (
    <Box sx={{ my: 2 }}>
      {/* Header with title and summary */}
      <Box sx={{ mb: 2 }}>
        {title && (
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            {title}
          </Typography>
        )}
        
        {showSummary && (
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1, 
            alignItems: 'center',
            p: 1.5,
            backgroundColor: alpha(theme.palette[getSummaryColor()].main, 0.05),
            borderRadius: 1,
            border: '1px solid',
            borderColor: alpha(theme.palette[getSummaryColor()].main, 0.2)
          }}>
            <Chip
              label={`${trades.length} trades`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
            <Chip
              label={formatAmount(totalPnL)}
              size="small"
              color={getSummaryColor()}
              sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
            />
            <Chip
              label={`${winRate.toFixed(1)}% win rate`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
            
            {/* Trade type breakdown */}
            {winTrades.length > 0 && (
              <Chip
                icon={<WinIcon sx={{ fontSize: '0.75rem' }} />}
                label={winTrades.length}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
            {lossTrades.length > 0 && (
              <Chip
                icon={<LossIcon sx={{ fontSize: '0.75rem' }} />}
                label={lossTrades.length}
                size="small"
                color="error"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
            {breakevenTrades.length > 0 && (
              <Chip
                icon={<BreakevenIcon sx={{ fontSize: '0.75rem' }} />}
                label={breakevenTrades.length}
                size="small"
                color="info"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Trade Cards */}
      <Stack spacing={1.5}>
        {displayedTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            compact={compact}
            onClick={onTradeClick ? () => onTradeClick(trade) : undefined}
            showImages={true}
          />
        ))}
      </Stack>

      {/* Expand/Collapse Button */}
      {hasMoreTrades && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ fontSize: '0.875rem' }}
          >
            {expanded 
              ? 'Show Less' 
              : `Show ${trades.length - maxInitialDisplay} More Trades`
            }
          </Button>
        </Box>
      )}

      {/* Additional trades in collapsed state */}
      <Collapse in={expanded}>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          {trades.slice(maxInitialDisplay).map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              compact={compact}
              onClick={onTradeClick ? () => onTradeClick(trade) : undefined}
              showImages={true}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default TradeCardList;
