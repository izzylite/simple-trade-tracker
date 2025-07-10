import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  Divider
} from '@mui/material';
import {
  Share as ShareIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';
import { logger } from '../../utils/logger';

interface PublicSharedTrade {
  id: string;
  tradeId: string;
  calendarId: string;
  trade: any;
  shareLink: string;
  createdAt: any;
  viewCount: number;
}

interface PublicSharedTradesListProps {
  calendarOwnerId: string;
  maxItems?: number;
  showHeader?: boolean;
}

const PublicSharedTradesList: React.FC<PublicSharedTradesListProps> = ({
  calendarOwnerId,
  maxItems = 5,
  showHeader = true
}) => {
  const theme = useTheme();
  const [sharedTrades, setSharedTrades] = useState<PublicSharedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicSharedTrades();
  }, [calendarOwnerId]);

  const loadPublicSharedTrades = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const getPublicSharedTrades = httpsCallable(functions, 'getPublicSharedTradesV2');
      
      const result = await getPublicSharedTrades({ userId: calendarOwnerId });
      const trades = result.data as PublicSharedTrade[];
      setSharedTrades(trades);
    } catch (error) {
      logger.error('Error loading public shared trades:', error);
      setError('Failed to load shared trades');
    } finally {
      setLoading(false);
    }
  };

  const formatTradeTitle = (trade: any) => {
    const symbol = trade.symbol || 'Unknown';
    const type = trade.type === 'win' ? '✅' : trade.type === 'loss' ? '❌' : '⚪';
    const amount = trade.amount ? `$${Math.abs(trade.amount).toFixed(2)}` : '';
    return `${type} ${symbol} ${amount}`;
  };

  const handleOpenTrade = (shareLink: string) => {
    window.open(shareLink, '_blank');
  };

  const displayedTrades = maxItems ? sharedTrades.slice(0, maxItems) : sharedTrades;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (sharedTrades.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <ShareIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Shared Trades
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This trader hasn't shared any trades yet
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {showHeader && (
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShareIcon color="primary" />
            Shared Trades ({sharedTrades.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Recent trades shared by this trader
          </Typography>
        </Box>
      )}
      
      <List sx={{ p: 0 }}>
        {displayedTrades.map((sharedTrade, index) => {
          const trade = sharedTrade.trade;
          const isWin = trade.type === 'win';
          const isLoss = trade.type === 'loss';
          
          return (
            <ListItem
              key={sharedTrade.id}
              sx={{
                borderBottom: index < displayedTrades.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                py: 2,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
              onClick={() => handleOpenTrade(sharedTrade.shareLink)}
            >
              <Avatar
                sx={{
                  bgcolor: isWin ? 'success.main' : isLoss ? 'error.main' : 'grey.500',
                  mr: 2,
                  width: 40,
                  height: 40
                }}
              >
                {isWin ? (
                  <TrendingUpIcon />
                ) : isLoss ? (
                  <TrendingDownIcon />
                ) : (
                  <ShareIcon />
                )}
              </Avatar>
              
              <ListItemText
                primary={
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {formatTradeTitle(trade)}
                  </Typography>
                }
                secondary={
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Shared {format(new Date(sharedTrade.createdAt.seconds * 1000), 'MMM dd, yyyy')}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        icon={<ViewIcon />}
                        label={`${sharedTrade.viewCount} views`}
                        size="small"
                        variant="outlined"
                      />
                      {trade.tags && trade.tags.length > 0 && (
                        <Chip
                          label={trade.tags[0]}
                          size="small"
                          sx={{
                            maxWidth: 100,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main'
                          }}
                        />
                      )}
                      <Chip
                        icon={<OpenIcon />}
                        label="View Trade"
                        size="small"
                        clickable
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                }
              />
            </ListItem>
          );
        })}
      </List>
      
      {sharedTrades.length > maxItems && (
        <Box sx={{ p: 2, textAlign: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" color="text.secondary">
            Showing {maxItems} of {sharedTrades.length} shared trades
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PublicSharedTradesList;
