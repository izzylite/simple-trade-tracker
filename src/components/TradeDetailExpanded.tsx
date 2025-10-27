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
  Tooltip,
  List,
  Collapse,
  Chip,
  FormControl,
  Select,
  MenuItem,
  OutlinedInput,
  Autocomplete,
  Checkbox,
  TextField
} from '@mui/material';
import { alpha, useTheme, keyframes } from '@mui/material/styles';
import { format } from 'date-fns';
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
  TrendingUp as EconomicIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import { AnimatedDropdown } from './Animations';
import { TagsDisplay } from './common';
import { TradeImage } from './trades/TradeForm';
import RichTextEditor from './common/RichTextEditor';
import EconomicEventListItem from './economicCalendar/EconomicEventListItem';
import { economicCalendarService } from '../services/economicCalendarService';
import { EconomicEvent, ImpactLevel, Currency } from '../types/economicCalendar';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from './economicCalendar/EconomicCalendarDrawer';
import { logger } from '../utils/logger';
import { tradeEconomicEventService } from '../services/tradeEconomicEventService';
import ShareButton from './sharing/ShareButton';

// Global cache to track loaded images across the entire application
const imageLoadCache = new Set<string>();

interface TradeDetailExpandedProps {
  tradeData: Trade;
  isExpanded: boolean;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  calendarId?: string;
  // Optional props for trade link navigation in notes
  trades?: Array<{ id: string;[key: string]: any }>;
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

// Helper function to get impact colors
const getImpactColor = (impact: string, theme: any) => {
  switch (impact) {
    case 'High':
      return theme.palette.error.main;
    case 'Medium':
      return theme.palette.warning.main;
    case 'Low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

const TradeDetailExpanded: React.FC<TradeDetailExpandedProps> = ({
  tradeData,
  isExpanded,
  setZoomedImage,
  onUpdateTradeProperty,
  calendarId,
  trades,
  onOpenGalleryMode,
  calendar
}) => {
  const theme = useTheme();
  const [trade, setTrade] = useState<Trade>(tradeData);
  const [isPinning, setIsPinning] = useState(false);
  const [loadingImages, setLoadingImages] = useState<{ [key: string]: boolean }>({});
  const [showTagGroups, setShowTagGroups] = useState(() => {
    // Load from localStorage, default to false if not found
    const saved = localStorage.getItem('tradeDetail_showTagGroups');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Economic events state
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [loadingEconomicEvents, setLoadingEconomicEvents] = useState(false);
  const [showEconomicEvents, setShowEconomicEvents] = useState(false);
  const [economicEventsError, setEconomicEventsError] = useState<string | null>(null);
  const [allEconomicEvents, setAllEconomicEvents] = useState<EconomicEvent[]>([]);
  const [eventNameSearch, setEventNameSearch] = useState('');

  // Add state
  const [selectedImpacts, setSelectedImpacts] = useState<ImpactLevel[]>(['High']
  );

  // Update local trade state when tradeData prop changes
  useEffect(() => {
    setTrade(tradeData);
  }, [tradeData]);

  // Initialize loading state for all images
  useEffect(() => {
    if (trade && trade.images && trade.images.length > 0) {
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

  // Filter events by event name search
  useEffect(() => {
    if (!eventNameSearch) {
      setEconomicEvents(allEconomicEvents);
    } else {
      const searchLower = eventNameSearch.toLowerCase();
      setEconomicEvents(
        allEconomicEvents.filter(event =>
          event.event.toLowerCase().includes(searchLower)
        )
      );
    }
  }, [eventNameSearch, allEconomicEvents]);

  // Function to toggle pin status
  const handleTogglePin = async () => {
    if (!onUpdateTradeProperty || isPinning) return;

    try {
      setIsPinning(true);
      const result = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
        ...currentTrade,
        isPinned: !currentTrade.is_pinned
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

  // Function to fetch economic events for the trade's date
  const fetchEconomicEvents = async () => {
    if (!trade.trade_date) return;

    try {
      setLoadingEconomicEvents(true);
      setEconomicEventsError(null);


      const sessionRange = tradeEconomicEventService.getSessionTimeRange(trade.session!, trade.trade_date);
      const filterSetting = calendar?.economicCalendarFilters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS
      const events = await economicCalendarService.fetchEvents(
        { start: sessionRange.start, end: sessionRange.end },
        {
          currencies: (filterSetting?.currencies as Currency[]),
          impacts: (filterSetting?.impacts as ImpactLevel[])
        }
      );

      // Sort events by time
      const sortedEvents = events.sort((a, b) =>
        new Date(a.timeUtc).getTime() - new Date(b.timeUtc).getTime()
      );

      setAllEconomicEvents(sortedEvents);
      setEconomicEvents(sortedEvents);
    } catch (error) {
      logger.error('Error fetching economic events:', error);
      setEconomicEventsError('Failed to load economic events');
    } finally {
      setLoadingEconomicEvents(false);
    }
  };

  // Function to toggle economic events section
  const handleToggleEconomicEvents = () => {
    const newValue = !showEconomicEvents;
    setShowEconomicEvents(newValue);

    // Fetch events when expanding for the first time
    if (newValue && economicEvents.length === 0 && !loadingEconomicEvents) {
      fetchEconomicEvents();
    }
  };

  // Re-fetch economic events when trade changes (for gallery mode)
  useEffect(() => {
    // Clear existing events when trade changes
    setEconomicEvents([]);
    setAllEconomicEvents([]);
    setEconomicEventsError(null);

    // Re-fetch events if section is expanded
    if (showEconomicEvents) {
      fetchEconomicEvents();
    }
  }, [trade.id, trade.trade_date, trade.session]);

  useEffect(() => {
    if (!showEconomicEvents) return;

    const unsubscribe = economicCalendarService.subscribeToUpdates((updatedEvents) => {
      setAllEconomicEvents((prevEvents) => {
        // Create a map of previous events by id
        const prevMap = new Map(prevEvents.map(e => [e.id, e]));
        // Update or add each event from the update
        updatedEvents.forEach(event => {
          prevMap.set(event.id, { ...prevMap.get(event.id), ...event });
        });
        // Return the merged array, sorted by time
        return Array.from(prevMap.values()).sort((a, b) => new Date(a.timeUtc).getTime() - new Date(b.timeUtc).getTime());
      });
    });

    return () => unsubscribe();
  }, [showEconomicEvents]);

  // Update filtering logic
  useEffect(() => {
    setEconomicEvents(
      allEconomicEvents.filter(event =>
        selectedImpacts.includes(event.impact) &&
        event.event.toLowerCase().includes(eventNameSearch.toLowerCase())
      )
    );
  }, [eventNameSearch, allEconomicEvents, selectedImpacts]);

  if (!isExpanded) return null;

  return (
    <AnimatedDropdown>
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
        mb: 1,
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
                  fontSize: { xs: '1.1rem', sm: '1.25rem' } // Smaller on mobile
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
              {/* Pin Button */}
              {onUpdateTradeProperty && (
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
              )}
              {/* Share Button */}
              {calendarId && (
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <ListAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
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
                      {trade.amount > 0 ? '+' : ''}{trade.amount.toFixed(2)}
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
                      Date
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1rem', sm: '1.1rem' } // Smaller on mobile
                  }}>
                    {format(trade.trade_date, 'MMMM d, yyyy')}
                  </Typography>
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
              <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
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
                      fontSize: { xs: '0.85rem', sm: '0.9rem' } // Smaller on mobile
                    }}>
                      Tags
                    </Typography>
                  </Box>
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

                <Box sx={{ pl: { xs: 0, sm: 1 } }}> {/* Remove left padding on mobile */}
                  <TagsDisplay
                    tags={trade.tags || []}
                    showGroups={showTagGroups}
                    chipSize="medium"
                  />
                </Box>
              </Box>

              {/* Economic Events Section */}
              <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' }, // Allow wrapping on mobile
                  gap: { xs: 1, sm: 0 }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                    <EconomicIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="subtitle2" color="text.primary" sx={{
                      fontWeight: 600,
                      fontSize: { xs: '0.8rem', sm: '0.9rem' }, // Smaller on mobile
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: { xs: 'nowrap', sm: 'normal' } // Prevent wrapping on mobile
                    }}>
                      Economic Events ({format(trade.trade_date, 'MMM d, yyyy')})
                    </Typography>
                  </Box>
                  <Tooltip title={showEconomicEvents ? "Hide economic events" : "Show economic events"}>
                    <IconButton
                      size="small"
                      onClick={handleToggleEconomicEvents}
                      sx={{
                        color: 'text.secondary',
                        flexShrink: 0, // Prevent button from shrinking
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main'
                        }
                      }}
                    >
                      {showEconomicEvents ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>

                <Collapse in={showEconomicEvents}>
                  <Box sx={{
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.background.paper, 0.9),
                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                  }}>
                    {loadingEconomicEvents ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <CircularProgress size={32} sx={{ mb: 2, color: 'primary.main' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Loading economic events...
                        </Typography>
                      </Box>
                    ) : economicEventsError ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="error.main" sx={{ mb: 2, fontWeight: 500 }}>
                          {economicEventsError}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={fetchEconomicEvents}
                          sx={{
                            fontSize: '0.8rem',
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600
                          }}
                        >
                          Retry
                        </Button>
                      </Box>
                    ) : (
                      <>
                        {/* Impact filter UI above the search bar */}
                        {allEconomicEvents.length > 0 && (
                          <Box sx={{
                            p: { xs: 1, sm: 2.5 }, // Reduced padding on mobile
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            backgroundColor: alpha(theme.palette.background.default, 0.3)
                          }}>
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column', // Always stack vertically for better mobile experience
                                gap: { xs: 1, sm: 1.5 },
                                mb: { xs: 1, sm: 1.5 }
                              }}
                            >
                              {/* Event Name Search Bar */}
                              <TextField
                                variant="outlined"
                                size="small"
                                label="Search events"
                                placeholder="Type to search by event name"
                                value={eventNameSearch || ''}
                                onChange={e => setEventNameSearch(e.target.value)}
                                sx={{
                                  width: '100%', // Full width on all screen sizes
                                  '& .MuiInputBase-input': {
                                    fontSize: { xs: '0.875rem', sm: '1rem' } // Smaller text on mobile
                                  }
                                }}
                              />

                              {/* Impact Filter Section */}
                              <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <FilterIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary" sx={{
                                    fontWeight: 600,
                                    fontSize: { xs: '0.75rem', sm: '0.8rem' }
                                  }}>
                                    Filter by Impact:
                                  </Typography>
                                </Box>
                                <Box sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: { xs: 0.5, sm: 0.75 },
                                  justifyContent: { xs: 'flex-start', sm: 'flex-start' }
                                }}>
                                  {((calendar?.economicCalendarFilters?.impacts as ImpactLevel[]) || (['High', 'Medium', 'Low'] as ImpactLevel[])).map((impact: ImpactLevel) => (
                                    <Chip
                                      key={impact}
                                      label={impact}
                                      size="small"
                                      variant={selectedImpacts.includes(impact) ? "filled" : "outlined"}
                                      onClick={() => {
                                        const newImpacts = selectedImpacts.includes(impact)
                                          ? selectedImpacts.filter(i => i !== impact)
                                          : [...selectedImpacts, impact];
                                        setSelectedImpacts(newImpacts);
                                      }}
                                      sx={{
                                        fontSize: { xs: '0.65rem', sm: '0.75rem' }, // Smaller on mobile
                                        height: { xs: 22, sm: 28 }, // Smaller height on mobile
                                        fontWeight: 600,
                                        borderRadius: 1.5,
                                        backgroundColor: selectedImpacts.includes(impact)
                                          ? getImpactColor(impact, theme)
                                          : 'transparent',
                                        color: selectedImpacts.includes(impact) ? 'white' : getImpactColor(impact, theme),
                                        borderColor: getImpactColor(impact, theme),
                                        borderWidth: selectedImpacts.includes(impact) ? 0 : 1.5,
                                        '&:hover': {
                                          backgroundColor: selectedImpacts.includes(impact)
                                            ? alpha(getImpactColor(impact, theme), 0.8)
                                            : alpha(getImpactColor(impact, theme), 0.08),
                                          transform: 'translateY(-1px)',
                                          transition: 'all 0.2s ease-in-out'
                                        },
                                        '& .MuiChip-label': {
                                          px: { xs: 0.8, sm: 1.2 }, // Reduced padding on mobile
                                          py: 0.4
                                        }
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{
                              mt: 1,
                              display: 'block',
                              fontSize: { xs: '0.7rem', sm: '0.75rem' } // Smaller on mobile
                            }}>
                              Showing {economicEvents.length} of {allEconomicEvents.length} events
                            </Typography>
                          </Box>
                        )}



                        {/* Events List */}
                        {economicEvents.length === 0 ? (
                          <Box sx={{ p: 4, textAlign: 'center' }}>
                            <EconomicIcon sx={{
                              fontSize: 48,
                              color: 'text.disabled',
                              mb: 2,
                              opacity: 0.5
                            }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {allEconomicEvents.length === 0
                                ? 'No economic events found for this date'
                                : 'No events match the selected impact filters'
                              }
                            </Typography>
                            {allEconomicEvents.length > 0 && (
                              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                                Try adjusting your impact filters above
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Box sx={{ p: 0 }}>
                            {economicEvents.map((event, index) => (
                              <React.Fragment key={`${event.id}-${event.timeUtc}-${index}`}>
                                <Box sx={{
                                  px: { xs: 1.5, sm: 2.5 }, // Reduced padding on mobile
                                  py: { xs: 1, sm: 1.5 }, // Reduced padding on mobile
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.action.hover, 0.04)
                                  },
                                  transition: 'background-color 0.2s ease-in-out'
                                }}>
                                  <EconomicEventListItem px={0} py={0} event={event} />
                                </Box>
                                {index < economicEvents.length - 1 && (
                                  <Divider sx={{
                                    mx: { xs: 1.5, sm: 2.5 }, // Reduced margin on mobile
                                    borderColor: alpha(theme.palette.divider, 0.1)
                                  }} />
                                )}
                              </React.Fragment>
                            ))}
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Stack>
          </Box>




        </Stack>
      </Box>
    </AnimatedDropdown>
  );
};

export default TradeDetailExpanded;

