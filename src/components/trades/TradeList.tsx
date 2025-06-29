import React, { useState } from 'react';
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
  Button
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
  DeleteSweep as DeleteMultipleIcon
} from '@mui/icons-material';
import { Trade } from '../../types/trade';
import { TradeListItem, TradeInfo, TradeActions } from '../StyledComponents';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../../utils/tagColors';
import { useTheme } from '@mui/material/styles';
import TradeDetailExpanded from '../TradeDetailExpanded';

interface TradeListProps {
  trades: Trade[];
  expandedTradeId: string | null;
  onTradeClick: (tradeId: string) => void;
  onEditClick: (trade: Trade) => void;
  onDeleteClick: (tradeId: string) => void;
  onDeleteMultiple?: (tradeIds: string[]) => void; // New prop for bulk deletion
  onZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  hideActions?: boolean; // New prop to hide edit/delete buttons
  enableBulkSelection?: boolean; // New prop to enable bulk selection
  sx?: SxProps<Theme>; // Allow styling from parent component
  deletingTradeIds?: string[]; // IDs of trades currently being deleted
  calendarId?: string; // Calendar ID for sharing functionality
  // Optional props for trade link navigation in notes
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering
  calendar?: {
    economicCalendarFilters?: {
      currencies: string[];
      impacts: string[];
      viewType: 'day' | 'week' | 'month';
    };
  };
}

