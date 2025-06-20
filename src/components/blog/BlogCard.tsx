import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  Share,
  OpenInNew,
  Article
} from '@mui/icons-material';
import { BlogPost, BlogComponentProps } from '../../types/blog';
import { formatBlogDate, truncateText } from '../../utils/blog';

interface BlogCardProps extends BlogComponentProps {
  post: BlogPost;
  onPostClick: (post: BlogPost) => void;
  onShare: (post: BlogPost) => void;
  showImage?: boolean;
  variant?: 'default' | 'compact';
}

const BlogCard: React.FC<BlogCardProps> = ({
  post,
  onPostClick,
  onShare,
  showImage = true,
  variant = 'default',
  className,
  style
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on action buttons
    if ((e.target as HTMLElement).closest('.blog-card-actions')) {
      return;
    }
    onPostClick(post);
  };

  const handleExternalLink = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const cardHeight = variant === 'compact' ? 200 : 380;
  const imageHeight = variant === 'compact' ? 80 : 160;

  return (
    <Card
      className={className}
      style={style}
      sx={{
        height: cardHeight,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.9) 0%, rgba(25, 25, 25, 0.95) 100%)'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%)',
        backdropFilter: 'blur(10px)',
        boxShadow: (theme) => theme.palette.mode === 'dark'
          ? '0 8px 32px rgba(0, 0, 0, 0.4)'
          : '0 8px 32px rgba(0, 0, 0, 0.08)',
        '&:hover': {
          transform: 'translateY(-8px) scale(1.02)',
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 20px 60px rgba(0, 0, 0, 0.6)'
            : '0 20px 60px rgba(0, 0, 0, 0.15)',
          '& .blog-card-image': {
            transform: 'scale(1.1)',
          },
          '& .blog-card-actions': {
            opacity: 1,
            transform: 'translateY(0)',
          }
        }, 
      }}
      onClick={handleCardClick}
    >
      {showImage && (
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          {post.imageUrl ? (
            <>
              <CardMedia
                component="img"
                height={imageHeight}
                image={post.imageUrl}
                alt={post.title}
                className="blog-card-image"
                sx={{
                  objectFit: 'cover',
                  backgroundColor: 'grey.200',
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(0.9)' : 'brightness(1)'
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.3))',
                  pointerEvents: 'none'
                }}
              />
            </>
          ) : (
            // Placeholder for posts without images
            <Box
              sx={{
                height: imageHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: (theme) => theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg,
                      ${alpha(theme.palette.primary.main, 0.15)} 0%,
                      ${alpha(theme.palette.secondary.main, 0.15)} 50%,
                      ${alpha(theme.palette.primary.main, 0.08)} 100%)`
                  : `linear-gradient(135deg,
                      ${alpha(theme.palette.primary.main, 0.08)} 0%,
                      ${alpha(theme.palette.secondary.main, 0.08)} 50%,
                      ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Article
                sx={{
                  fontSize: variant === 'compact' ? 24 : 32,
                  color: (theme) => alpha(theme.palette.text.secondary, 0.3),
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
                    : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.01) 100%)',
                  pointerEvents: 'none'
                }}
              />
            </Box>
          )}
        </Box>
      )}
      
      <CardContent sx={{
        flexGrow: 1,
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header with source and category */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1.5 }}>
          <Avatar
            src={post.source.logoUrl}
            sx={{
              width: 24,
              height: 24,
              fontSize: '0.75rem',
              border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            {post.source.name.charAt(0)}
          </Avatar>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 500, fontSize: '0.8rem' }}
          >
            {post.source.name}
          </Typography>
          <Chip
            label={post.category.replace('_', ' ').toUpperCase()}
            size="small"
            sx={{
              backgroundColor: getCategoryColor(post.category),
              color: 'white',
              fontSize: '0.65rem',
              height: 22,
              ml: 'auto',
              fontWeight: 600,
              letterSpacing: '0.5px',
              boxShadow: `0 2px 8px ${getCategoryColor(post.category)}40`
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="subtitle1"
          component="h3"
          sx={{
            fontWeight: 600,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: variant === 'compact' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.3
          }}
        >
          {post.title}
        </Typography>

        {/* Summary */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            flexGrow: 1,
            display: '-webkit-box',
            WebkitLineClamp: variant === 'compact' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4
          }}
        >
          {truncateText(post.summary, variant === 'compact' ? 100 : 150)}
        </Typography>

        {/* Tags */}
        {post.tags.length > 0 && variant !== 'compact' && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {post.tags.slice(0, 3).map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              ))}
              {post.tags.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{post.tags.length - 3} more
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {formatBlogDate(post.publishedAt)}
            </Typography>
          </Box>

          {/* Action buttons */}
          <Box
            className="blog-card-actions"
            sx={{
              display: 'flex',
              gap: 0.5,
              opacity: 0,
              transform: 'translateY(8px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Tooltip title="Open original article" arrow>
              <IconButton
                size="small"
                onClick={handleExternalLink}
                sx={{
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.primary.main,
                    color: 'white',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share" arrow>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onShare(post); }}
                sx={{
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.secondary.main,
                    color: 'white',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <Share fontSize="small" />
              </IconButton>
            </Tooltip>

          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BlogCard;
