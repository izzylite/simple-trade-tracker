import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Paper,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import { alpha, useTheme, keyframes } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from '../types/trade';
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
  Category as CategoryIcon
} from '@mui/icons-material';
import { AnimatedDropdown } from './Animations';
import { TagsDisplay } from './common';
import { TradeImage } from './trades/TradeForm';
import ShareTradeButton from './sharing/ShareTradeButton';
import RichTextEditor from './common/RichTextEditor';

// Global cache to track loaded images across the entire application
const imageLoadCache = new Set<string>();

interface TradeDetailExpandedProps {
  tradeData: Trade;
  isExpanded: boolean;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  calendarId?: string;
  // Optional props for trade link navigation in notes
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
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
  setZoomedImage,
  onUpdateTradeProperty,
  calendarId,
  trades,
  onOpenGalleryMode
}) => {
  const theme = useTheme();
  const [trade, setTrade] = useState<Trade>(tradeData);
  const [isToggling, setIsToggling] = useState(false);
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

  // Initialize loading state for all images
  useEffect(() => {
    if (trade.images && trade.images.length > 0) {
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

  // No need to organize tags here as TagsDisplay will handle it

  // Function to toggle trade type between 'win' and 'loss'
  const handleToggleTradeType = async () => {
    if (!onUpdateTradeProperty || isToggling) return;

    try {
      setIsToggling(true);
      const result = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
        ...currentTrade,
        type: currentTrade.type === 'win' ? 'loss' : 'win',
        // Flip the amount sign
        amount: currentTrade.type === 'win' ? -Math.abs(currentTrade.amount) : Math.abs(currentTrade.amount)
      }));
      setTrade(result!!);
    } catch (error) {
      console.error('Error toggling trade type:', error);
    } finally {
      setIsToggling(false);
    }
  };

  // Function to toggle pin status
  const handleTogglePin = async () => {
    if (!onUpdateTradeProperty || isPinning) return;

    try {
      setIsPinning(true);
      const result = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
        ...currentTrade,
        isPinned: !currentTrade.isPinned
      }));
      setTrade(result!!);
    } catch (error) {
      console.error('Error toggling pin status:', error);
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

  return (
    <AnimatedDropdown>
      <Box sx={{
        p: 2,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        borderTopRightRadius: 0,
        borderTopLeftRadius: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
        borderRight: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderTop: `1px solid ${theme.palette.divider}`,

        backgroundColor: 'custom.pageBackground',
        mb: 1,
        width: '100%'
      }}>
        <Stack spacing={3}>
          {/* Header Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            {/* Trade Name */}
            <Box sx={{ flex: 1 }}>
              {trade.name && (
                <Typography variant="h6" color="text.primary" sx={{ display: 'block', fontWeight: 700 }}>
                  📈 {trade.name}
                </Typography>
              )}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Share Button */}
              {calendarId && (
                <ShareTradeButton
                  trade={trade}
                  calendarId={calendarId}
                  onTradeUpdated={(updatedTrade) => setTrade(updatedTrade)}
                  onUpdateTradeProperty={onUpdateTradeProperty}
                  size="small"
                  color="inherit"
                />
              )}

              {/* Pin Button */}
              {onUpdateTradeProperty && (
                <IconButton
                  onClick={handleTogglePin}
                  disabled={isPinning}
                  sx={{
                    color: trade.isPinned ? 'primary.main' : 'text.secondary',
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
                    trade.isPinned ? <UnpinIcon sx={{ fontSize: 20 }} /> : <PinIcon sx={{ fontSize: 20 }} />
                  )}
                </IconButton>
              )}
            </Box>
          </Box>

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
                {/* Entry/Exit Prices */}
                {(trade.entry || trade.exit) && (
                  <Paper elevation={0} sx={{
                    p: 1.5,
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
                      {trade.entry && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                            Entry Price
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {trade.entry}
                          </Typography>
                        </Box>
                      )}
                      {trade.exit && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
                            Exit Price
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {trade.exit}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                )}
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
                      {trade.amount > 0 ? '+' : ''}{trade.amount.toFixed(2)}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {/* Toggle Button */}
                      {onUpdateTradeProperty && (
                        <Button
                          size="small"
                          variant="outlined"
                          color={trade.type === 'win' ? 'success' : 'error'}
                          onClick={handleToggleTradeType}
                          disabled={isToggling}
                          sx={{
                            minWidth: '80px',
                            fontSize: '0.7rem',
                            position: 'relative'
                          }}
                        >
                          {isToggling ? (
                            <>
                              <CircularProgress
                                size={16}
                                color="inherit"
                                sx={{
                                  position: 'absolute',
                                  left: '8px'
                                }}
                              />
                              Processing...
                            </>
                          ) : (
                            <>Toggle {trade.type === 'win' ? 'Win' : 'Loss'}</>
                          )}
                        </Button>
                      )}
                    </Box>
                  </Box>
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                        {trade.riskToReward}
                      </Typography>
                      {trade.type === 'win' && trade.riskToReward && (
                        <Typography variant="caption" sx={{
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          Amount Risked: ${(() => {
                            const amountRisked = Math.abs(trade.amount) / trade.riskToReward;
                            return amountRisked.toFixed(2);
                          })()}
                        </Typography>
                      )}
                    </Box>
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
                                    xs: rowImages.length > 1 ? '100%' : `${image.columnWidth || 100}%`, // Full width on mobile if multiple images
                                    sm: `${image.columnWidth || 100}%`
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
                                        const allImageUrls = trade.images
                                          ?.filter(img => !isPendingImage(img))
                                          .map(img => img.url) || [];

                                        // Find the index of the current image
                                        const currentIndex = allImageUrls.findIndex(url => url === image.url);

                                        // Pass all images and the current index to the zoom dialog
                                        setZoomedImage(image.url, allImageUrls, currentIndex);
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
                                    backgroundColor: alpha(theme.palette.background.paper, 0.7),
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
              {trade.notes && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <NoteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                      Notes
                    </Typography>
                  </Box>
                  <Box sx={{
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.background.paper, 0.7),
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
                    />
                  </Box>
                </Box>
              )}

              {/* Tags Section */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    Tags
                  </Typography>
                  <Tooltip title={showTagGroups ? "Show flat tag list" : "Group tags by category"}>
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

                <Box sx={{ pl: 1 }}>
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
    </AnimatedDropdown>
  );
};

export default TradeDetailExpanded;
