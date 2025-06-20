import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Grid,
  Stack,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Backdrop
} from '@mui/material';
import {
  Refresh,
  ErrorOutline,
  Article,
  WifiOff
} from '@mui/icons-material';

// Loading skeleton for blog cards
export const BlogCardSkeleton: React.FC = () => (
  <Card sx={{ height: 320, display: 'flex', flexDirection: 'column' }}>
    <Skeleton variant="rectangular" height={140} />
    <CardContent sx={{ flexGrow: 1, p: 2 }}>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton variant="text" width={80} />
          <Skeleton variant="rectangular" width={60} height={20} sx={{ ml: 'auto', borderRadius: 1 }} />
        </Box>
        <Skeleton variant="text" width="100%" height={24} />
        <Skeleton variant="text" width="90%" height={24} />
        <Skeleton variant="text" width="95%" height={20} />
        <Skeleton variant="text" width="85%" height={20} />
        <Skeleton variant="text" width="75%" height={20} />
        <Box sx={{ display: 'flex', gap: 0.5, mt: 2 }}>
          <Skeleton variant="rectangular" width={50} height={20} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={45} height={20} sx={{ borderRadius: 1 }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
          <Skeleton variant="text" width={100} />
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="circular" width={24} height={24} />
          </Box>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

// Loading grid for multiple blog cards
interface BlogGridSkeletonProps {
  count?: number;
}

export const BlogGridSkeleton: React.FC<BlogGridSkeletonProps> = ({ count = 8 }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)'
      },
      gap: 3
    }}
  >
    {Array.from({ length: count }).map((_, index) => (
      <BlogCardSkeleton key={index} />
    ))}
  </Box>
);

// Loading backdrop for full-screen loading
interface BlogLoadingBackdropProps {
  open: boolean;
  message?: string;
}

export const BlogLoadingBackdrop: React.FC<BlogLoadingBackdropProps> = ({ 
  open, 
  message = 'Loading news...' 
}) => (
  <Backdrop 
    open={open} 
    sx={{ 
      zIndex: (theme) => theme.zIndex.drawer + 1,
      flexDirection: 'column',
      gap: 2
    }}
  >
    <CircularProgress color="primary" size={60} />
    <Typography variant="h6" color="white">
      {message}
    </Typography>
  </Backdrop>
);

// Error state component
interface BlogErrorStateProps {
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
  variant?: 'inline' | 'fullscreen';
}

export const BlogErrorState: React.FC<BlogErrorStateProps> = ({
  error,
  onRetry,
  onClearError,
  variant = 'inline'
}) => {
  if (variant === 'fullscreen') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          textAlign: 'center',
          p: 4
        }}
      >
        <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Oops! Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
          {error}
        </Typography>
        <Stack direction="row" spacing={2}>
          {onRetry && (
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={onRetry}
            >
              Try Again
            </Button>
          )}
          {onClearError && (
            <Button
              variant="outlined"
              onClick={onClearError}
            >
              Dismiss
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Alert 
      severity="error" 
      sx={{ mb: 3 }}
      action={
        <Stack direction="row" spacing={1}>
          {onRetry && (
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          {onClearError && (
            <Button
              size="small"
              onClick={onClearError}
            >
              Dismiss
            </Button>
          )}
        </Stack>
      }
    >
      {error}
    </Alert>
  );
};

// Empty state component
interface BlogEmptyStateProps {
  title?: string;
  message?: string;
  onRefresh?: () => void;
  showRefreshButton?: boolean;
  icon?: React.ReactNode;
}

export const BlogEmptyState: React.FC<BlogEmptyStateProps> = ({
  title = 'No articles found',
  message = 'Try adjusting your filters or refresh to load new content',
  onRefresh,
  showRefreshButton = true,
  icon
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      textAlign: 'center',
      p: 4
    }}
  >
    {icon || <Article sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />}
    <Typography variant="h6" color="text.secondary" gutterBottom>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
      {message}
    </Typography>
    {showRefreshButton && onRefresh && (
      <Button
        variant="contained"
        startIcon={<Refresh />}
        onClick={onRefresh}
      >
        Refresh News
      </Button>
    )}
  </Box>
);

// Network error state
export const BlogNetworkError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <BlogErrorState
    error="Unable to connect to news sources. Please check your internet connection and try again."
    onRetry={onRetry}
    variant="fullscreen"
  />
);

// Loading indicator for inline updates
interface BlogInlineLoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const BlogInlineLoading: React.FC<BlogInlineLoadingProps> = ({ 
  message = 'Loading...', 
  size = 'medium' 
}) => {
  const sizeMap = {
    small: 20,
    medium: 30,
    large: 40
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 2
      }}
    >
      <CircularProgress size={sizeMap[size]} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

// Refresh indicator for auto-refresh
interface BlogRefreshIndicatorProps {
  isRefreshing: boolean;
  lastUpdated?: Date;
  onRefresh?: () => void;
}

export const BlogRefreshIndicator: React.FC<BlogRefreshIndicatorProps> = ({
  isRefreshing,
  lastUpdated,
  onRefresh
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      p: 1,
      bgcolor: 'background.paper',
      borderRadius: 1,
      border: 1,
      borderColor: 'divider'
    }}
  >
    {isRefreshing ? (
      <>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Updating...
        </Typography>
      </>
    ) : (
      <>
        <Typography variant="caption" color="text.secondary">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Not updated'}
        </Typography>
        {onRefresh && (
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={onRefresh}
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            Refresh
          </Button>
        )}
      </>
    )}
  </Box>
);
