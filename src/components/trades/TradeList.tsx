import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  SxProps,
  Theme,
  CircularProgress,
  Checkbox,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  LinearProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Image as ImageIcon,
  Note as NoteIcon,
  Balance as RiskIcon,
  Schedule as SessionIcon,
  SelectAll as SelectAllIcon,
  DeleteSweep as DeleteMultipleIcon,
  KeyboardArrowDown as LoadMoreIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { Trade } from '../../types/dualWrite';
import { TradeListItem, TradeInfo, TradeActions } from '../StyledComponents';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../../utils/tagColors';
import { useTheme } from '@mui/material/styles';
import TradeDetailExpanded from '../TradeDetailExpanded';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import { useTradeSyncContextOptional } from '../../contexts/TradeSyncContext';

// Memoized component for tag display to prevent recalculating on every render
const TradeTagsDisplay: React.FC<{ tags: string[] }> = React.memo(({ tags }) => {
  const theme = useTheme();

  const tagDisplayData = useMemo(() => {
    const filteredTags = tags.filter(tag => !tag.startsWith('Partials:'));
    const tagGroups: Record<string, string[]> = {};
    const ungroupedTags: string[] = [];

    filteredTags.forEach(tag => {
      if (isGroupedTag(tag)) {
        const group = getTagGroup(tag);
        if (!tagGroups[group]) tagGroups[group] = [];
        tagGroups[group].push(tag);
      } else {
        ungroupedTags.push(tag);
      }
    });

    const MAX_VISIBLE_ITEMS = 5;
    const groupEntries = Object.entries(tagGroups);
    const totalItems = groupEntries.length + ungroupedTags.length;
    const hasMore = totalItems > MAX_VISIBLE_ITEMS;
    let visibleGroups = groupEntries;
    let visibleUngroupedTags = ungroupedTags;
    let remainingCount = 0;

    if (hasMore) {
      const availableSlots = MAX_VISIBLE_ITEMS;
      if (groupEntries.length >= availableSlots) {
        visibleGroups = groupEntries.slice(0, availableSlots);
        remainingCount = totalItems - availableSlots;
        visibleUngroupedTags = [];
      } else {
        const remainingSlots = availableSlots - groupEntries.length;
        visibleUngroupedTags = ungroupedTags.slice(0, remainingSlots);
        remainingCount = totalItems - (groupEntries.length + remainingSlots);
      }
    }

    return {
      visibleGroups,
      visibleUngroupedTags,
      hasMore,
      remainingCount,
      groupEntries,
      ungroupedTags
    };
  }, [tags]);

  if (tags.length === 0) return null;

  const {
    visibleGroups,
    visibleUngroupedTags,
    hasMore,
    remainingCount,
    groupEntries,
    ungroupedTags
  } = tagDisplayData;

  return (
    <>
      {visibleGroups.map(([group, groupTags]) => (
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
            label={`${group} ${groupTags.length > 1 ? groupTags.length : ""}`}
            size="small"
            sx={{
              ...getTagChipStyles(groupTags[0], theme),
              height: '20px',
              fontWeight: 600,
              '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
            }}
          />
        </Tooltip>
      ))}
      {visibleUngroupedTags.map((tag, tagIndex) => (
        <Chip
          key={tagIndex}
          label={formatTagForDisplay(tag)}
          size="small"
          sx={{
            ...getTagChipStyles(tag, theme),
            height: '20px',
            '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
          }}
        />
      ))}
      {hasMore && remainingCount > 0 && (
        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {remainingCount} more tag{remainingCount > 1 ? 's' : ''}
              </Typography>
              {groupEntries.slice(visibleGroups.length).map(([group, groupTags]) => (
                <Box key={group} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {group}:
                  </Typography>
                  {groupTags.map(tag => (
                    <Typography key={tag} variant="body2" sx={{ ml: 1 }}>
                      {formatTagForDisplay(tag, true)}
                    </Typography>
                  ))}
                </Box>
              ))}
              {ungroupedTags.slice(visibleUngroupedTags.length).map(tag => (
                <Typography key={tag} variant="body2">
                  {formatTagForDisplay(tag)}
                </Typography>
              ))}
            </Box>
          }
          arrow
        >
          <Chip
            label={`+${remainingCount}`}
            size="small"
            sx={{
              height: '20px',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              color: 'text.secondary',
              fontWeight: 600,
              border: '1px dashed',
              borderColor: 'divider',
              '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
            }}
          />
        </Tooltip>
      )}
    </>
  );
});