const TradeList: React.FC<TradeListProps> = ({
  trades,
  expandedTradeId,
  onTradeClick,
  onEditClick,
  onDeleteClick,
  onDeleteMultiple,
  onZoomedImage,
  onUpdateTradeProperty,
  hideActions = false, // Default to showing actions
  enableBulkSelection = false, // Default to disabled
  sx,
  deletingTradeIds = [],
  calendarId,
  onOpenGalleryMode,
  calendar
}) => {
  const theme = useTheme();
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);

  // Helper function to check if a trade is being deleted
  const isTradeBeingDeleted = (tradeId: string) => deletingTradeIds.includes(tradeId);

  // Helper function to check if a trade is selected
  const isTradeSelected = (tradeId: string) => selectedTradeIds.includes(tradeId);

  // Handle individual trade selection
  const handleTradeSelection = (tradeId: string, selected: boolean) => {
    if (selected) {
      setSelectedTradeIds(prev => [...prev, tradeId]);
    } else {
      setSelectedTradeIds(prev => prev.filter(id => id !== tradeId));
    }
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedTradeIds.length === trades.length) {
      setSelectedTradeIds([]);
    } else {
      setSelectedTradeIds(trades.map(trade => trade.id));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (onDeleteMultiple && selectedTradeIds.length > 0) {
      onDeleteMultiple(selectedTradeIds);
      setSelectedTradeIds([]);
    }
  };

  return (
    <Box sx={{ mt: 2, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 1 }}>
            Trades
          </Typography>
          {trades.length > 0 && (
            <Chip
              label={trades.length}
              size="small"
              color="primary"
              sx={{
                height: 20,
                minWidth: 40,
                '& .MuiChip-label': { px: 1, fontSize: '0.75rem', color: 'primary.main' },
                background: 'none',
                border: '2px dotted',
                borderColor: 'primary.main'
              }}
            />
          )}
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

        {enableBulkSelection && trades.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<SelectAllIcon />}
              onClick={handleSelectAll}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              {selectedTradeIds.length === trades.length ? 'None' : 'All'}
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

      {trades.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No trades for this day
        </Typography>
      ) : (
        <Stack spacing={1}>
          {trades.map((trade) => (
            <React.Fragment key={trade.id}>
              <TradeListItem
                $type={trade.type}
                onClick={isTradeBeingDeleted(trade.id) ? undefined : () => onTradeClick(trade.id)}
                sx={{
                  cursor: isTradeBeingDeleted(trade.id) ? 'default' : 'pointer',
                  ...(trade.isTemporary && {
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
                            {trade.isTemporary ? trade.name : `📈 ${trade.name.replace(/^📈 /, '')}`}
                          </Typography>

                        </Box>
                      )}
                      <Typography variant="body1" sx={{
                        fontWeight: 500,
                        color: trade.type === 'win'
                          ? 'success.main'
                          : trade.type === 'loss'
                            ? 'error.main'
                            : 'info.main'
                      }}>
                        ${Math.abs(trade.amount).toLocaleString()}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
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

                        {trade.riskToReward && (
                          <Tooltip title={`Risk to Reward: ${trade.riskToReward}`}>
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
                                {trade.riskToReward}R
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

                  {trade.tags && trade.tags.length > 0 && (() => {
                    // Filter out Partials tags
                    const filteredTags = trade.tags.filter(tag => !tag.startsWith('Partials:'));

                    // Group tags by their group name
                    const tagGroups: Record<string, string[]> = {};
                    const ungroupedTags: string[] = [];

                    filteredTags.forEach(tag => {
                      if (isGroupedTag(tag)) {
                        const group = getTagGroup(tag);
                        if (!tagGroups[group]) {
                          tagGroups[group] = [];
                        }
                        tagGroups[group].push(tag);
                      } else {
                        ungroupedTags.push(tag);
                      }
                    });

                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {/* Display one chip per group with tooltip */}
                        {Object.entries(tagGroups).map(([group, groupTags]) => (
                          <Tooltip
                            key={group}
                            title={
                              <Box sx={{ p: 0.5 }}>
                                {groupTags.map(tag => (
                                  <Typography key={tag} variant="body2">
                                    {formatTagForDisplay(tag,true)}
                                  </Typography>
                                ))}
                              </Box>
                            }
                            arrow
                          >
                            <Chip
                              label={`${group} ${groupTags.length > 1? groupTags.length : ""}`}
                              size="small"
                              sx={{
                                ...getTagChipStyles(groupTags[0], theme),
                                height: '20px',
                                fontWeight: 600,
                                '& .MuiChip-label': {
                                  px: 1,
                                  fontSize: '0.7rem'
                                }
                              }}
                            />
                          </Tooltip>
                        ))}

                        {/* Display ungrouped tags normally */}
                        {ungroupedTags.map((tag, tagIndex) => (
                          <Chip
                            key={tagIndex}
                            label={formatTagForDisplay(tag)}
                            size="small"
                            sx={{
                              ...getTagChipStyles(tag, theme),
                              height: '20px',
                              '& .MuiChip-label': {
                                px: 1,
                                fontSize: '0.7rem'
                              }
                            }}
                          />
                        ))}
                      </Box>
                    );
                  })()}
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
                    {!isTradeBeingDeleted(trade.id) && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClick(trade);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(trade.id);
                      }}
                      disabled={isTradeBeingDeleted(trade.id)}
                      sx={{
                        position: 'relative',
                        ...(isTradeBeingDeleted(trade.id) && {
                          '&.Mui-disabled': {
                            color: 'error.main',
                            opacity: 0.7
                          }
                        })
                      }}
                    >
                      {isTradeBeingDeleted(trade.id) ? (
                        <CircularProgress
                          size={16}
                          color="error" 
                        />
                      ) : (
                        <DeleteIcon fontSize="small" />
                      )}
                    </IconButton>
                  </TradeActions>
                )}
              </TradeListItem>

              {expandedTradeId === trade.id && (
                <TradeDetailExpanded
                  tradeData={trade}
                  isExpanded={true}
                  setZoomedImage={onZoomedImage}
                  onUpdateTradeProperty={onUpdateTradeProperty}
                  calendarId={calendarId}
                  trades={trades}
                  onOpenGalleryMode={onOpenGalleryMode}
                  calendar={calendar}
                />
              )}
            </React.Fragment>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default TradeList;
