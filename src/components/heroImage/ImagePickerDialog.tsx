import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Link,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Cached as CachedIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import Shimmer from '../Shimmer';
import { unsplashCache, UnsplashImage } from '../../services/unsplashCache';
import { logger } from '../../utils/logger';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { dialogProps } from '../../styles/dialogStyles';
import { Z_INDEX } from '../../styles/zIndex';

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

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const DEFAULT_QUERIES = [
  'trading charts',
  'financial markets',
  'business success',
  'growth analytics',
  'stock market',
  'cryptocurrency',
  'investment',
  'profit growth',
];

const ImagePickerDialog: React.FC<ImagePickerDialogProps> = ({
  open,
  onClose,
  onImageSelect,
  title = 'Choose a cover image',
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetSofter = alpha(violet, isDark ? 0.12 : 0.1);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const monoLabelSx = useMemo(
    () => ({
      fontFamily: MONO_FONT,
      fontSize: '0.62rem',
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: alpha(theme.palette.text.secondary, 0.85),
    }),
    [theme.palette.text.secondary],
  );

  const enhancedQueries = useMemo(() => {
    const recent = unsplashCache.getPopularQueries(3);
    const combined = [...recent];
    DEFAULT_QUERIES.forEach((q) => {
      if (!combined.some((r) => r.toLowerCase() === q.toLowerCase())) combined.push(q);
    });
    return combined.slice(0, 8);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const generatePlaceholderImages = (query: string): UnsplashImage[] => {
    const categories = ['trading', 'finance', 'business', 'charts', 'success', 'growth'];
    const selectedCategory =
      categories.find((cat) => query.toLowerCase().includes(cat)) || 'business';

    return Array.from({ length: 24 }, (_, i) => ({
      id: `placeholder-${i}`,
      urls: {
        small: `https://picsum.photos/400/200?random=${i}&blur=1`,
        regular: `https://picsum.photos/800/400?random=${i}`,
        full: `https://picsum.photos/1200/600?random=${i}`,
      },
      links: { download_location: '', html: '' },
      alt_description: `${selectedCategory} image ${i + 1}`,
      user: {
        name: 'Demo User',
        username: 'demo_user',
        links: { html: '' },
      },
    }));
  };

  const handleSearchImages = async (query: string = searchQuery) => {
    if (!query.trim()) return;

    setLoading(true);
    setIsFromCache(false);

    try {
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
        unsplashCache.cacheImages(query, placeholderImages);
        setLoading(false);
        return;
      }

      logger.log(`Fetching images from Unsplash API for query: "${query}"`);
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`,
        {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setImages(data.results);
        unsplashCache.cacheImages(query, data.results);
        logger.log(`Cached ${data.results.length} images for query: "${query}"`);
      } else {
        logger.error('Failed to fetch images from Unsplash');
        const placeholderImages = generatePlaceholderImages(query);
        setImages(placeholderImages);
        unsplashCache.cacheImages(query, placeholderImages);
      }
    } catch (error) {
      logger.error('Error fetching images:', error);
      const placeholderImages = generatePlaceholderImages(query);
      setImages(placeholderImages);
      unsplashCache.cacheImages(query, placeholderImages);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (image: UnsplashImage) => {
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        });
      } catch (error) {
        logger.error('Error triggering download endpoint:', error);
      }
    }

    const highQualityUrl = `${image.urls.full}&q=85&fm=jpg&fit=crop&w=1200&h=600`;
    onImageSelect(highQualityUrl, {
      id: image.id,
      photographer: image.user.name,
      photographerUsername: image.user.username,
      photographerUrl: `${image.user.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      unsplashUrl: `${image.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      altDescription: image.alt_description,
    });
    onClose();
  };

  const handlePopularSearchClick = (search: string) => {
    setSearchQuery(search);
    handleSearchImages(search);
  };

  useEffect(() => {
    if (!open) return;
    const removedCount = unsplashCache.removeExpiredEntries();
    if (removedCount > 0) logger.log(`Removed ${removedCount} expired cache entries`);

    if (images.length === 0) {
      setSearchQuery('trading charts');
      handleSearchImages('trading charts');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cacheStats = unsplashCache.getCacheStats();

  const chipStyle = (selected: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1.25,
    py: 0.5,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    userSelect: 'none' as const,
    fontFamily: 'inherit',
    transition: 'all 120ms ease',
    backgroundColor: selected ? violetSoft : surfaceInset,
    color: selected ? violet : theme.palette.text.primary,
    border: `1px solid ${selected ? violetBorder : hairline}`,
    '&:hover': {
      backgroundColor: selected
        ? violetSoft
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG + 200 }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: `1px solid ${hairline}`,
            boxShadow: theme.shadows[10],
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${hairline}`,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: violetSoft,
            color: violet,
            border: `1px solid ${violetBorder}`,
            flexShrink: 0,
          }}
        >
          <ImageIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography
            sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}
          >
            Curated landscape photography from Unsplash
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          ...scrollbarStyles(theme),
          overflowY: 'auto',
          maxHeight: '75vh',
        }}
      >
        {/* Search row */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'stretch',
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search trading, markets, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchImages()}
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon
                    sx={{ mr: 1.25, fontSize: 18, color: theme.palette.text.secondary }}
                  />
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                backgroundColor: surfaceInset,
                '& fieldset': { borderColor: hairline },
                '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
                '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
              },
              '& .MuiOutlinedInput-input': {
                py: 1.1,
                fontSize: '0.88rem',
                fontWeight: 500,
              },
            }}
          />
          <Button
            onClick={() => handleSearchImages()}
            disabled={loading || !searchQuery.trim()}
            variant="contained"
            sx={{
              minWidth: 110,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              backgroundColor: violet,
              color: '#fff',
              borderRadius: 1.25,
              boxShadow: 'none',
              '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
              '&.Mui-disabled': {
                backgroundColor: alpha(violet, 0.35),
                color: alpha('#fff', 0.7),
              },
            }}
          >
            {loading ? <CircularProgress size={16} thickness={5} color="inherit" /> : 'Search'}
          </Button>
        </Box>

        {/* Popular searches */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography sx={monoLabelSx}>Popular searches</Typography>
            {isFromCache && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.875,
                  py: 0.25,
                  borderRadius: 999,
                  backgroundColor: surfaceInset,
                  border: `1px solid ${hairline}`,
                  fontFamily: MONO_FONT,
                  fontSize: '0.65rem',
                  color: theme.palette.text.secondary,
                }}
              >
                <CachedIcon sx={{ fontSize: 12 }} />
                cached
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {enhancedQueries.map((search, index) => {
              const isCached = unsplashCache.isCached(search);
              const selected = searchQuery.toLowerCase() === search.toLowerCase();
              return (
                <Box
                  key={`${search}-${index}`}
                  onClick={() => handlePopularSearchClick(search)}
                  sx={chipStyle(selected)}
                >
                  {isCached && <CachedIcon sx={{ fontSize: 12, opacity: 0.7 }} />}
                  {search}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Results */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography sx={monoLabelSx}>
              Results {!loading && images.length > 0 && `· ${images.length}`}
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.65rem',
                color: alpha(theme.palette.text.secondary, 0.75),
              }}
            >
              {cacheStats.totalEntries} cached · {(cacheStats.totalSize / 1024).toFixed(1)}KB
            </Typography>
          </Box>

          <Box
            sx={{
              borderRadius: 1.5,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
              p: 1.25,
              minHeight: 420,
              maxHeight: 420,
              overflowY: 'auto',
              overflowX: 'hidden',
              ...scrollbarStyles(theme),
            }}
          >
            {!loading && images.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  minHeight: 396,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  color: alpha(theme.palette.text.secondary, 0.7),
                }}
              >
                <ImageIcon sx={{ fontSize: 28, color: alpha(violet, 0.45) }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: theme.palette.text.secondary }}>
                  No images yet
                </Typography>
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.7rem',
                    color: alpha(theme.palette.text.secondary, 0.7),
                  }}
                >
                  Search or pick a popular query above
                </Typography>
              </Box>
            ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                },
                gap: 1.25,
              }}
            >
              {loading
                ? Array.from({ length: 16 }).map((_, index) => (
                    <Shimmer
                      key={index}
                      height={130}
                      borderRadius={2}
                      variant="wave"
                      intensity="medium"
                    />
                  ))
                : images.map((image) => (
                    <Box
                      key={image.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleImageClick(image)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleImageClick(image);
                        }
                      }}
                      sx={{
                        position: 'relative',
                        height: 130,
                        borderRadius: 1.25,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: `1px solid ${hairline}`,
                        backgroundColor: theme.palette.background.default,
                        backgroundImage: `url(${image.urls.small})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: violetBorder, 
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${violet}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      
                      {image.user.username !== 'demo_user' && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            px: 0.75,
                            py: 0.5,
                            background: `linear-gradient(transparent, ${alpha(theme.palette.common.black, 0.7)})`,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 500,
                              color: '#fff',
                              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📸 {image.user.name}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
            </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2.5,
          py: 1.25,
          borderTop: `1px solid ${hairline}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : alpha(theme.palette.text.primary, 0.02),
        }}
      >
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: theme.palette.text.secondary,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <Box component="span" sx={{ fontSize: '0.9rem' }}>
            📷
          </Box>
          Photos by{' '}
          <Link
            href="https://unsplash.com/?utm_source=trade-tracker&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: violet,
              fontWeight: 600,
              textDecoration: 'none',
              borderBottom: `1px solid ${alpha(violet, 0.3)}`,
              transition: 'border-color 150ms ease',
              '&:hover': { borderBottomColor: violet },
            }}
          >
            Unsplash
          </Link>
        </Typography>
        <Button
          size="small"
          onClick={() => {
            unsplashCache.clearCache();
            setImages([]);
            setIsFromCache(false);
          }}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.error.main, 0.08),
              color: theme.palette.error.main,
            },
          }}
        >
          Clear cache
        </Button>
      </Box>
    </Dialog>
  );
};

export default ImagePickerDialog;
