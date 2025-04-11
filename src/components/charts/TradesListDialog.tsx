import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  IconButton,
  Typography,
  Box,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Balance as RiskIcon
} from '@mui/icons-material';
import { Trade } from '../../types/trade';
import TradeDetailExpanded from '../TradeDetailExpanded';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { dialogProps } from '../../styles/dialogStyles';

interface TradesDialogProps {
  open: boolean;
  trades: Trade[];
  date: string;
  expandedTradeId: string | null;
  onClose: () => void;
  onTradeExpand: (tradeId: string) => void;
  onZoomImage: (imageUrl: string) => void;
}

const TradesListDialog: React.FC<TradesDialogProps> = ({
  open,
  trades,
  date,
  expandedTradeId,
  onClose,
  onTradeExpand,
  onZoomImage
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 'none',
          border: `1px solid ${theme.palette.divider}`,
          maxHeight: '90vh',
          overflow: 'hidden',
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
          }
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        pb: 2,
        px: 3,
        pt: 2.5,
        fontWeight: 600
      }}>
        <Typography variant="h6">
          Trades for {date}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, px: 3, pb: 3, maxHeight: '70vh', overflowY: 'auto' }}>
        <List sx={{
          '& .MuiListItem-root': {
            borderRadius: 2,
            mb: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.6),
            transition: 'all 0.2s ease',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              cursor: 'pointer',
              borderColor: alpha(theme.palette.primary.main, 0.2)
            }
          }
        }}>
          {trades.map((trade) => (
            <React.Fragment key={trade.id}>
              <ListItem
                onClick={() => onTradeExpand(trade.id)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  p: 2,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderBottomLeftRadius: expandedTradeId === trade.id ? 0 : 8,
                  borderBottomRightRadius: expandedTradeId === trade.id ? 0 : 8,
                  borderBottom: expandedTradeId === trade.id ? 'none' : `1px solid ${theme.palette.divider}`,
                  boxShadow: expandedTradeId === trade.id ? `0 4px 8px ${alpha(theme.palette.primary.main, 0.1)}` : 'none'
                }}
              >
                <Box sx={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: trade.type === 'win'
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                        fontWeight: 600
                      }}
                    >
                      {trade.type === 'win' ? 'Win' : 'Loss'}
                    </Typography>
                    {trade.session && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                          bgcolor: alpha(theme.palette.divider, 0.2),
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1
                        }}
                      >
                        {trade.session}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: trade.amount > 0
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                        fontWeight: 600
                      }}
                    >
                      {trade.amount > 0 ? '+' : ''}{trade.amount.toFixed(2)}
                    </Typography>
                    {expandedTradeId === trade.id ?
                      <CollapseIcon fontSize="small" sx={{ color: 'text.secondary' }} /> :
                      <ExpandIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    }
                  </Box>
                </Box>
                <Box sx={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 1
                }}>
                  {trade.riskToReward && (
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                    }}>
                      <RiskIcon fontSize="small" sx={{ color: alpha(theme.palette.primary.main, 0.8), fontSize: '0.875rem' }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.primary.main,
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        {trade.riskToReward.toFixed(1)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </ListItem>

              {/* Expanded Trade Details */}
              <TradeDetailExpanded
                trade={trade}
                isExpanded={expandedTradeId === trade.id}
                setZoomedImage={onZoomImage}
              />
            </React.Fragment>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default TradesListDialog;
