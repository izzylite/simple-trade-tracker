import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Box,
  Stack,
  TextField,
  useTheme,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
  Alert,
  Autocomplete,
  Chip
} from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade } from '../types/trade';
import {
  DialogTitleStyled,
  DialogContentStyled,
  DialogActionsStyled,
  FormField,
  TradeListItem,
  TradeInfo,
  TradeActions,
  JournalLink
} from './StyledComponents';
import {
  AnimatedSlideDown,
  AnimatedSlideUp,
  AnimatedPulse
} from './Animations';
import { alpha } from '@mui/material/styles';
import { dialogProps } from '../styles/dialogStyles';

interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  accountBalance: number;
  onDateChange: (date: Date) => void;
  onAddTrade?: (trade: Omit<Trade, 'id'>) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onAccountBalanceChange: (balance: number) => void;
  allTrades?: Trade[];
}

interface NewTradeForm {
  amount: string;
  type: 'win' | 'loss';
  journalLink: string;
  tags: string[];
}

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  accountBalance,
  onDateChange,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onAccountBalanceChange,
  allTrades = []
}) => {
  const [newTrade, setNewTrade] = useState<NewTradeForm>({
    amount: '',
    type: 'win',
    journalLink: '',
    tags: []
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const theme = useTheme();

  const isFutureDate = isAfter(startOfDay(date), startOfDay(new Date()));

  const totalPnL = trades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = trades.filter(trade => trade.type === 'win').length;
  const lossCount = trades.filter(trade => trade.type === 'loss').length;
  const percentageGrowth = accountBalance > 0 ? (totalPnL / accountBalance * 100).toFixed(2) : '0';

  // Get all unique tags from all trades
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [allTrades]);

  const handlePreviousDay = () => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    onDateChange(prevDate);
  };

  const handleNextDay = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    onDateChange(nextDate);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewTrade(prev => ({ ...prev, amount: value }));
    }
  };

  const handleTypeChange = (e: SelectChangeEvent<'win' | 'loss'>) => {
    setNewTrade(prev => ({ ...prev, type: e.target.value as 'win' | 'loss' }));
  };

  const handleJournalLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev, journalLink: e.target.value }));
  };

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    setNewTrade({
      amount: Math.abs(trade.amount).toString(),
      type: trade.type,
      journalLink: trade.journalLink || '',
      tags: trade.tags || []
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = (tradeId: string) => {
    if (onDeleteTrade) {
      onDeleteTrade(tradeId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTrade.amount) {
      const amount = parseFloat(newTrade.amount);
      if (!isNaN(amount)) {
        // Get any pending tag from the Autocomplete input
        const pendingTag = document.querySelector<HTMLInputElement>('.MuiAutocomplete-input')?.value;
        let finalTags = [...newTrade.tags];
        
        // If there's text in the tag input, add it as a tag
        if (pendingTag && pendingTag.trim() && !finalTags.includes(pendingTag.trim())) {
          finalTags.push(pendingTag.trim());
        }

        if (editingTrade && onEditTrade) {
          onEditTrade({
            ...editingTrade,
            amount: newTrade.type === 'win' ? amount : -amount,
            type: newTrade.type,
            journalLink: newTrade.journalLink || undefined,
            tags: finalTags.length > 0 ? finalTags : undefined
          });
        } else if (onAddTrade) {
          onAddTrade({
            date,
            amount: newTrade.type === 'win' ? amount : -amount,
            type: newTrade.type,
            journalLink: newTrade.journalLink || undefined,
            tags: finalTags.length > 0 ? finalTags : undefined
          });
        }
        setNewTrade({ amount: '', type: 'win', journalLink: '', tags: [] });
        setShowAddForm(false);
        setEditingTrade(null);
      }
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingTrade(null);
    setNewTrade({ amount: '', type: 'win', journalLink: '', tags: [] });
  };

  const handleTradeClick = (journalLink: string | undefined) => {
    if (journalLink) {
      window.open(journalLink, '_blank');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
    >
      <DialogTitleStyled>
        <Typography variant="h6">
          {date ? format(date, 'MMMM d, yyyy') : ''}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitleStyled>

      <DialogContentStyled>
        <Box sx={{ mb: 3 }}>
          {isFutureDate ? (
            <Alert 
              severity="info" 
              sx={{ 
                mt: 2,
                borderRadius: theme.shape.borderRadius,
                backgroundColor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.info.main, 0.1) 
                  : alpha(theme.palette.info.main, 0.05),
                border: '1px solid',
                borderColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.info.main, 0.2)
                  : alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.main,
                '& .MuiAlert-icon': {
                  color: theme.palette.info.main
                }
              }}
            >
              Cannot add trades for future dates
            </Alert>
          ) : !showAddForm ? (
            <Button 
              variant="contained" 
              color="primary"
              fullWidth
              onClick={() => setShowAddForm(true)}
            >
              Add New Trade
            </Button>
          ) : (
            <AnimatedSlideDown>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {editingTrade ? 'Edit Trade' : 'Add New Trade'}
                </Typography>
                <form onSubmit={handleSubmit}>
                  <FormField>
                    <TextField
                      label="Amount"
                      type="number"
                      value={newTrade.amount}
                      onChange={handleAmountChange}
                      fullWidth
                      required
                    />
                  </FormField>
                  <FormField>
                    <FormControl fullWidth required>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={newTrade.type}
                        onChange={handleTypeChange}
                        label="Type"
                      >
                        <MenuItem value="win">Win</MenuItem>
                        <MenuItem value="loss">Loss</MenuItem>
                      </Select>
                    </FormControl>
                  </FormField>
                  <FormField>
                    <TextField
                      label="Journal Link (optional)"
                      value={newTrade.journalLink}
                      onChange={handleJournalLinkChange}
                      fullWidth
                    />
                  </FormField>
                  <FormField>
                    <Autocomplete
                      multiple
                      freeSolo
                      options={existingTags}
                      value={newTrade.tags}
                      onChange={(_, newValue) => {
                        setNewTrade(prev => ({ ...prev, tags: newValue }));
                      }}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            sx={{
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              '& .MuiChip-deleteIcon': {
                                color: 'primary.main',
                                '&:hover': {
                                  color: 'primary.dark'
                                }
                              }
                            }}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Tags"
                          placeholder="Add tags..."
                          helperText="Type and press enter to add new tags"
                        />
                      )}
                    />
                  </FormField>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button 
                      type="submit" 
                      variant="contained" 
                      color="primary"
                      fullWidth
                    >
                      {editingTrade ? 'Update Trade' : 'Add Trade'}
                    </Button>
                    <Button 
                      variant="outlined" 
                      color="inherit"
                      onClick={handleCancel}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </Box>
                </form>
              </Box>
            </AnimatedSlideDown>
          )}
        </Box>

        {trades.length > 0 ? (
          <Stack spacing={1}>
            {trades.map(trade => (
              <TradeListItem key={trade.id} $type={trade.type}>
                <TradeInfo>
                  <Box>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 500,
                      color: trade.type === 'win' ? 'success.main' : 'error.main'
                    }}>
                      ${Math.abs(trade.amount).toLocaleString()}
                    </Typography>
                    {trade.tags && trade.tags.length > 0 && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {trade.tags.map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            sx={{
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              fontSize: '0.75rem'
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                  {trade.journalLink && (
                    <JournalLink 
                      href={trade.journalLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      View Journal
                    </JournalLink>
                  )}
                </TradeInfo>
                <TradeActions>
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditClick(trade)}
                    sx={{ color: 'text.secondary' }}
                    disabled={isFutureDate}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteClick(trade.id)}
                    sx={{ color: 'error.main' }}
                    disabled={isFutureDate}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TradeActions>
              </TradeListItem>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary" align="center">
            No trades for this day
          </Typography>
        )}
      </DialogContentStyled>

      <DialogActionsStyled>
        <Button onClick={onClose}>Close</Button>
      </DialogActionsStyled>
    </Dialog>
  );
};

export default DayDialog; 