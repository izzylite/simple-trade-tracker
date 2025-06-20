import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  alpha,
  useTheme,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';
import {
  Close as CloseIcon,
  PushPin as PinIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  CalendarToday as DateIcon
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { format } from 'date-fns';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  onTradeClick?: (trade: Trade) => void;
}

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  trades,
  onTradeClick
}) => {
  const theme = useTheme();

  // Get pinned trades
  const pinnedTrades = useMemo(() => {
    return trades.filter(trade => trade.isPinned);
  }, [trades]);

  // Sort pinned trades by date (most recent first)
  const sortedPinnedTrades = useMemo(() => {
    return [...pinnedTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pinnedTrades]);

  const getTradeTypeIcon = (type: Trade['type']) => {
    switch (type) {
      case 'win':
        return <WinIcon sx={{ fontSize: 20, color: 'success.main' }} />;
      case 'loss':
        return <LossIcon sx={{ fontSize: 20, color: 'error.main' }} />;
      case 'breakeven':
        return <BreakevenIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
    }
  };

  const getTradeTypeColor = (type: Trade['type']) => {
    switch (type) {
      case 'win':
        return theme.palette.success.main;
      case 'loss':
        return theme.palette.error.main;
      case 'breakeven':
        return theme.palette.text.secondary;
    }
  };



  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300, // Higher than AppBar (1100) and other components
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100vw',
          zIndex: 1300 // Ensure the paper also has high z-index
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Box sx={{
            p: 1,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <PinIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            Pinned Trades
          </Typography>
          {sortedPinnedTrades.length > 0 && (
            <Chip
              label={sortedPinnedTrades.length}
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                fontWeight: 600
              }}
            />
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {sortedPinnedTrades.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <PinIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                No Pinned Trades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                Pin important trades to keep them easily accessible. Open any trade and click the pin button to add trades here.
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0, overflow: 'auto', height: '100%' }}>
              {sortedPinnedTrades.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => onTradeClick?.(trade)}
                      sx={{
                        p: 2,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                        {/* Trade Type Icon */}
                        <Box sx={{ mt: 0.5 }}>
                          {getTradeTypeIcon(trade.type)}
                        </Box>

                        {/* Trade Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                    mr: 1
                                  }}
                                >
                                  {trade.name || `Trade ${trade.id.slice(-6)}`}
                                </Typography>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 700,
                                    color: getTradeTypeColor(trade.type),
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {trade.amount > 0 ? '+' : ''}${Math.abs(trade.amount).toFixed(2)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                {/* Date and Session */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <DateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {format(new Date(trade.date), 'MMM dd, yyyy')}
                                  </Typography>
                                  {trade.session && (
                                    <Chip
                                      label={trade.session}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        borderColor: alpha(theme.palette.text.secondary, 0.3),
                                        color: 'text.secondary'
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Tags */}
                                {trade.tags && trade.tags.length > 0 && (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {trade.tags.slice(0, 4).map((tag) => (
                                      <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          borderColor: alpha(theme.palette.primary.main, 0.3),
                                          color: 'primary.main'
                                        }}
                                      />
                                    ))}
                                    {trade.tags.length > 4 && (
                                      <Chip
                                        label={`+${trade.tags.length - 4}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          borderColor: alpha(theme.palette.text.secondary, 0.3),
                                          color: 'text.secondary'
                                        }}
                                      />
                                    )}
                                  </Box>
                                )}
                              </Box>
                            }
                          />
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < sortedPinnedTrades.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default PinnedTradesDrawer;
