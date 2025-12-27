import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Button,
  Typography,
  useTheme,
  alpha,
  Chip,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  ShowChart as TradeIcon,
  SmartToy as AssistantIcon,
  History as HistoryIcon,
  AddComment as NewChatIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  EditDocument
} from '@mui/icons-material';
import { AIConversation } from '../types/aiChat';
import { format } from 'date-fns';
import { Trade, Calendar } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import { Note } from '../types/note';
import TradeDetailExpanded from './TradeDetailExpanded';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { TradeOperationsProps } from '../types/tradeOperations';
import RoundedTabs, { TabPanel } from './common/RoundedTabs';
import { useAIChat } from '../hooks/useAIChat';
import AIChatInterface, { QuestionTemplate } from './aiChat/AIChatInterface';
import { useAuthState } from '../contexts/AuthStateContext';
import Shimmer from './Shimmer';
import EconomicEventDetailDialog from './economicCalendar/EconomicEventDetailDialog';
import NoteEditorDialog from './notes/NoteEditorDialog';
import { logger } from '../utils/logger';
import { Z_INDEX } from '../styles/zIndex';
import { getTradeRepository } from '../services/calendarService';
import { useTradeSyncContextOptional } from '../contexts/TradeSyncContext';
import { normalizeTradeDates } from '../utils/tradeUtils';

interface TradeGalleryDialogProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  initialTradeId?: string;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  title?: string;
  calendarId?: string;
  // Calendar data for economic events filtering
  calendar?: Calendar;
  // AI-only mode: starts on Assistant tab
  aiOnlyMode?: boolean;
  isReadOnly?: boolean;
  // Fetch mode: if set, dialog will fetch trades for this year when trades array is empty
  fetchYear?: number;

  // Trade operations - required
  tradeOperations: TradeOperationsProps;
}

// Page size for paginated fetching
const GALLERY_PAGE_SIZE = 20;

