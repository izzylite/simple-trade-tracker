import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, Image as ImageIcon, Note as NoteIcon } from '@mui/icons-material';
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
  onZoomedImage: (url: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
}

const TradeList: React.FC<TradeListProps> = ({
  trades,
  expandedTradeId,
  onTradeClick,
  onEditClick,
  onDeleteClick,
  onZoomedImage,
  onUpdateTradeProperty
}) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
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
                onClick={() => onTradeClick(trade.id)}
                sx={{
                  cursor: 'pointer',
                  ...(trade.isTemporary && {
                    opacity: 0.7,
                    border: '1px dashed',
                    borderColor: 'divider',
                    backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                  })
                }}
              >
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
                      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                        {trade.images && trade.images.length > 0 && (
                          <Tooltip title={`${trade.images.length} image${trade.images.length > 1 ? 's' : ''}`}>
                            <ImageIcon
                              fontSize="small"
                              sx={{
                                opacity: 0.8,
                                fontSize: '1rem',
                                verticalAlign: 'middle'
                              }}
                            />
                          </Tooltip>
                        )}

                        {trade.notes && (
                          <Tooltip title={trade.notes}>
                            <NoteIcon
                              fontSize="small"
                              sx={{
                                opacity: 0.8,
                                fontSize: '1rem',
                                verticalAlign: 'middle'
                              }}
                            />
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
                              label={group}
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
                    <Box sx={{ mt: 0.5, mr: 1 }}>
                      {expandedTradeId === trade.id ?
                        <CollapseIcon fontSize="small" sx={{ color: 'text.secondary' }} /> :
                        <ExpandIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      }
                    </Box>
                  </Box>
                </TradeInfo>

                <TradeActions>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditClick(trade);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(trade.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TradeActions>
              </TradeListItem>

              {expandedTradeId === trade.id && (
                <TradeDetailExpanded
                  trade={trade}
                  isExpanded={true}
                  setZoomedImage={onZoomedImage}
                  onUpdateTradeProperty={onUpdateTradeProperty}
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
