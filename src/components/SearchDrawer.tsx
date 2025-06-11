import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  useTheme,
  TextField,
  Drawer,
  IconButton,
  alpha,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  CalendarToday as DateIcon
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { format } from 'date-fns';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup
} from '../utils/tagColors';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  allTags: string[];
  onTradeClick?: (trade: Trade) => void;
}

// Debounce hook for search optimization
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Background search worker function
const performSearch = (trades: Trade[], query: string): Trade[] => {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  // Check if query contains multiple tags (separated by spaces, commas, or semicolons)
  const searchTerms = lowerQuery
    .split(/[,;\s]+/) // Split by comma, semicolon, or whitespace
    .map(term => term.trim())
    .filter(term => term.length > 0);

  return trades.filter(trade => {
    // For multiple search terms, check if ALL terms match (AND logic)
    // For single term, use the original OR logic across different fields

    if (searchTerms.length > 1) {
      // Multiple terms - check if ALL terms are found in the trade's tags
      return searchTerms.every(term => {
        if (!trade.tags || trade.tags.length === 0) return false;

        return trade.tags.some(tag =>
          tag.toLowerCase().includes(term) ||
          formatTagForDisplay(tag).toLowerCase().includes(term)
        );
      });
    } else {
      // Single term - search across all fields (original behavior)
      const term = searchTerms[0];

      // Search by trade name
      if (trade.name && trade.name.toLowerCase().includes(term)) {
        return true;
      }

      // Search by tags
      if (trade.tags && trade.tags.some(tag =>
        tag.toLowerCase().includes(term) ||
        formatTagForDisplay(tag).toLowerCase().includes(term)
      )) {
        return true;
      }

      // Search by notes
      if (trade.notes && trade.notes.toLowerCase().includes(term)) {
        return true;
      }

      // Search by session
      if (trade.session && trade.session.toLowerCase().includes(term)) {
        return true;
      }

      return false;
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date, newest first
};

// Background tag suggestion function
const getSuggestedTags = (allTags: string[], query: string): string[] => {
  if (!query.trim()) return [];

  // Get the last term being typed (for multi-tag support)
  const terms = query.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);
  const lastTerm = terms[terms.length - 1]?.toLowerCase() || '';

  if (!lastTerm) return [];

  // Filter out tags that are already in the search query
  const existingTags = terms.slice(0, -1).map(term => term.toLowerCase());

  return allTags
    .filter(tag => {
      const lowerTag = tag.toLowerCase();
      const displayTag = formatTagForDisplay(tag).toLowerCase();

      // Don't suggest tags that are already included
      if (existingTags.some(existing =>
        lowerTag.includes(existing) || displayTag.includes(existing)
      )) {
        return false;
      }

      // Match the current term being typed
      return lowerTag.includes(lastTerm) || displayTag.includes(lastTerm);
    })
    .slice(0, 5); // Limit to 5 suggestions
};

const SearchDrawer: React.FC<SearchDrawerProps> = ({
  open,
  onClose,
  trades,
  allTags,
  onTradeClick
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  // Debounce search query to avoid excessive calculations
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Perform search in background when debounced query changes
  useEffect(() => {
    if (!open) return; // Don't search if drawer is closed

    const performBackgroundSearch = async () => {
      setIsSearching(true);

      // Use setTimeout to move computation to next tick (background)
      setTimeout(() => {
        try {
          const results = performSearch(trades, debouncedSearchQuery);
          const suggestions = getSuggestedTags(allTags, debouncedSearchQuery);

          setFilteredTrades(results);
          setSuggestedTags(suggestions);
        } catch (error) {
          console.error('Search error:', error);
          setFilteredTrades([]);
          setSuggestedTags([]);
        } finally {
          setIsSearching(false);
        }
      }, 0);
    };

    performBackgroundSearch();
  }, [debouncedSearchQuery, trades, allTags, open]);

  // Reset search when drawer closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setFilteredTrades([]);
      setSuggestedTags([]);
      setIsSearching(false);
    }
  }, [open]);

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

  const handleTagClick = useCallback((tag: string) => {
    // Smart tag appending for multi-tag search
    const currentTerms = searchQuery.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);

    if (currentTerms.length === 0) {
      // No existing terms, just set the tag
      setSearchQuery(tag);
    } else {
      // Replace the last term (which is being typed) with the selected tag
      const newTerms = [...currentTerms.slice(0, -1), tag];
      setSearchQuery(newTerms.join(', ') + ', ');
    }
  }, [searchQuery]);

  const handleTradeClick = useCallback((trade: Trade) => {
    onTradeClick?.(trade);
    onClose();
  }, [onTradeClick, onClose]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300, // Higher than AppBar (1100) and other components
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
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
            <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            Search Trades
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Search Input */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <TextField
            fullWidth
            placeholder="Search by name, tags, notes, or session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    {isSearching ? (
                      <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
                    ) : (
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    )}
                  </InputAdornment>
                )
              }
            }}
            variant="outlined"
            size="small"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            💡 Use multiple tags separated by spaces, commas, or semicolons to find trades with ALL specified tags
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme)
        }}>
          {/* Tag Suggestions */}
          {suggestedTags.length > 0 && (
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Tag Suggestions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {suggestedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={formatTagForDisplay(tag, true)}
                    size="small"
                    clickable
                    onClick={() => handleTagClick(tag)}
                    sx={{
                      ...getTagChipStyles(tag, theme),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Search Results */}
          {searchQuery.trim() && (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Search Results {!isSearching && `(${filteredTrades.length})`}
                </Typography>
                {(() => {
                  const terms = searchQuery.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);
                  if (terms.length > 1) {
                    return (
                      <Chip
                        label={`${terms.length} tags (AND)`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    );
                  }
                  return null;
                })()}
              </Box>

              {isSearching ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Searching trades...
                  </Typography>
                </Box>
              ) : filteredTrades.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No trades found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try searching with different keywords
                  </Typography>
                </Box>
              ) : (
                <List sx={{
                  p: 0,
                  ...scrollbarStyles(theme)
                }}>
                  {filteredTrades.map((trade, index) => (
                    <React.Fragment key={trade.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => handleTradeClick(trade)}
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
                                        {trade.tags.slice(0, 3).map((tag) => (
                                          <Chip
                                            key={tag}
                                            label={formatTagForDisplay(tag, true)}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                              height: 20,
                                              fontSize: '0.7rem',
                                              ...getTagChipStyles(tag, theme)
                                            }}
                                          />
                                        ))}
                                        {trade.tags.length > 3 && (
                                          <Chip
                                            label={`+${trade.tags.length - 3}`}
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
                      {index < filteredTrades.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && (
            <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                Search Your Trades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 350, mx: 'auto', mb: 2 }}>
                Search by trade name, tags, notes, or session to quickly find specific trades.
              </Typography>
              <Box sx={{ textAlign: 'left', maxWidth: 350, mx: 'auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  Examples:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <code>scalping</code> - Find trades with "scalping" tag
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <code>scalping, morning</code> - Find trades with BOTH tags
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • <code>EURUSD breakout</code> - Find trades with both terms
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default SearchDrawer;
