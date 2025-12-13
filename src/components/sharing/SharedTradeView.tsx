import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Visibility as ViewIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Trade } from '../../types/dualWrite';
import TradeDetailExpanded from '../TradeDetailExpanded';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';
import { logger } from '../../utils/logger';
import { getSharedTrade, SharedTradeData } from '../../services/sharingService';
import { TradeOperationsProps } from '../../types/tradeOperations';

interface SharedTradeViewProps {
  shareId: string;
}

interface ProcessedSharedTradeData {
  trade: Trade;
  viewCount: number;
  sharedAt: Date;
}

const SharedTradeView: React.FC<SharedTradeViewProps> = ({ shareId }) => {
  const theme = useTheme();
  const [sharedTrade, setSharedTrade] = useState<ProcessedSharedTradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  useEffect(() => {
    const loadSharedTrade = async () => {
      try {
        setLoading(true);
        const data = await getSharedTrade(shareId);

        if (!data || !data.trade) {
          setError('Shared trade not found or no longer available');
          return;
        }

        // Debug: Log the raw data to understand the format
        logger.log('Raw shared trade data:', data);
        logger.log('Trade date:', data.trade.trade_date);
        logger.log('Shared at:', data.sharedAt);

        // Helper function to convert various timestamp formats to Date
        const convertToDate = (timestamp: any): Date => {
          if (!timestamp) return new Date();

          // If it's already a Date object
          if (timestamp instanceof Date) return timestamp;

          // If it's a Timestamp object with toDate method
          if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }

          // If it's a serialized Timestamp with _seconds
          if (timestamp._seconds !== undefined) {
            return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
          }

          // If it's a number (Unix timestamp in milliseconds)
          if (typeof timestamp === 'number') {
            return new Date(timestamp);
          }

          // If it's a string, try to parse it
          if (typeof timestamp === 'string') {
            const parsed = new Date(timestamp);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
          }

          // Fallback to current date
          logger.warn('Unknown timestamp format:', timestamp);
          return new Date();
        };

        setSharedTrade({
          trade: {
            ...data.trade},
          viewCount: data.viewCount || 0,
          sharedAt: convertToDate(data.sharedAt)
        });
      } catch (err) {
        logger.error('Error loading shared trade:', err);
        setError('Failed to load shared trade');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      loadSharedTrade();
    }
  }, [shareId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !sharedTrade) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Shared trade not found'}
        </Alert>
      </Box>
    );
  }

  const { trade, viewCount, sharedAt } = sharedTrade;

  return (
    <Box sx={{
      maxWidth: 800,
      mx: 'auto',
      p: { xs: 2, sm: 3 }, // Responsive padding: smaller on mobile
      width: '100%'
    }}>
      {/* Image Zoom Dialog */}
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: { xs: 2, sm: 3 }, // Responsive padding
          mb: { xs: 2, sm: 3 }, // Responsive margin
          background: alpha(theme.palette.primary.main, 0.05),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }} // Stack vertically on mobile
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={{ xs: 1, sm: 0 }}
          mb={2}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '1.25rem', sm: '1.5rem' } // Responsive font size
            }}
          >
            📈 Shared Trade
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ViewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {viewCount} views
            </Typography>
          </Stack>
        </Stack>
        
        <Typography variant="body2" color="text.secondary">
          Shared on {sharedAt && !isNaN(sharedAt.getTime()) ? format(sharedAt, 'MMMM d, yyyy') : 'Unknown date'}
        </Typography>
      </Paper>

      {/* Trade Details */}
      <TradeDetailExpanded
        tradeData={trade}
        animate={false}
        isExpanded={true}
        tradeOperations={{
          onZoomImage: (url: string, allImages?: string[], initialIndex?: number) => {
            setZoomedImages({
              selectetdImageIndex: initialIndex || 0,
              allImages: allImages || [url]
            });
          },
          // Read-only mode - no update/gallery/AI operations
          onUpdateTradeProperty: undefined,
          calendarId: undefined,
          onOpenGalleryMode: undefined,
          economicFilter: undefined,
          onOpenAIChat: undefined,
          isTradeUpdating: undefined
        }}
      />

      {/* Footer */}
       
    </Box>
  );
};

export default SharedTradeView;
