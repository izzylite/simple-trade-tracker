import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  IconButton,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Card,
  CardMedia,
  CardActionArea,
  useTheme,
  Link,
  Chip,
  DialogTitle
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Cached as CachedIcon
} from '@mui/icons-material';
import Shimmer from '../Shimmer';
import { unsplashCache, UnsplashImage } from '../../services/unsplashCache';
import { logger } from '../../utils/logger';
import { getDialogProps } from '../../utils/dialogUtils';
import { scrollbarStyles } from '../../styles/scrollbarStyles';



export interface ImageAttribution {
  id: string;
  photographer: string;
  photographerUsername: string;
  photographerUrl: string;
  unsplashUrl: string;
  altDescription: string;
}

interface ImagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string, attribution?: ImageAttribution) => void;
  title?: string;
}

const ImagePickerDialog: React.FC<ImagePickerDialogProps> = ({
  open,
  onClose,
  onImageSelect,
  title = "Choose a cover image"
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const dialogBaseProps = getDialogProps(theme);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const popularSearches = [
    'trading charts',
    'financial markets',
    'business success',
    'growth analytics',
    'stock market',
    'cryptocurrency',
    'investment',
    'profit growth'
  ];

  // Get recently searched queries from cache
  const getEnhancedPopularSearches = () => {
    const recentQueries = unsplashCache.getPopularQueries(3);
    const defaultSearches = popularSearches;

    // Combine recent queries with default ones, avoiding duplicates
    const combined = [...recentQueries];
    defaultSearches.forEach(search => {
      if (!combined.some(query => query.toLowerCase() === search.toLowerCase())) {
        combined.push(search);
      }
    });

    return combined.slice(0, 8); // Limit to 8 total suggestions
  };

  const generatePlaceholderImages = (query: string): UnsplashImage[] => {
    const categories = ['trading', 'finance', 'business', 'charts', 'success', 'growth'];
    const selectedCategory = categories.find(cat => query.toLowerCase().includes(cat)) || 'business';

    return Array.from({ length: 24 }, (_, i) => ({
      id: `placeholder-${i}`,
      urls: {
        small: `https://picsum.photos/400/200?random=${i}&blur=1`,
        regular: `https://picsum.photos/800/400?random=${i}`,
        full: `https://picsum.photos/1200/600?random=${i}`
      },
      links: {
        download_location: '',
        html: ''
      },
      alt_description: `${selectedCategory} image ${i + 1}`,
      user: {
        name: 'Demo User',
        username: 'demo_user',
        links: {
          html: ''
        }
      }
    }));
  };

  const handleSearchImages = async (query: string = searchQuery) => {
    if (!query.trim()) return;

    setLoading(true);
    setIsFromCache(false);

    try {
      // Check cache first
      const cachedImages = unsplashCache.getCachedImages(query);
      if (cachedImages) {
        logger.log(`Loading ${cachedImages.length} images from cache for query: "${query}"`);
        setImages(cachedImages);
        setIsFromCache(true);
        setLoading(false);
        return;
      }

      if (!UNSPLASH_ACCESS_KEY) {
        logger.warn('Unsplash API key not configured, using placeholder images');
        const placeholderImages = generatePlaceholderImages(query);
        setImages(placeholderImages);
        // Cache placeholder images too
        unsplashCache.cacheImages(query, placeholderImages);
        setLoading(false);
        return;
      }

      logger.log(`Fetching images from Unsplash API for query: "${query}"`);
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setImages(data.results);
        // Cache the results
        unsplashCache.cacheImages(query, data.results);
        logger.log(`Cached ${data.results.length} images for query: "${query}"`);
      } else {
        logger.error('Failed to fetch images from Unsplash');
        const placeholderImages = generatePlaceholderImages(query);
        setImages(placeholderImages);
        // Cache placeholder images as fallback
        unsplashCache.cacheImages(query, placeholderImages);
      }
    } catch (error) {
      logger.error('Error fetching images:', error);
      const placeholderImages = generatePlaceholderImages(query);
      setImages(placeholderImages);
      // Cache placeholder images as fallback
      unsplashCache.cacheImages(query, placeholderImages);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (image: UnsplashImage) => {
    // Trigger download endpoint as required by Unsplash guidelines
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        });
      } catch (error) {
        logger.error('Error triggering download endpoint:', error);
      }
    }

    // Pass the image data including attribution info - use full size with quality parameters for better quality
    const highQualityUrl = `${image.urls.full}&q=85&fm=jpg&fit=crop&w=1200&h=600`;
    onImageSelect(highQualityUrl, {
      id: image.id,
      photographer: image.user.name,
      photographerUsername: image.user.username,
      photographerUrl: `${image.user.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      unsplashUrl: `${image.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      altDescription: image.alt_description
    });
    onClose();
  };

  const handlePopularSearchClick = (search: string) => {
    setSearchQuery(search);
    handleSearchImages(search);
  };

  // Load default images when dialog opens and clean up expired cache
  React.useEffect(() => {
    if (open) {
      // Clean up expired cache entries
      const removedCount = unsplashCache.removeExpiredEntries();
      if (removedCount > 0) {
        logger.log(`Removed ${removedCount} expired cache entries`);
      }

      // Load default images if none are loaded
      if (images.length === 0) {
        setSearchQuery('trading charts');
        handleSearchImages('trading charts');
      }
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      {...dialogBaseProps}
      sx={{
        ...(dialogBaseProps.sx || {}),
        zIndex: (theme) => theme.zIndex.modal + 200, // Ensure it's above the AIChatDrawer
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Choose a clean cover image from curated Unsplash photos
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              color: 'error.main',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, px: 2.5 }}>
        {/* Search */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            mt: 1,
            mb: 2,
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' }
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search for trading charts, financial markets, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchImages()}
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ mr: 1.5, color: 'primary.main' }} />,
                sx: {
                  borderRadius: 1
                }
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1
              },
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          />
          <Button
            variant="contained"
            onClick={() => handleSearchImages()}
            disabled={loading}
            sx={{
              minWidth: 120,
              borderRadius: 1,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              '&:hover': {
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                transform: 'translateY(-1px)',
                boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
              }
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
          </Button>
        </Box>

        {/* Cache status indicator */}
        {isFromCache && (
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<CachedIcon />}
              label="Loaded from cache"
              size="small"
              color="success"
              variant="outlined"
              sx={{
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': {
                  fontSize: '0.9rem'
                }
              }}
            />
          </Box>
        )}

        {/* Popular searches */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{
            color: 'text.primary',
            mb: 1.5,
            display: 'block',
            fontWeight: 600
          }}>
            ✨ Popular searches
          </Typography>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1
          }}>
            {getEnhancedPopularSearches().map((search, index) => {
              const isRecentQuery = unsplashCache.isCached(search);
              return (
                <Button
                  key={`${search}-${index}`}
                  size="small"
                  variant="outlined"
                  onClick={() => handlePopularSearchClick(search)}
                  startIcon={isRecentQuery ? <CachedIcon sx={{ fontSize: '0.8rem' }} /> : undefined}
                  sx={{
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    borderRadius: 1,
                    minWidth: 'auto',
                    px: 2,
                    py: 0.5,
                    borderColor: isRecentQuery ? 'success.main' : 'divider',
                    color: isRecentQuery ? 'success.main' : 'text.primary',
                    background: (theme) => isRecentQuery
                      ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.success.light, 0.05)} 100%)`
                      : theme.palette.mode === 'dark'
                        ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`
                        : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                    '&:hover': {
                      borderColor: isRecentQuery ? 'success.main' : 'primary.main',
                      color: isRecentQuery ? 'success.main' : 'primary.main',
                      background: (theme) => isRecentQuery
                        ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.light, 0.1)} 100%)`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 0%, ${alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 100%)`,
                      transform: 'translateY(-1px)',
                      boxShadow: (theme) => `0 2px 8px ${alpha(isRecentQuery ? theme.palette.success.main : theme.palette.primary.main, 0.25)}`
                    }
                  }}
                >
                  {search}
                </Button>
              );
            })}
          </Box>
        </Box>

        {/* Cache Management */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {(() => {
              const stats = unsplashCache.getCacheStats();
              return `${stats.totalEntries} cached searches • ${(stats.totalSize / 1024).toFixed(1)}KB`;
            })()}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              unsplashCache.clearCache();
              setImages([]);
              setIsFromCache(false);
            }}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': {
                color: 'error.main'
              }
            }}
          >
            Clear cache
          </Button>
        </Box>

        {/* Images Grid */}
        <Box
          sx={{
            maxHeight: 380,
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.9)
                : alpha(theme.palette.background.default, 0.9),
            p: 1.5,
            ...scrollbarStyles(theme)
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)'
                },
                gap: 1.5
              }}
            >
              {Array.from({ length: 20 }).map((_, index) => (
                <Shimmer
                  key={index}
                  height={140}
                  borderRadius={1}
                  variant="wave"
                  intensity="medium"
                />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)'
                },
                gap: 1.5
              }}
            >
              {images.map((image) => (
                <Card
                  key={image.id}
                  sx={{
                    borderRadius: 1,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.7),
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                      borderColor: theme.palette.primary.main,
                      '& .image-overlay': {
                        opacity: 1
                      }
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => handleImageClick(image)}
                    sx={{
                      position: 'relative',
                      '&:hover .MuiCardActionArea-focusHighlight': {
                        opacity: 0
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="120"
                      image={image.urls.small}
                      alt={image.alt_description || 'Cover image'}
                      sx={{
                        objectFit: 'cover'
                      }}
                    />

                    {/* Hover overlay */}
                    <Box
                      className="image-overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: alpha(theme.palette.common.black, 0.4),
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'common.white'
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Select Image
                      </Typography>
                    </Box>

                    {/* Attribution overlay - only show for real Unsplash images */}
                    {image.user.username !== 'demo_user' && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          color: 'white',
                          p: 1,
                          fontSize: '0.7rem'
                        }}
                      >
                        <Typography variant="caption" sx={{
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}>
                          📸 {image.user.name}
                        </Typography>
                      </Box>
                    )}
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Unsplash Attribution Footer */}
        <Box sx={{
          mt: 3,
          pt: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.primary.light, 0.02)} 100%)`,
          borderRadius: 1,
          mx: -1,
          px: 2
        }}>
          <Typography variant="body2" sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}>
            <Box component="span" sx={{ fontSize: '1.2rem' }}>📷</Box>
            <Link
              href="https://unsplash.com/?utm_source=trade-tracker&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 600,
                borderBottom: '1px solid transparent',
                transition: 'border-color 0.2s ease',
                '&:hover': {
                  borderBottomColor: 'primary.main'
                }
              }}
            >
              Photo by Unsplash
            </Link>
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ImagePickerDialog;
