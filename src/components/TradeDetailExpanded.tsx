import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { alpha, useTheme, keyframes } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { Trade } from '../types/dualWrite';
import {
  ZoomIn as ZoomInIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Balance as RiskIcon,
  Schedule as SessionIcon,
  Note as NoteIcon,
  Image as ImageIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon,
  ViewList as ViewListIcon,
  Category as CategoryIcon,
  ListAlt as ListAltIcon,
  Edit as EditIcon,
  OpenInFull as ExpandIcon
} from '@mui/icons-material';
import { AnimatedDropdown } from './Animations';
import { TagsDisplay } from './common';
import { TradeImage } from './trades/TradeForm';
import RichTextEditor from './common/RichTextEditor';
import { logger } from '../utils/logger';
import ShareButton from './sharing/ShareButton';
import { TradeOperationsProps } from '../types/tradeOperations';
import { Z_INDEX } from '../styles/zIndex';
import { useTradeSyncContextOptional } from '../contexts/TradeSyncContext';
import { normalizeTradeDates } from '../utils/tradeUtils';

// Global cache to track loaded images across the entire application
const imageLoadCache = new Set<string>();

interface TradeDetailExpandedProps {
  tradeData: Trade;
  isExpanded: boolean;
  animate?: boolean;
  trades?: Array<{ id: string;[key: string]: any }>;
  tradeOperations: TradeOperationsProps;
}

// Define shimmer animation
const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Helper function to check if an image is pending
const isPendingImage = (image: TradeImage): boolean => {
  return image.pending || false;
};

// Helper function to check if an image is loading or pending
const isImageLoading = (image: TradeImage, loadingState: { [key: string]: boolean }): boolean => {
  return isPendingImage(image) || loadingState[image.id] === true;
};

