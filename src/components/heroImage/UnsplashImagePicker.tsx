/**
 * UnsplashImagePicker
 *
 * Headless-ish content block that renders the search row, popular searches,
 * and results grid for picking an Unsplash image. No Dialog shell, no header —
 * intended to be embedded inside a parent dialog (cover-image picker, rich-text
 * image uploader, etc.).
 *
 * The parent decides what to do with the selected image (resize, attribute,
 * commit) — this component just hands back the raw `UnsplashImage` after
 * triggering the Unsplash download-tracking endpoint per their guidelines.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Cached as CachedIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import Shimmer from '../Shimmer';
import { unsplashCache, UnsplashImage } from '../../services/unsplashCache';
import { logger } from '../../utils/logger';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const DEFAULT_POPULAR_SEARCHES = [
  'trading charts',
  'financial markets',
  'business success',
  'growth analytics',
  'stock market',
  'cryptocurrency',
  'investment',
  'profit growth',
];

export interface UnsplashImagePickerProps {
  /** Fired when the user picks an image. Parent builds the final URL. */
  onImageSelect: (image: UnsplashImage) => void;
  /** Initial query searched on mount. Default: 'trading charts'. */
  defaultQuery?: string;
  /** Chip-row queries shown above the grid. */
  popularSearches?: string[];
  /** Height of the scrollable results panel, in px. Default 420. */
  resultsHeight?: number;
  /** Grid tile height in px. Default 130. */
  tileHeight?: number;
  /** Show a small clear-cache action to the right of the popular searches label. */
  showClearCache?: boolean;
  /** Show the cache stats line below the results header (e.g. "12 cached · 88.4KB"). */
  showCacheStats?: boolean;
  /** Number of grid columns at each breakpoint. Default { xs:2, sm:3, md:4 }. */
  columns?: { xs?: number; sm?: number; md?: number; lg?: number };
  /** Number of shimmer placeholders shown while loading. Default 16. */
  loadingPlaceholders?: number;
  /** Provide a placeholder generator for environments without an Unsplash key. */
  fallbackPlaceholders?: (query: string) => UnsplashImage[];
}

const defaultFallback = (query: string): UnsplashImage[] => {
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

const UnsplashImagePicker: React.FC<UnsplashImagePickerProps> = ({
  onImageSelect,
  defaultQuery = 'trading charts',
  popularSearches = DEFAULT_POPULAR_SEARCHES,
  resultsHeight = 420,
  tileHeight = 130,
  showClearCache = false,
  showCacheStats = false,
  columns,
  loadingPlaceholders = 16,
  fallbackPlaceholders = defaultFallback,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
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

  const inputSx = useMemo(
    () => ({
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
    }),
    [surfaceInset, hairline, violet],
  );

  const enhancedQueries = useMemo(() => {
    const recent = unsplashCache.getPopularQueries(3);
    const combined = [...recent];
    popularSearches.forEach((q) => {
      if (!combined.some((r) => r.toLowerCase() === q.toLowerCase())) combined.push(q);
    });
    return combined.slice(0, 8);
  }, [popularSearches]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setLoading(true);
      setIsFromCache(false);

      try {
        const cachedImages = unsplashCache.getCachedImages(query);
        if (cachedImages) {
          setImages(cachedImages);
          setIsFromCache(true);
          setLoading(false);
          return;
        }

        if (!UNSPLASH_ACCESS_KEY) {
          logger.warn('Unsplash API key not configured, using placeholder images');
          const placeholders = fallbackPlaceholders(query);
          setImages(placeholders);
          unsplashCache.cacheImages(query, placeholders);
          setLoading(false);
          return;
        }

        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } },
        );

        if (response.ok) {
          const data = await response.json();
          setImages(data.results);
          unsplashCache.cacheImages(query, data.results);
        } else {
          logger.error('Failed to fetch images from Unsplash');
          const placeholders = fallbackPlaceholders(query);
          setImages(placeholders);
          unsplashCache.cacheImages(query, placeholders);
        }
      } catch (error) {
        logger.error('Error fetching Unsplash images:', error);
        const placeholders = fallbackPlaceholders(query);
        setImages(placeholders);
        unsplashCache.cacheImages(query, placeholders);
      } finally {
        setLoading(false);
      }
    },
    [UNSPLASH_ACCESS_KEY, fallbackPlaceholders],
  );

  const handlePopularSearchClick = (q: string) => {
    setSearchQuery(q);
    handleSearch(q);
  };

  const handleImageClick = async (image: UnsplashImage) => {
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        });
      } catch (error) {
        logger.error('Error triggering Unsplash download endpoint:', error);
      }
    }
    onImageSelect(image);
  };

  // Boot: clear expired cache, then run initial search if we have nothing yet.
  useEffect(() => {
    const removedCount = unsplashCache.removeExpiredEntries();
    if (removedCount > 0) logger.log(`Removed ${removedCount} expired cache entries`);
    handleSearch(defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const cols = {
    xs: columns?.xs ?? 2,
    sm: columns?.sm ?? 3,
    md: columns?.md ?? 4,
    lg: columns?.lg,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          placeholder="Search Unsplash…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
          slotProps={{
            input: {
              startAdornment: (
                <SearchIcon
                  sx={{ mr: 1.25, fontSize: 18, color: theme.palette.text.secondary }}
                />
              ),
            },
          }}
          sx={inputSx}
        />
        <Button
          onClick={() => handleSearch(searchQuery)}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
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
            {showClearCache && cacheStats.totalEntries > 0 && (
              <Button
                size="small"
                onClick={() => {
                  unsplashCache.clearCache();
                  setImages([]);
                  setIsFromCache(false);
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.error.main, 0.08),
                    color: theme.palette.error.main,
                  },
                }}
              >
                Clear cache
              </Button>
            )}
          </Box>
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
          {showCacheStats && (
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.65rem',
                color: alpha(theme.palette.text.secondary, 0.75),
              }}
            >
              {cacheStats.totalEntries} cached · {(cacheStats.totalSize / 1024).toFixed(1)}KB
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            borderRadius: 1.5,
            border: `1px solid ${hairline}`,
            backgroundColor: surfaceInset,
            p: 1.25,
            minHeight: resultsHeight,
            maxHeight: resultsHeight,
            overflowY: 'auto',
            overflowX: 'hidden',
            ...scrollbarStyles(theme),
          }}
        >
          {!loading && images.length === 0 ? (
            <Box
              sx={{
                height: '100%',
                minHeight: resultsHeight - 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
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
                  xs: `repeat(${cols.xs}, 1fr)`,
                  sm: `repeat(${cols.sm}, 1fr)`,
                  md: `repeat(${cols.md}, 1fr)`,
                  ...(cols.lg ? { lg: `repeat(${cols.lg}, 1fr)` } : {}),
                },
                gap: 1.25,
              }}
            >
              {loading
                ? Array.from({ length: loadingPlaceholders }).map((_, index) => (
                    <Shimmer
                      key={index}
                      height={tileHeight}
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
                        height: tileHeight,
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
                          borderColor: violetBorder
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
  );
};

export default UnsplashImagePicker;
export type { UnsplashImage };