TradeTagsDisplay.displayName = 'TradeTagsDisplay';

interface TradeListProps {
  // Component-specific props
  trades: Trade[];
  expandedTradeId: string | null;
  onTradeClick: (tradeId: string) => void;
  hideActions?: boolean;
  enableBulkSelection?: boolean;
  sx?: SxProps<Theme>;
  initialPageSize?: number;
  pageSize?: number;

  // Trade operations - required
  tradeOperations: TradeOperationsProps;
}

const TradeList: React.FC<TradeListProps> = ({
  trades,
  expandedTradeId,
  onTradeClick,
  hideActions = false,
  enableBulkSelection = false,
  sx,
  initialPageSize = 20,
  pageSize = 20,
  tradeOperations
}) => {
  // Destructure from tradeOperations
  const {
    onEditTrade: onEditClick,
    onDeleteTrade: onDeleteClick,
    onDeleteMultipleTrades: onDeleteMultiple,
    deletingTradeIds = [],
  } = tradeOperations;

  // Subscribe to global trade sync context for updating state (single source of truth)
  const tradeSync = useTradeSyncContextOptional();

  const theme = useTheme();
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [displayedCount, setDisplayedCount] = useState<number>(initialPageSize);

  // Safe access to trades length
  const tradesLength = trades?.length || 0;

  // Menu state for per-trade actions
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTrade, setMenuTrade] = useState<Trade | null>(null);

  // Responsive helpers
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLElement>, trade: Trade) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setMenuTrade(trade);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuTrade(null);
  }, []);

  const handleEditSelected = useCallback(() => {
    if (menuTrade && onEditClick) onEditClick(menuTrade);
    handleCloseMenu();
  }, [menuTrade, onEditClick, handleCloseMenu]);

  const handleDeleteSelected = useCallback(() => {
    if (menuTrade && onDeleteClick) onDeleteClick(menuTrade.id);
    handleCloseMenu();
  }, [menuTrade, onDeleteClick, handleCloseMenu]);

  // Reset displayed count when trades array changes (e.g., filtering, new data)
  useEffect(() => {
    setDisplayedCount(initialPageSize);
  }, [tradesLength, initialPageSize]);

  // Get the trades to display based on pagination
  const displayedTrades = useMemo(() => {
    return (trades || []).slice(0, displayedCount);
  }, [trades, displayedCount]);

  // Check if there are more trades to load
  const hasMoreTrades = displayedCount < tradesLength;

  // Handle load more - wrapped in useCallback
  const handleLoadMore = useCallback(() => {
    setDisplayedCount(prev => Math.min(prev + pageSize, tradesLength));
  }, [pageSize, tradesLength]);

  // Helper function to check if a trade is being deleted
  const isTradeBeingDeleted = useCallback((tradeId: string) => deletingTradeIds.includes(tradeId), [deletingTradeIds]);

  // Helper function to check if a trade is being updated
  // Uses global context as single source of truth
  const isTradeBeingUpdated = useCallback((tradeId: string) => {
    return tradeSync?.isTradeUpdating(tradeId) || false;
  }, [tradeSync]);

  // Helper function to check if a trade is selected
  const isTradeSelected = useCallback((tradeId: string) => selectedTradeIds.includes(tradeId), [selectedTradeIds]);

  // Handle individual trade selection
  const handleTradeSelection = useCallback((tradeId: string, selected: boolean) => {
    if (selected) {
      setSelectedTradeIds(prev => [...prev, tradeId]);
    } else {
      setSelectedTradeIds(prev => prev.filter(id => id !== tradeId));
    }
  }, []);

  // Handle select all/none (only for displayed trades)
  const handleSelectAll = useCallback(() => {
    if (selectedTradeIds.length === displayedTrades.length) {
      setSelectedTradeIds([]);
    } else {
      setSelectedTradeIds(displayedTrades.map(trade => trade.id));
    }
  }, [selectedTradeIds.length, displayedTrades]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    if (onDeleteMultiple && selectedTradeIds.length > 0) {
      onDeleteMultiple(selectedTradeIds);
      setSelectedTradeIds([]);
    }
  }, [onDeleteMultiple, selectedTradeIds]);

  return (
    <Box sx={{ mt: 2, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 1 }}>
           {displayedCount < tradesLength ? `${displayedCount} of ${tradesLength}` : tradesLength} Trades
          </Typography>
        
          {enableBulkSelection && selectedTradeIds.length > 0 && (
            <Chip
              label={`${selectedTradeIds.length} selected`}
              size="small"
              color="secondary"
              sx={{
                height: 20,
                ml: 1,
                '& .MuiChip-label': { px: 1, fontSize: '0.75rem' }
              }}
            />
          )}
        </Box>

        {enableBulkSelection && displayedTrades.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<SelectAllIcon />}
              onClick={handleSelectAll}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              {selectedTradeIds.length === displayedTrades.length ? 'None' : 'All'}
            </Button>
            {selectedTradeIds.length > 0 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteMultipleIcon />}
                onClick={handleBulkDelete}
                sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
              >
                Delete ({selectedTradeIds.length})
              </Button>
            )}
          </Box>
        )}
      </Box>

      {tradesLength === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No trades for this day
        </Typography>
      ) : (
        <Stack spacing={1}>
          {displayedTrades.map((trade) => (
            <React.Fragment key={trade.id}>
              <Box sx={{ position: 'relative' }}>
                {isTradeBeingUpdated(trade.id) && (
                  <LinearProgress
                    sx={{
                      mx: 1,
                      mt: 0.4,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      height: 2,
                      borderRadius: '8px 8px 0 0'
                    }}
                  />
                )}
                <TradeListItem
                  $type={trade.trade_type}
                  onClick={isTradeBeingDeleted(trade.id) ? undefined : () => onTradeClick(trade.id)}
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    cursor: isTradeBeingDeleted(trade.id) ? 'default' : 'pointer',
                    ...(trade.is_temporary && {
                      opacity: 0.7,
                      border: '1px dashed',
                      borderColor: 'divider',
                      backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                    }),
                    ...(isTradeBeingDeleted(trade.id) && {
                      opacity: 0.6,
                      pointerEvents: 'none'
                    }),
                    ...(enableBulkSelection && isTradeSelected(trade.id) && {
                      backgroundColor: theme => theme.palette.mode === 'dark'
                        ? 'rgba(144, 202, 249, 0.08)'
                        : 'rgba(25, 118, 210, 0.08)',
                      borderColor: 'primary.main'
                    })
                  }}
                >
                {enableBulkSelection && (
                  <Box
                    sx={{ mr: 1, display: 'flex', alignItems: 'flex-start', pt: 0.5 }}
                    onClick={(e) => e.stopPropagation()} // Prevent event bubbling to parent
                  >
                    <Checkbox
                      size="small"
                      checked={isTradeSelected(trade.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleTradeSelection(trade.id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()} // Additional protection
                      disabled={isTradeBeingDeleted(trade.id)}
                      sx={{ p: 0.5 }}
                    />
                  </Box>
                )}
                <TradeInfo>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {trade.name && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {trade.is_temporary ? trade.name : `📈 ${trade.name.replace(/^📈 /, '')}`}
                          </Typography>

                        </Box>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="body1" sx={{
                          fontSize: { xs: '0.95rem', sm: '1rem', md: '1.05rem' },
                          fontWeight: 600,
                          color: trade.trade_type === 'win'
                            ? 'success.main'
                            : trade.trade_type === 'loss'
                              ? 'error.main'
                              : 'info.main'
                        }}>
                          ${Math.abs(trade.amount).toLocaleString()}
                        </Typography>
                        {trade.tags && trade.tags.length > 0 && (
                          <TradeTagsDisplay tags={trade.tags} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'row', gap: { xs: 0.75, sm: 1, md: 1.5 }, alignItems: 'center', mt: { xs: 0.25, sm: 0.5 }, flexWrap: 'wrap' }}>
                        {trade.images && trade.images.length > 0 && (
                          <Tooltip title={`${trade.images.length} image${trade.images.length > 1 ? 's' : ''}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <ImageIcon
                                fontSize="small"
                                sx={{
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  verticalAlign: 'middle',
                                  color: theme.palette.primary.main
                                }}
                              />
                            </Box>
                          </Tooltip>
                        )}

                        {trade.notes && (
                          <Tooltip title={trade.notes}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <NoteIcon
                                fontSize="small"
                                sx={{
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  verticalAlign: 'middle',
                                  color: theme.palette.info.main
                                }}
                              />
                            </Box>
                          </Tooltip>
                        )}

                        {trade.risk_to_reward && (
                          <Tooltip title={`Risk to Reward: ${trade.risk_to_reward}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RiskIcon
                                fontSize="small"
                                sx={{
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  verticalAlign: 'middle',
                                  color: theme.palette.warning.main
                                }}
                              />
                              <Typography variant="caption" sx={{
                                fontSize: '0.7rem',
                                color: 'text.secondary',
                                fontWeight: 500,
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                px: 0.5,
                                py: 0.2,
                                borderRadius: 0.5
                              }}>
                                {trade.risk_to_reward}R
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}

                        {trade.session && (
                          <Tooltip title={`Session: ${trade.session}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SessionIcon
                                fontSize="small"
                                sx={{
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  verticalAlign: 'middle',
                                  color: theme.palette.secondary.main
                                }}
                              />
                              <Typography variant="caption" sx={{
                                fontSize: '0.7rem',
                                color: 'text.secondary',
                                fontWeight: 500,
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                px: 0.5,
                                py: 0.2,
                                borderRadius: 0.5
                              }}>
                                {trade.session}
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end',  }}>
                    {!isTradeBeingDeleted(trade.id) && (
                      <Box sx={{ mt: 0.5, mr: 1 }}>
                        {expandedTradeId === trade.id ?
                          <CollapseIcon fontSize="small" sx={{ color: 'text.secondary' }} /> :
                          <ExpandIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        }
                      </Box>
                    )}
                  </Box>
                </TradeInfo>

                {!hideActions && (
                  <TradeActions>
                    <IconButton
                      size="small"
                      onClick={(e) => handleOpenMenu(e, trade)}
                      disabled={isTradeBeingDeleted(trade.id)}
                      aria-label="More actions"
                      aria-controls={menuTrade?.id === trade.id ? 'trade-actions-menu' : undefined}
                      aria-haspopup="true"
                    >
                      {isTradeBeingDeleted(trade.id) ? (
                        <CircularProgress size={16} />
                      ) : (
                        <MoreVertIcon fontSize="small" />
                      )}
                    </IconButton>
                    <Menu
                      id="trade-actions-menu"
                      anchorEl={menuAnchorEl}
                      open={Boolean(menuAnchorEl) && menuTrade?.id === trade.id}
                      onClose={handleCloseMenu}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      slotProps={{
                        paper: { sx: { minWidth: 160 } },
                        root: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MenuItem onClick={(e) => { e.stopPropagation(); handleEditSelected(); }}>
                        <ListItemIcon>
                          <EditIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Edit" />
                      </MenuItem>
                      <MenuItem
                        onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                        disabled={isTradeBeingDeleted(trade.id)}
                      >
                        <ListItemIcon>
                          <DeleteIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText primary="Delete" />
                      </MenuItem>
                    </Menu>
                  </TradeActions>
                )}
              </TradeListItem>
              </Box>

              {expandedTradeId === trade.id && (
                <TradeDetailExpanded
                  tradeData={trade}
                  animate={true}
                  isExpanded={true}
                  trades={trades}
                  tradeOperations={tradeOperations}
                />
              )}
            </React.Fragment>
          ))}

          {/* Load More Button */}
          {hasMoreTrades && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<LoadMoreIcon />}
                onClick={handleLoadMore}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: theme => theme.palette.mode === 'dark'
                      ? 'rgba(144, 202, 249, 0.08)'
                      : 'rgba(25, 118, 210, 0.08)',
                    color: 'primary.main'
                  }
                }}
              >
                Load More ({tradesLength - displayedCount} remaining)
              </Button>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default React.memo(TradeList);
