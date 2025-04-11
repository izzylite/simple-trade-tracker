import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from '../types/trade';
import { getTagChipStyles, isGroupedTag, getTagName, getUniqueTagGroups, filterTagsByGroup } from '../utils/tagColors';
import {
  ZoomIn as ZoomInIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Balance as RiskIcon,
  Schedule as SessionIcon,
  Label as TagIcon,
  Note as NoteIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { AnimatedDropdown } from './Animations';

interface TradeDetailExpandedProps {
  trade: Trade;
  isExpanded: boolean;
  setZoomedImage: (url: string) => void;
}

const TradeDetailExpanded: React.FC<TradeDetailExpandedProps> = ({
  trade,
  isExpanded,
  setZoomedImage
}) => {
  const theme = useTheme();

  // Organize tags by category
  const organizedTags = useMemo(() => {
    if (!trade.tags || trade.tags.length === 0) return { groups: {}, ungroupedTags: [] };

    const groups: Record<string, string[]> = {};
    const ungroupedTags: string[] = [];

    // Get all unique groups
    const uniqueGroups = getUniqueTagGroups(trade.tags);

    // Initialize groups
    uniqueGroups.forEach(group => {
      groups[group] = filterTagsByGroup(trade.tags || [], group);
    });

    // Get ungrouped tags
    trade.tags.forEach(tag => {
      if (!isGroupedTag(tag)) {
        ungroupedTags.push(tag);
      }
    });

    return { groups, ungroupedTags };
  }, [trade.tags]);

  if (!isExpanded) return null;

  return (
    <AnimatedDropdown>
      <Box sx={{
        p: 2,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        boarderTopRightRadius: 0,
        boarderTopLeftRadius: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
        borderRight: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderTop: `1px solid ${theme.palette.divider}`,
        
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        mb: 1,
        width: '100%'
      }}>
        <Stack spacing={3}>
          {/* Properties Section */}
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1.5, display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>
              Properties
            </Typography>

            <Stack spacing={2} sx={{ width: '100%' }}>
              {/* Key Properties Grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
                width: '100%'
              }}>
                {/* PnL */}
                <Paper elevation={0} sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: alpha(
                    trade.amount > 0 ? theme.palette.success.main :
                    trade.amount < 0 ? theme.palette.error.main :
                    theme.palette.grey[500],
                    0.1
                  ),
                  border: `1px solid ${alpha(
                    trade.amount > 0 ? theme.palette.success.main :
                    trade.amount < 0 ? theme.palette.error.main :
                    theme.palette.grey[500],
                    0.2
                  )}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MoneyIcon sx={{
                      fontSize: 18,
                      color: trade.amount > 0 ? 'success.main' : trade.amount < 0 ? 'error.main' : 'text.secondary'
                    }} />
                    <Typography variant="caption" sx={{
                      fontWeight: 600,
                      color: trade.amount > 0 ? 'success.main' : trade.amount < 0 ? 'error.main' : 'text.secondary'
                    }}>
                      PnL
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    color: trade.amount > 0 ? 'success.main' : trade.amount < 0 ? 'error.main' : 'text.primary',
                    fontSize: '1.1rem'
                  }}>
                    {trade.amount > 0 ? '+' : ''}{trade.amount.toFixed(2)}
                  </Typography>
                </Paper>

                {/* Date */}
                <Paper elevation={0} sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      Date
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {format(trade.date, 'MMMM d, yyyy')}
                  </Typography>
                </Paper>

                {/* Risk to Reward */}
                {trade.riskToReward && (
                  <Paper elevation={0} sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.warning.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <RiskIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.main' }}>
                        Risk to Reward
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {trade.riskToReward}
                    </Typography>
                  </Paper>
                )}

                {/* Session */}
                {trade.session && (
                  <Paper elevation={0} sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SessionIcon sx={{ fontSize: 18, color: 'info.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                        Session
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {trade.session}
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Tags Section Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <TagIcon sx={{ fontSize: 18, color: 'text.primary' }} />
                <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  Tags
                </Typography>
              </Box>

              {/* Tag Groups as Properties */}
              <Box sx={{ pl: 1 }}>
                {Object.entries(organizedTags.groups).map(([groupName, groupTags]) => (
                  <Box key={groupName} sx={{ mb: 1.5 }}>
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{
                        fontWeight: 600,
                        mb: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.85rem'
                      }}
                    >
                      {groupName}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {groupTags.map(tag => (
                        <Chip
                          key={tag}
                          label={getTagName(tag)}
                          size="medium"
                          sx={{
                            ...getTagChipStyles(tag, theme),
                            height: '28px', 
                            '& .MuiChip-label': {
                              px: 1.25,
                              fontSize: '0.85rem'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}

                {/* Ungrouped Tags */}
                {organizedTags.ungroupedTags.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{
                        fontWeight: 600,
                        mb: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.85rem'
                      }}
                    >
                      General
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {organizedTags.ungroupedTags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="medium"
                          sx={{
                            ...getTagChipStyles(tag, theme),
                            height: '28px', 
                            '& .MuiChip-label': {
                              px: 1.25,
                              fontSize: '0.85rem'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>

          {/* Notes */}
          {trade.notes && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <NoteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Notes
                </Typography>
              </Box>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.background.paper, 0.7),
                border: `1px solid ${theme.palette.divider}`
              }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {trade.notes}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Images */}
          {trade.images && trade.images.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <ImageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Images
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}>
                {trade.images.map((image, index) => (
                  <Box
                    key={index}
                    sx={{
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        '&:hover .overlay': {
                          opacity: 1
                        },
                        ...(image.width && image.height ? {
                          paddingTop: `${(image.height / image.width) * 100}%`,
                          maxHeight: '300px',
                          overflow: 'hidden'
                        } : {})
                      }}
                    >
                      {image.width && image.height && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: theme => alpha(theme.palette.divider, 0.2),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1
                          }}
                        >
                          <CircularProgress size={24} color="inherit" sx={{ opacity: 0.5 }} />
                        </Box>
                      )}
                      <Box
                        onClick={() => setZoomedImage(image.url)}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          zIndex: 2,
                          cursor: 'pointer'
                        }}
                      >
                        <img
                          src={image.url}
                          alt={image.caption || `Trade ${index + 1}`}
                          style={{
                            width: '100%',
                            maxHeight: image.width && image.height ? 'none' : '300px',
                            objectFit: 'contain',
                            position: image.width && image.height ? 'absolute' : 'relative',
                            top: 0,
                            left: 0,
                            height: image.width && image.height ? '100%' : 'auto',
                          }}
                          onLoad={(e) => {
                            // Hide the placeholder when image is loaded
                            const target = e.target as HTMLImageElement;
                            const parent = target.parentElement?.parentElement;
                            if (parent && parent.children.length > 1) {
                              const placeholder = parent.children[0] as HTMLElement;
                              if (placeholder) {
                                placeholder.style.display = 'none';
                              }
                            }
                          }}
                        />
                      </Box>
                      <Box
                        className="overlay"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s ease-in-out',
                          cursor: 'pointer',
                          zIndex: 3
                        }}
                        onClick={() => setZoomedImage(image.url)}
                      >
                        <ZoomInIcon sx={{ color: 'white', fontSize: 32 }} />
                      </Box>
                    </Box>
                    {image.caption && (
                      <Box sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {image.caption}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </AnimatedDropdown>
  );
};

export default TradeDetailExpanded;