const TradeGalleryDialog: React.FC<TradeGalleryDialogProps> = ({
  open,
  onClose,
  trades,
  initialTradeId,
  setZoomedImage,
  title = "Trade Gallery",
  calendarId,
  calendar,
  aiOnlyMode = false,
  isReadOnly = false,
  fetchYear,
  tradeOperations
}) => {
  // Destructure from tradeOperations directly
  const {
    onUpdateTradeProperty,
    onOpenGalleryMode,
    onEditTrade,
    onDeleteTrade,
    onDeleteMultipleTrades,
    onUpdateCalendarProperty,
    isTradeUpdating
  } = tradeOperations;

  // Subscribe to trade sync context for real-time updates
  const tradeSync = useTradeSyncContextOptional();
  const lastProcessedTimestamp = useRef(0);

  const theme = useTheme();
  const { user } = useAuthState();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // In aiOnlyMode, always show Assistant tab (index 1)
  const [activeTab, setActiveTab] = useState(aiOnlyMode ? 1 : 0);

  // Fetch mode state - used when trades array is empty and fetchYear is set
  const [internalTrades, setInternalTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [hasMoreTrades, setHasMoreTrades] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // Derive initial total count from calendar year_stats, then update from API response
  const initialTotalCount = fetchYear !== undefined
    ? calendar?.year_stats?.[fetchYear.toString()]?.total_trades ?? 0
    : 0;
  const [totalTradeCount, setTotalTradeCount] = useState(initialTotalCount);

  // Determine if we're in fetch mode (no trades provided but fetchYear is set)
  const isFetchMode = trades.length === 0 && fetchYear !== undefined && calendarId !== undefined;

  // Use either provided trades or internally fetched trades
  const effectiveTrades = isFetchMode ? internalTrades : trades;

  // Find initial index based on initialTradeId
  const initialIndex = useMemo(() => {
    if (!initialTradeId) return 0;
    const index = effectiveTrades.findIndex(trade => trade.id === initialTradeId);
    return index >= 0 ? index : 0;
  }, [effectiveTrades, initialTradeId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Update current index when initialTradeId changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Ensure currentIndex is within bounds (might be stale from previous session)
  const safeCurrentIndex = useMemo(() => {
    if (effectiveTrades.length === 0) return 0;
    return Math.min(Math.max(0, currentIndex), effectiveTrades.length - 1);
  }, [currentIndex, effectiveTrades.length]);

  // Get current trade using safe index
  const currentTrade = useMemo(() => {
    if (effectiveTrades.length === 0) return null;
    return effectiveTrades[safeCurrentIndex] || null;
  }, [effectiveTrades, safeCurrentIndex]);

  // Fetch initial trades when in fetch mode and dialog opens
  useEffect(() => {
    const fetchInitialTrades = async () => {
      if (!isFetchMode || !open || !calendarId || fetchYear === undefined) return;

      // Don't re-fetch if we already have trades
      if (internalTrades.length > 0) return;

      setIsLoadingTrades(true);
      try {
        const result = await getTradeRepository().getTradesForYearPaginated(
          calendarId,
          fetchYear,
          1,
          GALLERY_PAGE_SIZE
        );

        setInternalTrades(result.trades);
        setHasMoreTrades(result.hasMore);
        setCurrentPage(1);
        setTotalTradeCount(result.totalCount);
        setCurrentIndex(0);

        logger.log(`📖 Gallery: Initial fetch - ${result.trades.length} trades, hasMore: ${result.hasMore}, total: ${result.totalCount}`);
      } catch (error) {
        logger.error('Error fetching initial trades:', error);
      } finally {
        setIsLoadingTrades(false);
      }
    };

    fetchInitialTrades();
  }, [isFetchMode, open, calendarId, fetchYear]);

  // Load more trades when approaching the end (within last 2 trades)
  const loadMoreTrades = useCallback(async () => {
    if (!isFetchMode || isLoadingTrades || !hasMoreTrades || !calendarId || fetchYear === undefined) {
      return;
    }

    setIsLoadingTrades(true);
    try {
      const nextPage = currentPage + 1;
      const result = await getTradeRepository().getTradesForYearPaginated(
        calendarId,
        fetchYear,
        nextPage,
        GALLERY_PAGE_SIZE
      );

      setInternalTrades(prev => [...prev, ...result.trades]);
      setHasMoreTrades(result.hasMore);
      setCurrentPage(nextPage);

      logger.log(`📖 Gallery: Loaded page ${nextPage} - ${result.trades.length} more trades, hasMore: ${result.hasMore}`);
    } catch (error) {
      logger.error('Error loading more trades:', error);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [isFetchMode, isLoadingTrades, hasMoreTrades, calendarId, fetchYear, currentPage]);

  // Trigger load more when user is near the end
  useEffect(() => {
    if (!isFetchMode || !hasMoreTrades || isLoadingTrades) return;

    // Load more when within last 2 trades (use safeCurrentIndex for accurate calculation)
    const tradesRemaining = effectiveTrades.length - safeCurrentIndex - 1;
    if (tradesRemaining <= 1) {
      loadMoreTrades();
    }
  }, [safeCurrentIndex, effectiveTrades.length, isFetchMode, hasMoreTrades, isLoadingTrades, loadMoreTrades]);

  // Reset internal state when dialog closes, sync totalTradeCount when opening
  useEffect(() => {
    if (!open) {
      setInternalTrades([]);
      setCurrentPage(1);
      setHasMoreTrades(false);
      setTotalTradeCount(initialTotalCount);
    } else {
      // Sync total count from calendar stats when dialog opens
      setTotalTradeCount(initialTotalCount);
    }
  }, [open, initialTotalCount]);

  // Handle trade sync events from other components (e.g., useCalendarTrades)
  useEffect(() => {
    if (!tradeSync?.lastSyncEvent || !open) return;

    const { type, trade, timestamp } = tradeSync.lastSyncEvent;

    // Avoid processing the same event twice
    if (timestamp <= lastProcessedTimestamp.current) return;
    lastProcessedTimestamp.current = timestamp;

    // Only process events for trades in our calendar
    if (calendarId && trade.calendar_id !== calendarId) return;

    const normalizedTrade = normalizeTradeDates(trade);

    // Update internalTrades if in fetch mode
    if (isFetchMode) {
      setInternalTrades(prevTrades => {
        switch (type) {
          case 'update': {
            const tradeIndex = prevTrades.findIndex(t => t.id === trade.id);
            if (tradeIndex === -1) return prevTrades;

            const updatedTrades = [...prevTrades];
            updatedTrades[tradeIndex] = normalizedTrade;
            logger.log(`📖 Gallery: Synced trade update for ${trade.id}`);
            return updatedTrades;
          }
          case 'delete': {
            const filteredTrades = prevTrades.filter(t => t.id !== trade.id);
            if (filteredTrades.length === prevTrades.length) return prevTrades;
            logger.log(`📖 Gallery: Synced trade delete for ${trade.id}`);
            return filteredTrades;
          }
          default:
            return prevTrades;
        }
      });
    }
  }, [tradeSync?.lastSyncEvent, open, calendarId, isFetchMode]);

  // History sliding view state (like AIChatDrawer)
  const [showHistoryView, setShowHistoryView] = useState(false);

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);

  // Note editor dialog state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // Track previous trade ID to detect trade changes
  const previousTradeIdRef = useRef<string | null>(null);

  // Reset tab when navigating between trades
  // In normal mode: reset to Trade tab (0)
  // In aiOnlyMode: keep on Assistant tab (1)
  useEffect(() => {
    setActiveTab(aiOnlyMode ? 1 : 0);
    setShowHistoryView(false);
  }, [safeCurrentIndex, aiOnlyMode]);

  // Initialize AI chat with trade-scoped context
  const aiChat = useAIChat({
    userId: user?.uid,
    calendar: calendar,
    trade: currentTrade || undefined,
    autoSaveConversation: true, // Enable saving for trade-specific conversations
  });

  // Reset conversation when trade changes (each trade has its own history)
  useEffect(() => {
    const currentTradeId = currentTrade?.id || null;

    // If trade changed, reset the conversation
    if (previousTradeIdRef.current !== null && previousTradeIdRef.current !== currentTradeId) {
      aiChat.setMessages([]);
      setShowHistoryView(false);
    }

    previousTradeIdRef.current = currentTradeId;
  }, [currentTrade?.id, aiChat.setMessages]);

  // Load trade-specific conversations when switching to Assistant tab
  useEffect(() => {
    if (activeTab === 1 && currentTrade?.id && user?.uid) {
      aiChat.loadConversations();
    }
  }, [activeTab, currentTrade?.id, user?.uid, aiChat.loadConversations]);

  // Single trade context for AI to focus on
  const tradeContext = useMemo(() => {
    return currentTrade ? [currentTrade] : [];
  }, [currentTrade]);

  // Generate trade-specific question templates
  const tradeQuestionTemplates: QuestionTemplate[] = useMemo(() => {
    if (!currentTrade) return [];

    const tradeName = currentTrade.name || 'this trade';
    const tradeType = currentTrade.trade_type;
    const isWin = tradeType === 'win';
    const isLoss = tradeType === 'loss';

    return [
      {
        category: "Trade Analysis",
        questions: [
          `Why did ${tradeName} ${isWin ? 'succeed' : isLoss ? 'fail' : 'break even'}?`,
          `What patterns do you see in this trade's setup?`,
          `Analyze the entry and exit timing for this trade`
        ]
      },
      {
        category: "Compare & Learn",
        questions: [
          `Show me similar trades from my history`,
          `How does this trade compare to my winning trades?`,
          `What could I have done differently in this trade?`
        ]
      },
      {
        category: "Risk & Management",
        questions: [
          `Was my position size appropriate for this trade?`,
          `Analyze the risk-reward ratio of this trade`,
          `Did I follow my trading rules on this trade?`
        ]
      }
    ];
  }, [currentTrade]);

  // Handle tab change
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setShowHistoryView(false);
  }, []);

  // History handlers (sliding panel approach like AIChatDrawer)
  const handleNewChat = useCallback(async () => {
    await aiChat.startNewChat();
    setShowHistoryView(false);
  }, [aiChat.startNewChat]);

  const handleSelectConversation = useCallback((conversation: AIConversation) => {
    aiChat.selectConversation(conversation);
    setShowHistoryView(false);
  }, [aiChat.selectConversation]);

  const handleDeleteConversation = useCallback(async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await aiChat.deleteConversation(conversationId);
  }, [aiChat.deleteConversation]);

  const getPreviewText = useCallback((conversation: AIConversation): string => {
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      return firstUserMessage.content.substring(0, 80) +
        (firstUserMessage.content.length > 80 ? '...' : '');
    }
    return 'No messages';
  }, []);

  // Navigation functions
  // Check if we're at the last trade and loading more (use safeCurrentIndex for accurate checks)
  const isAtEnd = safeCurrentIndex >= effectiveTrades.length - 1;
  const isAtStart = safeCurrentIndex <= 0;
  const isLoadingNext = isLoadingTrades && isAtEnd && hasMoreTrades;
  const isLoadingPrev = isLoadingTrades && isAtStart && isFetchMode;

  const navigateNext = useCallback(() => {
    if (effectiveTrades.length <= 1) return;
    // In fetch mode, don't wrap around - just go to next if available
    if (isFetchMode) {
      if (safeCurrentIndex < effectiveTrades.length - 1) {
        setCurrentIndex(safeCurrentIndex + 1);
      }
    } else {
      // Normal mode - wrap around
      setCurrentIndex((safeCurrentIndex + 1) % effectiveTrades.length);
    }
  }, [effectiveTrades.length, isFetchMode, safeCurrentIndex]);

  const navigatePrevious = useCallback(() => {
    if (effectiveTrades.length <= 1) return;
    // In fetch mode, don't wrap around
    if (isFetchMode) {
      if (safeCurrentIndex > 0) {
        setCurrentIndex(safeCurrentIndex - 1);
      }
    } else {
      // Normal mode - wrap around
      setCurrentIndex((safeCurrentIndex - 1 + effectiveTrades.length) % effectiveTrades.length);
    }
  }, [effectiveTrades.length, isFetchMode, safeCurrentIndex]);

  // Scroll functions
  const scrollUp = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        top: -200,
        behavior: 'smooth'
      });
    }
  }, []);

  const scrollDown = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        top: 200,
        behavior: 'smooth'
      });
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollDown();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, navigatePrevious, navigateNext, scrollUp, scrollDown, onClose]);

  // Determine if we're in initial loading state (fetch mode, loading, no trades yet)
  const isInitialLoading = isFetchMode && isLoadingTrades && effectiveTrades.length === 0;

  // Only return null if not in fetch mode and no trade
  if (!currentTrade && !isInitialLoading) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        zIndex: Z_INDEX.DIALOG_POPUP
      }}
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.default,
          overflow: 'hidden'
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
      }}>

        <Box sx={{ display: 'flex', flex: 1 }}>
          {/* Navigation and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            {/* Previous Button */}
            <Tooltip
              title={isInitialLoading ? "Loading..." : isAtStart && isFetchMode ? "At first trade" : "Previous trade (←)"}
              slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
            >
              <span>
                <IconButton
                  onClick={navigatePrevious}
                  disabled={isInitialLoading || effectiveTrades.length <= 1 || (isAtStart && isFetchMode)}
                  sx={{
                    color: isInitialLoading || effectiveTrades.length <= 1 || (isAtStart && isFetchMode) ? 'text.disabled' : 'text.primary',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </span>
            </Tooltip>

            {/* Title and Counter */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
              <Typography variant="h6" sx={{
                fontWeight: 600,
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}>
                {title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {isInitialLoading ? (
                  <Shimmer height={24} width={80} borderRadius={12} variant="wave" intensity="medium" />
                ) : (
                  <Chip
                    size="small"
                    label={isFetchMode
                      ? `${safeCurrentIndex + 1} of ${totalTradeCount}`
                      : `${safeCurrentIndex + 1} of ${effectiveTrades.length}`
                    }
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      fontWeight: 600
                    }}
                  />
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  {isInitialLoading ? (
                    <Shimmer height={14} width={100} borderRadius={4} variant="wave" intensity="low" />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}>
                      {format(new Date(currentTrade!.trade_date), 'MMM d, yyyy')}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Next Button */}
            <Tooltip
              title={isLoadingNext ? "Loading more trades..." : isAtEnd && !hasMoreTrades && isFetchMode ? "At last trade" : "Next trade (→)"}
              slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
            >
              <span>
                <IconButton
                  onClick={navigateNext}
                  disabled={effectiveTrades.length <= 1 || isLoadingNext || (isAtEnd && !hasMoreTrades && isFetchMode)}
                  sx={{
                    color: effectiveTrades.length <= 1 || (isAtEnd && !hasMoreTrades && isFetchMode) ? 'text.disabled' : 'text.primary',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  {isLoadingNext ? (
                    <CircularProgress size={20} color="primary" />
                  ) : (
                    <ArrowForwardIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Tabs and History Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
          <RoundedTabs
            tabs={[
              { label: 'Trade', icon: <TradeIcon sx={{ fontSize: 18 }} /> },
              { label: 'Assistant', icon: <AssistantIcon sx={{ fontSize: 18 }} /> }
            ]}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            size="small"
          />

          {/* History controls - only show when on Assistant tab */}
          {activeTab === 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
              <Tooltip
                title="New Chat"
                slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={handleNewChat}
                    disabled={aiChat.messages.length === 0}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
                      '&:disabled': { color: 'text.disabled' }
                    }}
                  >
                    <NewChatIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip
                title={showHistoryView ? "Back to Chat" : "Conversation History"}
                slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
              >
                <IconButton
                  size="small"
                  onClick={() => setShowHistoryView(!showHistoryView)}
                  sx={{
                    color: showHistoryView ? 'primary.main' : 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                  }}
                >
                  {showHistoryView ? <BackIcon sx={{ fontSize: 18 }} /> : <HistoryIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Close Button */}
        <IconButton
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              color: 'error.main'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Tab Content */}
      {/* Trade Details */}
      <TabPanel value={activeTab} index={0}>
        <Box
          ref={scrollContainerRef}
          sx={{
            overflow: 'auto',
            maxHeight: 'calc(90vh - 180px)',
            ...scrollbarStyles(theme)
          }}
        >
          {isInitialLoading ? (
            // Shimmer loading state matching TradeDetailExpanded structure
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Trade name row: Icon + Name + Action buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Shimmer height={28} width={28} borderRadius={4} variant="wave" intensity="medium" />
                  <Shimmer height={28} width={120} borderRadius={4} variant="wave" intensity="medium" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Shimmer height={32} width={32} borderRadius="50%" variant="wave" intensity="low" />
                  <Shimmer height={32} width={32} borderRadius="50%" variant="wave" intensity="low" />
                  <Shimmer height={32} width={32} borderRadius="50%" variant="wave" intensity="low" />
                </Box>
              </Box>

              {/* Properties Section Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Shimmer height={16} width={16} borderRadius={4} variant="wave" intensity="low" />
                <Shimmer height={16} width={80} borderRadius={4} variant="wave" intensity="low" />
              </Box>

              {/* Properties 2x2 Grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2
              }}>
                {/* PnL Card */}
                <Box sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Shimmer height={14} width={14} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={14} width={30} borderRadius={4} variant="wave" intensity="low" />
                  </Box>
                  <Shimmer height={28} width={80} borderRadius={4} variant="wave" intensity="medium" />
                </Box>

                {/* Date Card */}
                <Box sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Shimmer height={14} width={14} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={14} width={35} borderRadius={4} variant="wave" intensity="low" />
                  </Box>
                  <Shimmer height={20} width={130} borderRadius={4} variant="wave" intensity="medium" />
                </Box>

                {/* Risk to Reward Card */}
                <Box sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Shimmer height={14} width={14} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={14} width={90} borderRadius={4} variant="wave" intensity="low" />
                  </Box>
                  <Shimmer height={24} width={40} borderRadius={4} variant="wave" intensity="medium" sx={{ mb: 0.5 }} />
                  <Shimmer height={14} width={120} borderRadius={4} variant="wave" intensity="low" />
                </Box>

                {/* Session Card */}
                <Box sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Shimmer height={14} width={14} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={14} width={55} borderRadius={4} variant="wave" intensity="low" />
                  </Box>
                  <Shimmer height={20} width={60} borderRadius={4} variant="wave" intensity="medium" />
                </Box>
              </Box>

              {/* Images Section */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Shimmer height={16} width={16} borderRadius={4} variant="wave" intensity="low" />
                  <Shimmer height={16} width={55} borderRadius={4} variant="wave" intensity="low" />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Shimmer height={100} width="100%" borderRadius={2} variant="wave" intensity="medium" sx={{ flex: 1 }} />
                  <Shimmer height={100} width="100%" borderRadius={2} variant="wave" intensity="medium" sx={{ flex: 1 }} />
                  <Shimmer height={100} width="100%" borderRadius={2} variant="wave" intensity="medium" sx={{ flex: 1 }} />
                </Box>
              </Box>

              {/* Tags Section */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Shimmer height={16} width={16} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={16} width={40} borderRadius={4} variant="wave" intensity="low" />
                  </Box>
                  <Shimmer height={20} width={20} borderRadius={4} variant="wave" intensity="low" />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[140, 180, 100, 160, 80, 100, 80, 120].map((width, i) => (
                    <Shimmer key={i} height={28} width={width} borderRadius={14} variant="wave" intensity="medium" />
                  ))}
                </Box>
              </Box>

              {/* Economic Events Section */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Shimmer height={16} width={16} borderRadius={4} variant="wave" intensity="low" />
                  <Shimmer height={16} width={180} borderRadius={4} variant="wave" intensity="low" />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Shimmer height={40} width="100%" borderRadius={8} variant="wave" intensity="low" />
                  <Shimmer height={40} width="100%" borderRadius={8} variant="wave" intensity="low" />
                </Box>
              </Box>
            </Box>
          ) : currentTrade ? (
            <TradeDetailExpanded
              tradeData={currentTrade}
              isExpanded={true}
              animate={false}
              trades={trades}
              tradeOperations={tradeOperations}
              isReadOnly={isReadOnly}
              showAIButton={false}
            />
          ) : null}
        </Box>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* AI Assistant - Sliding Pager (Chat + History) */}
        <Box
          sx={{
            height: 'calc(90vh - 180px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Pager Container */}
          <Box sx={{
            display: 'flex',
            width: '200%',
            height: '100%',
            transform: showHistoryView ? 'translateX(-50%)' : 'translateX(0)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {/* Chat View */}
            <Box sx={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <AIChatInterface
                {...aiChat}
                userId={user?.uid}
                calendar={calendar}
                trades={tradeContext}
                questionTemplates={tradeQuestionTemplates}
                autoScroll={aiChat.messages.length > 0}
                onTradeClick={(tradeId, contextTrades) => {
                  // Navigate to the trade within the gallery
                  const tradeIndex = effectiveTrades.findIndex(t => t.id === tradeId);
                  if (tradeIndex >= 0 && effectiveTrades.length <= 5) {
                    setCurrentIndex(tradeIndex);
                    setActiveTab(0); // Switch to Trade tab
                  } else if (onOpenGalleryMode) {
                    // Trade not in current gallery, open new gallery
                    onOpenGalleryMode(contextTrades, tradeId, 'AI Chat - Trade Gallery');
                  } else {
                    logger.log('Trade clicked but not found in gallery:', tradeId);
                  }
                }}
                onEventClick={(event) => {
                  logger.log('Economic event clicked:', event);
                  setSelectedEvent(event);
                  setEventDetailDialogOpen(true);
                }}
                onNoteClick={(noteId, note) => {
                  logger.log('Note clicked:', noteId);
                  if (note) {
                    setSelectedNote(note);
                    setNoteEditorOpen(true);
                  } else {
                    logger.warn('Note not found in embedded notes:', noteId);
                  }
                }}
                isReadOnly={isReadOnly}
              />
            </Box>

            {/* History View */}
            <Box sx={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* History Header */}
              <Box sx={{
                p: 2,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                backgroundColor: alpha(theme.palette.background.paper, 0.8)
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Conversation History
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {aiChat.conversations.length} conversation{aiChat.conversations.length !== 1 ? 's' : ''} for this trade
                </Typography>
              </Box>

              {/* History Content */}
              <Box sx={{
                flex: 1,
                overflow: 'auto',
                ...scrollbarStyles(theme)
              }}>
                {aiChat.loadingConversations ? (
                  <List sx={{ p: 0 }}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <React.Fragment key={index}>
                        <ListItem sx={{ py: 2, px: 2 }}>
                          <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Shimmer height={20} width="60%" borderRadius={4} variant="wave" intensity="medium" />
                              <Shimmer height={20} width={60} borderRadius={10} variant="pulse" intensity="low" />
                            </Box>
                            <Shimmer height={16} width="90%" borderRadius={4} variant="default" intensity="low" sx={{ mb: 0.5 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Shimmer height={14} width={120} borderRadius={4} variant="default" intensity="low" />
                            </Box>
                          </Box>
                        </ListItem>
                        {index < 4 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : aiChat.conversations.length === 0 ? (
                  <Box sx={{ p: 3 }}>
                    <Alert severity="info">
                      No conversation history yet. Start chatting with the AI to create your first conversation for this trade!
                    </Alert>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {aiChat.conversations.map((conversation, index) => (
                      <React.Fragment key={conversation.id}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => handleSelectConversation(conversation)}
                            sx={{
                              py: 2,
                              px: 2,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.08)
                              }
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {/* Title and chip */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {conversation.title}
                                </Typography>
                                <Chip
                                  label={`${conversation.message_count} msgs`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                    color: 'primary.main'
                                  }}
                                />
                              </Box>

                              {/* Preview text */}
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  fontSize: '0.85rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  mb: 0.5
                                }}
                              >
                                {getPreviewText(conversation)}
                              </Typography>

                              {/* Date */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">
                                  {format(conversation.updated_at, 'MMM d, yyyy • h:mm a')}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Delete button */}
                            <IconButton
                              onClick={(e) => handleDeleteConversation(conversation.id, e)}
                              size="small"
                              sx={{
                                color: 'error.main',
                                flexShrink: 0,
                                mt: 0.5,
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.error.main, 0.1)
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemButton>
                        </ListItem>
                        {index < aiChat.conversations.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </TabPanel>

      {/* Economic Event Detail Dialog */}
      {selectedEvent && calendar && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Note Editor Dialog */}
      {noteEditorOpen && selectedNote && calendarId && (
        <NoteEditorDialog
          open={noteEditorOpen}
          onClose={() => {
            setNoteEditorOpen(false);
            setSelectedNote(null);
          }}
          note={selectedNote}
          calendarId={calendarId}
          onSave={(updatedNote) => {
            // Update the note in embedded notes across all messages
            aiChat.setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[updatedNote.id]) {
                  return {
                    ...msg,
                    embeddedNotes: {
                      ...msg.embeddedNotes,
                      [updatedNote.id]: updatedNote
                    }
                  };
                }
                return msg;
              })
            );
          }}
          onDelete={(noteId) => {
            // Remove the note from embedded notes across all messages
            aiChat.setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[noteId]) {
                  const { [noteId]: _, ...remainingNotes } = msg.embeddedNotes;
                  return {
                    ...msg,
                    embeddedNotes: remainingNotes
                  };
                }
                return msg;
              })
            );
            setNoteEditorOpen(false);
            setSelectedNote(null);
          }}
        />
      )}
    </Dialog>
  );
};

export default TradeGalleryDialog;
