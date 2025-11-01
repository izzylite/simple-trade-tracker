import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Trade, Calendar } from '../types/dualWrite';
import TradeDetailExpanded from './TradeDetailExpanded';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface TradeGalleryDialogProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  initialTradeId?: string;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  title?: string;
  calendarId?: string;
  // Optional props for trade link navigation in notes
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering
  calendar?: Calendar;
}

const TradeGalleryDialog: React.FC<TradeGalleryDialogProps> = ({
  open,
  onClose,
  trades,
  initialTradeId,
  onUpdateTradeProperty,
  setZoomedImage,
  title = "Trade Gallery",
  calendarId,
  onOpenGalleryMode,
  calendar
}) => {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find initial index based on initialTradeId
  const initialIndex = useMemo(() => {
    if (!initialTradeId) return 0;
    const index = trades.findIndex(trade => trade.id === initialTradeId);
    return index >= 0 ? index : 0;
  }, [trades, initialTradeId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Update current index when initialTradeId changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Get current trade
  const currentTrade = useMemo(() => {
    return trades[currentIndex] || null;
  }, [trades, currentIndex]);

  // Navigation functions
  const navigateNext = useCallback(() => {
    if (trades.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % trades.length);
  }, [trades.length]);

  const navigatePrevious = useCallback(() => {
    if (trades.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + trades.length) % trades.length);
  }, [trades.length]);

  // Scroll functions
  const scrollUp = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        top: -200, // Scroll up by 200px
        behavior: 'smooth'
      });
    }
  }, []);

  const scrollDown = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        top: 200, // Scroll down by 200px
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

  if (!currentTrade) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        zIndex: 1600 // Higher than AI drawer (1400) to ensure gallery appears on top
      }}
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
          backgroundColor: theme.palette.background.default
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
        {/* Navigation and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {/* Previous Button */}
          <Tooltip title="Previous trade (←)">
            <span>
              <IconButton
                onClick={navigatePrevious}
                disabled={trades.length <= 1}
                sx={{
                  color: trades.length <= 1 ? 'text.disabled' : 'text.primary',
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={`${currentIndex + 1} of ${trades.length}`}
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  fontWeight: 600
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(currentTrade.trade_date), 'MMM d, yyyy')}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Next Button */}
          <Tooltip title="Next trade (→)">
            <span>
              <IconButton
                onClick={navigateNext}
                disabled={trades.length <= 1}
                sx={{
                  color: trades.length <= 1 ? 'text.disabled' : 'text.primary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
            </span>
          </Tooltip>
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

      {/* Content */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme)
        }}
      >
        <TradeDetailExpanded
          tradeData={currentTrade}
          isExpanded={true}
          setZoomedImage={setZoomedImage}
          onUpdateTradeProperty={onUpdateTradeProperty}
          calendarId={calendarId}
          trades={trades}
          onOpenGalleryMode={onOpenGalleryMode}
          calendar={calendar}
        />
      </Box>
    </Dialog>
  );
};

export default TradeGalleryDialog;
