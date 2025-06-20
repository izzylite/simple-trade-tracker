import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
  Avatar,
  Chip,
  Stack,
  Button,
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Close,
  Share,
  OpenInNew,
  CalendarToday,
  Article
} from '@mui/icons-material';
import { BlogPost as BlogPostType, BlogComponentProps } from '../../types/blog';
import { formatDetailedBlogDate } from '../../utils/blog';

interface BlogPostProps extends BlogComponentProps {
  post: BlogPostType;
  open: boolean;
  onClose: () => void;
  onShare: (post: BlogPostType) => void;
}

const BlogPost: React.FC<BlogPostProps> = ({
  post,
  open,
  onClose,
  onShare,
  className,
  style
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  const handleExternalLink = () => {
    window.open(post.url, '_blank', 'noopener,noreferrer');
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      market_news: '#1976d2',
      trading_strategies: '#388e3c',
      economic_indicators: '#f57c00',
      cryptocurrency: '#7b1fa2',
      forex: '#303f9f',
      stocks: '#d32f2f',
      commodities: '#795548',
      analysis: '#455a64',
      education: '#00796b',
      regulation: '#5d4037'
    };
    return colors[category] || '#757575';
  };

  const formatContent = (content: string) => {
    // Basic HTML rendering - in a real app, you might want to use a proper HTML sanitizer
    return { __html: content };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      className={className}
      style={style}
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 2,
            maxHeight: '90vh',
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(145deg, rgba(18, 18, 18, 0.95) 0%, rgba(25, 25, 25, 0.98) 100%)'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: (theme) => theme.palette.mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(0, 0, 0, 0.08)'
          }
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flexGrow: 1, mr: 2 }}>
            {/* Source and Category */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Avatar
                src={post.source.logoUrl}
                sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
              >
                {post.source.name.charAt(0)}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {post.source.name}
              </Typography>
              <Chip
                label={post.category.replace('_', ' ')}
                size="small"
                sx={{
                  backgroundColor: getCategoryColor(post.category),
                  color: 'white',
                  fontSize: '0.7rem',
                  height: 20,
                  ml: 1
                }}
              />
            </Box>

            {/* Title */}
            <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
              {post.title}
            </Typography>

            {/* Meta information */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarToday sx={{ fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {formatDetailedBlogDate(post.publishedAt)}
                </Typography>
              </Box>

            </Stack>

            {/* Author */}
            <Typography variant="body2" color="text.secondary">
              By {post.author}
            </Typography>
          </Box>

          {/* Close button */}
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <DialogContent sx={{ p: 0 }}>
        {/* Hero Image Section - Always rendered for consistent layout */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            height: 300,
            flexShrink: 0
          }}
        >
          {post.imageUrl ? (
            <Box
              component="img"
              src={post.imageUrl}
              alt={post.title}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: 'grey.200'
              }}
            />
          ) : (
            // Gradient placeholder for posts without images
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: (theme) => theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg,
                      ${alpha(theme.palette.primary.main, 0.15)} 0%,
                      ${alpha(theme.palette.secondary.main, 0.15)} 50%,
                      ${alpha(theme.palette.primary.main, 0.08)} 100%)`
                  : `linear-gradient(135deg,
                      ${alpha(theme.palette.primary.main, 0.08)} 0%,
                      ${alpha(theme.palette.secondary.main, 0.08)} 50%,
                      ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2
              }}
            >
              <Article
                sx={{
                  fontSize: 64,
                  color: (theme) => alpha(theme.palette.text.secondary, 0.3)
                }}
              />
              <Typography
                variant="h6"
                sx={{
                  color: (theme) => alpha(theme.palette.text.secondary, 0.5),
                  fontWeight: 500,
                  textAlign: 'center',
                  px: 2
                }}
              >
                {post.source.name}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Summary */}
          <Paper
            sx={{
              p: 2,
              mb: 3,
              bgcolor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'grey.50',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.1)'
                : 'grey.200',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              {post.summary}
            </Typography>
          </Paper>

          {/* Tags */}
          {post.tags.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {post.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Divider sx={{ mb: 3 }} />

          {/* Article Content */}
          <Box
            sx={{
              '& p': { mb: 2, lineHeight: 1.7 },
              '& h1, & h2, & h3, & h4, & h5, & h6': { 
                mt: 3, 
                mb: 2, 
                fontWeight: 600 
              },
              '& ul, & ol': { 
                pl: 3, 
                mb: 2,
                '& li': { mb: 1 }
              },
              '& blockquote': {
                borderLeft: 4,
                borderColor: 'primary.main',
                pl: 2,
                ml: 0,
                fontStyle: 'italic',
                color: 'text.secondary'
              },
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 1
              },
              '& a': {
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }
            }}
            dangerouslySetInnerHTML={formatContent(post.content)}
          />

          {/* Read more link */}
          <Box
            sx={{
              mt: 4,
              p: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'grey.50',
              borderRadius: 1,
              textAlign: 'center',
              border: (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Read the full article on {post.source.name}
            </Typography>
            <Button
              variant="contained"
              startIcon={<OpenInNew />}
              onClick={handleExternalLink}
              size="small"
            >
              View Original Article
            </Button>
          </Box>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          startIcon={<OpenInNew />}
          onClick={handleExternalLink}
          size="small"
        >
          Original Article
        </Button>
        <Button
          startIcon={<Share />}
          onClick={() => onShare(post)}
          size="small"
        >
          Share
        </Button>

        <Button onClick={onClose} size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BlogPost;