const TradeDetailExpanded: React.FC<TradeDetailExpandedProps> = ({
  tradeData,
  isExpanded,
  animate,
  trades,
  tradeOperations,
}) => {
  // Destructure from tradeOperations directly. `onOpenAIChat` is
  // intentionally not destructured — per-trade AI focus is now exposed
  // only via the TradeGalleryDialog header, so this surface no longer
  // renders an "Ask Orion" button.
  const {
    onZoomImage: setZoomedImage,
    onUpdateTradeProperty,
    calendarId,
    onOpenGalleryMode,
    onEditTrade,
    isReadOnly = false,
    onSharedTradeClick
  } = tradeOperations;

  // Use global context for trade updating state
  const tradeSync = useTradeSyncContextOptional();

  const theme = useTheme();
  const [trade, setTrade] = useState<Trade>(tradeData);
  const isUpdating = tradeSync?.isTradeUpdating(trade.id) || false;
  const [isPinning, setIsPinning] = useState(false);
  const [loadingImages, setLoadingImages] = useState<{ [key: string]: boolean }>({});
  const [showTagGroups, setShowTagGroups] = useState(() => {
    // Load from localStorage, default to false if not found
    const saved = localStorage.getItem('tradeDetail_showTagGroups');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Update local trade state when tradeData prop changes
  useEffect(() => {
    setTrade(tradeData);
  }, [tradeData]);

  // Subscribe to trade sync events to update local state when trade is modified elsewhere
  useEffect(() => {
    if (!tradeSync?.lastSyncEvent) return;

    const { type, trade: syncedTrade, timestamp } = tradeSync.lastSyncEvent;

    // Only process updates for this specific trade
    if (syncedTrade.id !== trade.id) return;

    if (type === 'update') {
      setTrade(normalizeTradeDates(syncedTrade));
      logger.log(`📡 TradeDetailExpanded: Synced trade update for ${syncedTrade.id}`);
    }
  }, [tradeSync?.lastSyncEvent, trade.id]);

  // Initialize loading state for all images
  useEffect(() => {
    if (trade && Array.isArray(trade.images) && trade.images.length > 0) {
      const initialLoadingState: { [key: string]: boolean } = {};

      trade.images.forEach(image => {
        if (!isPendingImage(image)) {
          // Check if image is already in our global cache
          if (imageLoadCache.has(image.url)) {
            // Image was previously loaded, don't show loading state
            initialLoadingState[image.id] = false;
          } else {
            // Image not in cache, check if it's already loaded in browser
            const img = new Image();
            img.onload = () => {
              // Add to cache and update loading state
              imageLoadCache.add(image.url);
              setLoadingImages(prev => ({ ...prev, [image.id]: false }));
            };
            img.onerror = () => {
              // Even on error, don't show loading state anymore
              setLoadingImages(prev => ({ ...prev, [image.id]: false }));
            };

            // Set initial loading state and start loading
            initialLoadingState[image.id] = true;
            img.src = image.url;
          }
        }
      });

      setLoadingImages(initialLoadingState);
    }
  }, [trade.images]);

  // Function to toggle pin status
  const handleTogglePin = async () => {
    if (!onUpdateTradeProperty || isPinning) return;

    try {
      setIsPinning(true);
      const result = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
        ...currentTrade,
        is_pinned: !currentTrade.is_pinned
      }));
      setTrade(result!!);
    } catch (error) {
      logger.error('Error toggling pin status:', error);
    } finally {
      setIsPinning(false);
    }
  };

  // Function to toggle tag groups display and save to localStorage
  const handleToggleTagGroups = () => {
    const newValue = !showTagGroups;
    setShowTagGroups(newValue);
    localStorage.setItem('tradeDetail_showTagGroups', JSON.stringify(newValue));
  };

  if (!isExpanded) return null;

  const buildContent = () => {
    return (
      <Box sx={{
        position: 'relative',
        width: '100%'
      }}>
        {isUpdating && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              height: 3,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0
            }}
          />
        )}
        <Box sx={{
          p: { xs: 1.5, sm: 2 }, // Reduced padding on mobile
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderTopRightRadius: 0,
          borderTopLeftRadius: 0,
          borderLeft: `1px solid ${theme.palette.divider}`,
          borderRight: `1px solid ${theme.palette.divider}`,
          borderBottom: `1px solid ${theme.palette.divider}`,
          borderTop: `1px solid ${theme.palette.divider}`,

          backgroundColor: 'custom.pageBackground',
          width: '100%'
        }}>
          <Stack spacing={{ xs: 2, sm: 3 }}> {/* Reduced spacing on mobile */}
            {/* Header Section */}
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on mobile
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'flex-start' },
              width: '100%',
              gap: { xs: 1, sm: 0 } // Add gap on mobile
            }}>
              {/* Trade Name */}
              <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
                {trade.name && (
                  <Typography variant="h6" color="text.primary" sx={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', sm: '1.25rem' }, // Smaller on mobile
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    📈 {trade.name}
                  </Typography>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'flex-end', sm: 'flex-start' }
              }}>
                {/* Expand / Gallery Mode Button */}
                {onOpenGalleryMode && trades && (
                  <Tooltip
                    title="Expand"
                    slotProps={{
                      popper: { sx: { zIndex: Z_INDEX.TOOLTIP } }
                    }}
                  >
                    <IconButton
                      onClick={() => onOpenGalleryMode(
                        trades as Trade[],
                        trade.id
                      )}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          backgroundColor: alpha(
                            theme.palette.primary.main, 0.1
                          ),
                          color: 'primary.main'
                        }
                      }}
                    >
                      <ExpandIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {/* Edit Button */}
                {!isReadOnly && onEditTrade && (
                  <Tooltip
                    title="Edit Trade"
                    slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
                  >
                    <IconButton
                      onClick={() => onEditTrade(trade)}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main'
                        }
                      }}
                    >
                      <EditIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {/* Pin Button */}
                {onUpdateTradeProperty && (
                  <Tooltip
                    title={trade.is_pinned ? 'Unpin trade' : 'Pin trade'}
                    slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
                  >
                    <IconButton
                      onClick={handleTogglePin}
                      disabled={isPinning}
                      sx={{
                        color: trade.is_pinned ? 'primary.main' : 'text.secondary',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main'
                        },
                        '&:disabled': {
                          color: 'text.disabled'
                        }
                      }}
                    >
                      {isPinning ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        trade.is_pinned ? <UnpinIcon sx={{ fontSize: 20 }} /> : <PinIcon sx={{ fontSize: 20 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
                {/* Share Button - hide in read-only mode */}
                {calendarId && !isReadOnly && (
                  <ShareButton
                    type="trade"
                    item={trade}
                    calendarId={calendarId}
                    onUpdateItemProperty={onUpdateTradeProperty}
                    size="small"
                    color="inherit"
                  />
                )}
              </Box>
            </Box>

            {/* Properties Section */}
            <Box sx={{ width: '100%' }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 1.5,
                width: '100%'
              }}>
                <ListAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="subtitle2" color="text.primary" sx={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  flex: 1
                }}>
                  Properties
                </Typography>
              </Box>

              <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ width: '100%' }}>
                {/* Key Properties Grid */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: { xs: 1.5, sm: 2 }, // Reduced gap on mobile
                  width: '100%'
                }}>
                  {/* Entry/Exit Prices */}
                  {(trade.entry_price || trade.exit_price) && (
                    <Paper elevation={0} sx={{
                      p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.info.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      gridColumn: { xs: '1', sm: 'span 2' }
                    }}>
                      <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on mobile
                        justifyContent: 'space-between',
                        gap: { xs: 1, sm: 0 }, // Add gap on mobile
                        width: '100%'
                      }}>
                        {trade.entry_price && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                              Entry Price
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {trade.entry_price}
                            </Typography>
                          </Box>
                        )}
                        {trade.exit_price && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                              Exit Price
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {trade.exit_price}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  )}
                  {/* Stop Loss/Take Profit */}
                  {(trade.stop_loss || trade.take_profit) && (
                    <Paper elevation={0} sx={{
                      p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.warning.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      gridColumn: { xs: '1', sm: 'span 2' }
                    }}>
                      <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on mobile
                        justifyContent: 'space-between',
                        gap: { xs: 1, sm: 0 }, // Add gap on mobile
                        width: '100%'
                      }}>
                        {trade.stop_loss && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.main' }}>
                              Stop Loss
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {trade.stop_loss}
                            </Typography>
                          </Box>
                        )}
                        {trade.take_profit && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.main' }}>
                              Take Profit
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {trade.take_profit}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  )}
                  {/* PnL */}
                  <Paper elevation={0} sx={{
                    p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
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
                    <Box sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on mobile
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' }, // Align left on mobile
                      gap: { xs: 1, sm: 0 } // Add gap on mobile
                    }}>
                      <Typography variant="h6" sx={{
                        fontWeight: 700,
                        color: trade.amount > 0 ? 'success.main' : trade.amount < 0 ? 'error.main' : 'text.primary',
                        fontSize: '1.1rem'
                      }}>
                        {trade.amount > 0 ? '+' : ''}{trade.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>


                    </Box>
                  </Paper>

                  {/* Date */}
                  <Paper elevation={0} sx={{
                    p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
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
                        {format(typeof trade.trade_date === 'string' ? parseISO(trade.trade_date) : trade.trade_date, 'EEEE')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h6" sx={{
                        fontWeight: 700,
                        fontSize: { xs: '1rem', sm: '1.1rem' }
                      }}>
                        {format(typeof trade.trade_date === 'string' ? parseISO(trade.trade_date) : trade.trade_date, 'MMMM d, yyyy')}
                      </Typography>
                      
                    </Box>
                  </Paper>

                  {/* Risk to Reward */}
                  {trade.risk_to_reward && (
                    <Paper elevation={0} sx={{
                      p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                          {trade.risk_to_reward}
                        </Typography>
                        {trade.trade_type === 'win' && trade.risk_to_reward && (
                          <Typography variant="caption" sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            Amount Risked: ${(() => {
                              const amountRisked = Math.abs(trade.amount) / trade.risk_to_reward;
                              return amountRisked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  )}

                  {/* Session */}
                  {trade.session && (
                    <Paper elevation={0} sx={{
                      p: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
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

                {/* Images */}
                {Array.isArray(trade.images) && trade.images.length > 0 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <ImageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                        Images
                      </Typography>
                    </Box>
                    <Box sx={{
                      width: '100%'
                    }}>
                      {/* Organize images into rows based on their saved layout */}
                      {(() => {
                        // Group images by row
                        const imagesByRow: { [key: number]: TradeImage[] } = {};

                        // Organize images by row
                        trade.images.forEach(image => {
                          const row = image.row !== undefined ? image.row : 0;
                          if (!imagesByRow[row]) {
                            imagesByRow[row] = [];
                          }
                          imagesByRow[row].push(image);
                        });

                        const sortedRows = Object.entries(imagesByRow)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([_, images]) => images);

                        return sortedRows.map((rowImages, rowIndex) => (
                          <Box
                            key={`row-${rowIndex}`}
                            sx={{
                              display: 'flex',
                              flexDirection: { xs: rowImages.length > 1 ? 'column' : 'row', sm: 'row' }, // Stack images vertically on mobile if multiple
                              width: '100%',
                              mb: 2,
                              gap: 1 // Add small gap between columns
                            }}
                          >
                            {/* Sort images in the row by column */}
                            {rowImages
                              .sort((a, b) => (a.column || 0) - (b.column || 0))
                              .map((image, colIndex) => (
                                <Box
                                  key={`image-${image.id}-${rowIndex}-${colIndex}`}
                                  sx={{
                                    width: {
                                      xs: rowImages.length > 1 ? '100%' : `${image.column_width || 100}%`, // Full width on mobile if multiple images
                                      sm: `${image.column_width || 100}%`
                                    },
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    position: 'relative'
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
                                        maxHeight: rowImages.length > 1 ? '300px' : 'none',
                                        overflow: 'hidden',
                                        width: '100%',
                                        height: 'auto'
                                      } : {})
                                    }}
                                  >
                                    {/* Loading placeholder */}
                                    {image.width && image.height && isImageLoading(image, loadingImages) && (
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

                                      </Box>
                                    )}

                                    {/* Image container */}
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        zIndex: 2,
                                        cursor: isImageLoading(image, loadingImages) ? 'default' : 'pointer',
                                        ...(isImageLoading(image, loadingImages) && {
                                          background: (theme) => {
                                            const baseColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                                            const shimmerColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                                            return `linear-gradient(90deg, ${baseColor} 25%, ${shimmerColor} 50%, ${baseColor} 75%)`;
                                          },
                                          backgroundSize: '200% 100%',
                                          animation: `${shimmer} 1.5s infinite linear`,
                                          willChange: 'background-position',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        })
                                      }}
                                    >
                                      {isPendingImage(image) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                          <CircularProgress size={24} color="primary" />
                                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                            Uploading...
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <img
                                          src={image.url}
                                          alt={image.caption || `Trade Image`}
                                          style={{
                                            width: '100%',
                                            maxHeight: rowImages.length > 1 ? '300px' : 'none',
                                            objectFit: 'contain',
                                            position: image.width && image.height ? 'absolute' : 'relative',
                                            top: 0,
                                            left: 0,
                                            height: image.width && image.height ? '100%' : 'auto',
                                            opacity: loadingImages[image.id] ? 0 : 1,
                                            transition: 'opacity 0.3s ease-in-out'
                                          }}
                                          onLoad={() => {
                                            // Mark this image as loaded
                                            setLoadingImages(prev => ({
                                              ...prev,
                                              [image.id]: false
                                            }));
                                          }}
                                        />
                                      )}
                                    </Box>

                                    {/* Zoom overlay */}
                                    {!isImageLoading(image, loadingImages) && (
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
                                        onClick={() => {
                                          // Get all non-pending image URLs
                                          const allImageUrls = (Array.isArray(trade.images) ? trade.images : [])
                                            .filter(img => !isPendingImage(img))
                                            .map(img => img.url);

                                          // Find the index of the current image
                                          const currentIndex = allImageUrls.findIndex(url => url === image.url);

                                          // Pass all images and the current index to the zoom dialog
                                          setZoomedImage?.(image.url, allImageUrls, currentIndex);
                                        }}
                                      >
                                        <ZoomInIcon sx={{ color: 'white', fontSize: 32 }} />
                                      </Box>
                                    )}
                                  </Box>
                                  {image.caption && (
                                    <Box sx={{
                                      p: 1,
                                      borderTop: `1px solid ${theme.palette.divider}`,
                                      backgroundColor: theme.palette.background.paper,
                                      maxHeight: 'none', // Ensure no max height constraint
                                      overflow: 'visible' // Prevent scrollbars
                                    }}>
                                      <Typography variant="caption" sx={{
                                        color: 'text.secondary',
                                        display: 'block',
                                        whiteSpace: 'pre-line',
                                        fontSize: '0.7rem', // Even smaller font size for captions in view mode
                                        lineHeight: 1.3, // Tighter line height for better readability
                                        overflow: 'visible' // Prevent scrollbars
                                      }}>
                                        {image.caption}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              ))
                            }
                          </Box>
                        ));
                      })()
                      }
                    </Box>
                  </Box>
                )}
                {/* Notes */}
                {trade.notes && (() => { try { return JSON.parse(trade.notes || '').blocks?.find((data: any) => data.text !== ""); } catch { return false; } })() && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <NoteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                        Notes
                      </Typography>
                    </Box>
                    <Box sx={{
                      borderRadius: 1,
                      backgroundColor: theme.palette.background.paper,
                      overflow: 'visible',
                      p: 1
                    }}>
                      <RichTextEditor
                        value={trade.notes}
                        disabled={true}
                        hideCharacterCount={true}
                        minHeight={50}
                        maxHeight={400}
                        calendarId={calendarId}
                        trades={trades}
                        onOpenGalleryMode={onOpenGalleryMode}
                        onSharedTradeClick={onSharedTradeClick}
                      />
                    </Box>
                  </Box>
                )}

                {/* Tags Section */}
                <Box>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    flexWrap: { xs: 'wrap', sm: 'nowrap' }, // Allow wrapping on mobile
                    gap: { xs: 1, sm: 0 }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CategoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="subtitle2" color="text.primary" sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.85rem', sm: '0.9rem' }, // Smaller on mobile
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        Tags
                      </Typography>
                    </Box>
                    <Tooltip
                      title={showTagGroups ? "Show flat tag list" : "Group tags by category"}
                      slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
                    >
                      <IconButton
                        size="small"
                        onClick={handleToggleTagGroups}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main'
                          }
                        }}
                      >
                        {showTagGroups ? <ViewListIcon sx={{ fontSize: 18 }} /> : <CategoryIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box sx={{ pl: { xs: 0, sm: 1 } }}> {/* Remove left padding on mobile */}
                    <TagsDisplay
                      tags={trade.tags || []}
                      showGroups={showTagGroups}
                      chipSize="medium"
                    />
                  </Box>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  const content = animate ? (
    <AnimatedDropdown>
      {buildContent()}
    </AnimatedDropdown>
  ) : buildContent();

  return content;
};

export default TradeDetailExpanded;

