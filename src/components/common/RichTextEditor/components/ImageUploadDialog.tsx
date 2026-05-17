import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  Button,
  TextField,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Link,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Search as SearchIcon,
  Link as LinkIcon,
  PhotoLibrary as LibraryIcon,
  Cached as CachedIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import Shimmer from '../../../Shimmer';
import { uploadFile, getPublicUrl, optimizeImage } from '../../../../services/supabaseStorageService';
import { supabase } from '../../../../config/supabase';
import { unsplashCache, UnsplashImage } from '../../../../services/unsplashCache';
import { FILE_SIZE_LIMITS, formatFileSize } from '../../../../utils/fileValidation';
import { scrollbarStyles } from '../../../../styles/scrollbarStyles';
import { Z_INDEX } from '../../../../styles/zIndex';
import { dialogProps } from '../../../../styles/dialogStyles';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImageInsert: (src: string, alt?: string) => void;
}

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

type TabKey = 'upload' | 'url' | 'unsplash';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'upload', label: 'Upload', icon: <UploadIcon sx={{ fontSize: 14 }} /> },
  { key: 'url', label: 'URL', icon: <LinkIcon sx={{ fontSize: 14 }} /> },
  { key: 'unsplash', label: 'Unsplash', icon: <LibraryIcon sx={{ fontSize: 14 }} /> },
];

const POPULAR_SEARCHES = [
  'trading charts',
  'business',
  'technology',
  'abstract',
  'nature',
  'minimal',
  'finance',
  'growth',
];

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
  open,
  onClose,
  onImageInsert,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImage[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
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
      fontSize: '0.68rem',
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: theme.palette.text.secondary,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.75,
    }),
    [theme.palette.text.secondary],
  );

  const optionalSx = useMemo(
    () => ({
      fontFamily: MONO_FONT,
      fontSize: '0.66rem',
      fontWeight: 500,
      letterSpacing: '0.08em',
      color: alpha(theme.palette.text.secondary, 0.7),
      textTransform: 'none' as const,
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

  const resetState = useCallback(() => {
    setImageUrl('');
    setAltText('');
    setError(null);
    setPreviewUrl(null);
    setUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (uploading) return;
    resetState();
    onClose();
  }, [uploading, resetState, onClose]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > FILE_SIZE_LIMITS.IMAGE_1MB) {
      setError(`File size (${formatFileSize(file.size)}) exceeds the 1MB limit`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setError(null);

    try {
      setUploading(true);
      const optimizedFile = await optimizeImage(file, 1920, 1080, 0.85);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Please sign in to upload images');

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `users/${user.id}/note-images/${filename}`;

      const { error: uploadError } = await uploadFile('trade-images', filePath, optimizedFile, {
        contentType: optimizedFile.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const publicUrl = getPublicUrl('trade-images', filePath);
      onImageInsert(publicUrl, altText || file.name);
      resetState();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleUrlInsert = () => {
    if (!imageUrl.trim()) {
      setError('Please enter an image URL');
      return;
    }
    try {
      new URL(imageUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }
    onImageInsert(imageUrl.trim(), altText);
    resetState();
    onClose();
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFileSelect(file);
          return;
        }
      }
    }
  };

  const handleSearchUnsplash = async (query: string = searchQuery) => {
    if (!query.trim()) return;

    setUnsplashLoading(true);
    setIsFromCache(false);
    setError(null);

    try {
      const cachedImages = unsplashCache.getCachedImages(query);
      if (cachedImages) {
        setUnsplashImages(cachedImages);
        setIsFromCache(true);
        setUnsplashLoading(false);
        return;
      }

      if (!UNSPLASH_ACCESS_KEY) {
        setError('Unsplash API key not configured');
        setUnsplashLoading(false);
        return;
      }

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } },
      );

      if (response.ok) {
        const data = await response.json();
        setUnsplashImages(data.results);
        unsplashCache.cacheImages(query, data.results);
      } else {
        setError('Failed to fetch images from Unsplash');
      }
    } catch (_err) {
      setError('Error fetching images');
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleUnsplashImageSelect = async (image: UnsplashImage) => {
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        });
      } catch {
        /* silent fail for download tracking */
      }
    }

    const url = `${image.urls.regular}&w=800`;
    onImageInsert(url, image.alt_description || `Photo by ${image.user.name}`);
    resetState();
    onClose();
  };

  const handlePopularSearchClick = (search: string) => {
    setSearchQuery(search);
    handleSearchUnsplash(search);
  };

  useEffect(() => {
    if (open && activeTab === 'unsplash' && unsplashImages.length === 0) {
      setSearchQuery('abstract');
      handleSearchUnsplash('abstract');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

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
    transition: 'all 120ms ease',
    backgroundColor: selected ? violetSoft : surfaceInset,
    color: selected ? violet : theme.palette.text.primary,
    border: `1px solid ${selected ? violetBorder : hairline}`,
    '&:hover': {
      backgroundColor: selected ? violetSoft : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
    },
  });

  const renderTabs = () => (
    <Box
      sx={{
        display: 'inline-flex',
        p: 0.375,
        borderRadius: 999,
        backgroundColor: surfaceInset,
        border: `1px solid ${hairline}`,
        gap: 0.25,
        alignSelf: 'flex-start',
      }}
    >
      {TABS.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <Box
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError(null);
            }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.625,
              px: 1.5,
              py: 0.625,
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              userSelect: 'none' as const,
              transition: 'all 140ms ease',
              backgroundColor: selected ? violet : 'transparent',
              color: selected ? '#fff' : theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: selected ? violet : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                color: selected ? '#fff' : theme.palette.text.primary,
              },
            }}
          >
            {tab.icon}
            {tab.label}
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.RICH_TEXT_DIALOG }}
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
            Insert image
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}>
            Drop a file, paste a URL, or pick from Unsplash
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: theme.palette.text.secondary }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        onPaste={handlePaste}
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
        {renderTabs()}

        {/* Upload */}
        {activeTab === 'upload' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              sx={{
                position: 'relative',
                minHeight: 200,
                borderRadius: 1.5,
                border: `1px dashed ${
                  dragOver ? violet : alpha(violet, isDark ? 0.45 : 0.35)
                }`,
                backgroundColor: dragOver ? violetSoft : violetSofter,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                p: 2,
                color: violet,
                cursor: uploading ? 'default' : 'pointer',
                transition: 'background-color 150ms ease, border-color 150ms ease',
                '&:hover': uploading
                  ? undefined
                  : { backgroundColor: violetSoft, borderColor: violetBorder },
                '&:focus-visible': {
                  outline: `2px solid ${violet}`,
                  outlineOffset: 2,
                },
              }}
            >
              {previewUrl ? (
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      borderRadius: 1.25,
                      border: `1px solid ${hairline}`,
                      opacity: uploading ? 0.6 : 1,
                    }}
                  />
                  {uploading && (
                    <Box sx={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <LinearProgress
                        sx={{
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: alpha(violet, 0.15),
                          '& .MuiLinearProgress-bar': { backgroundColor: violet },
                        }}
                      />
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontSize: '0.7rem',
                          color: theme.palette.text.secondary,
                          textAlign: 'center',
                          letterSpacing: '0.08em',
                        }}
                      >
                        UPLOADING…
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <>
                  <UploadIcon sx={{ fontSize: 28 }} />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    Drop an image or click to browse
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.7rem',
                      color: alpha(theme.palette.text.secondary, 0.85),
                      letterSpacing: '0.04em',
                    }}
                  >
                    JPG · PNG · GIF · WebP · max 1MB · paste also works
                  </Typography>
                </>
              )}
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Alt text
                <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>· Optional</Box>
              </Typography>
              <TextField
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility"
                fullWidth
                size="small"
                disabled={uploading}
                sx={inputSx}
              />
            </Box>
          </Box>
        )}

        {/* URL */}
        {activeTab === 'url' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Image URL
                <Box component="span" sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}>*</Box>
              </Typography>
              <TextField
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com/image.jpg"
                fullWidth
                size="small"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && imageUrl.trim()) handleUrlInsert();
                }}
                sx={inputSx}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Alt text
                <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>· Optional</Box>
              </Typography>
              <TextField
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility"
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Box>

            {imageUrl && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `1px solid ${hairline}`,
                  backgroundColor: surfaceInset,
                }}
              >
                <Typography sx={monoLabelSx}>Preview</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box
                    component="img"
                    src={imageUrl}
                    alt="Preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 220,
                      borderRadius: 1.25,
                      border: `1px solid ${hairline}`,
                    }}
                    onError={() => setError('Failed to load image from URL')}
                  />
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Unsplash */}
        {activeTab === 'unsplash' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUnsplash()}
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
                onClick={() => handleSearchUnsplash()}
                disabled={unsplashLoading || !searchQuery.trim()}
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
                {unsplashLoading ? <CircularProgress size={16} thickness={5} color="inherit" /> : 'Search'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ ...monoLabelSx, fontSize: '0.62rem' }}>Popular searches</Typography>
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
                {POPULAR_SEARCHES.map((search) => {
                  const selected = searchQuery.toLowerCase() === search.toLowerCase();
                  const isCached = unsplashCache.isCached(search);
                  return (
                    <Box
                      key={search}
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

            <Box
              sx={{
                borderRadius: 1.5,
                border: `1px solid ${hairline}`,
                backgroundColor: surfaceInset,
                p: 1.25,
                minHeight: 340,
                maxHeight: 340,
                overflowY: 'auto',
                overflowX: 'hidden',
                ...scrollbarStyles(theme),
              }}
            >
              {!unsplashLoading && unsplashImages.length === 0 ? (
                <Box
                  sx={{
                    height: '100%',
                    minHeight: 316,
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 1.25,
                  }}
                >
                  {unsplashLoading
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <Shimmer key={i} height={110} borderRadius={10} variant="wave" intensity="medium" />
                      ))
                    : unsplashImages.map((image) => (
                        <Box
                          key={image.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleUnsplashImageSelect(image)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleUnsplashImageSelect(image);
                            }
                          }}
                          sx={{
                            position: 'relative',
                            height: 110,
                            borderRadius: 1.25,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: `1px solid ${hairline}`,
                            backgroundColor: theme.palette.background.default,
                            backgroundImage: `url(${image.urls.small})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                            '& .picker-overlay': { opacity: 0, transition: 'opacity 160ms ease' },
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              borderColor: violetBorder,
                              boxShadow: `0 6px 18px ${alpha(violet, isDark ? 0.35 : 0.2)}`,
                              '& .picker-overlay': { opacity: 1 },
                            },
                            '&:focus-visible': {
                              outline: `2px solid ${violet}`,
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Box
                            className="picker-overlay"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: `linear-gradient(180deg, ${alpha(violet, 0.15)} 0%, ${alpha(theme.palette.common.black, 0.55)} 100%)`,
                            }}
                          >
                            <Box
                              sx={{
                                px: 1,
                                py: 0.375,
                                borderRadius: 999,
                                backgroundColor: '#fff',
                                color: violet,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                              }}
                            >
                              Select
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              px: 0.75,
                              py: 0.375,
                              background: `linear-gradient(transparent, ${alpha(theme.palette.common.black, 0.7)})`,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '0.62rem',
                                fontWeight: 500,
                                color: '#fff',
                                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              by {image.user.name}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.875,
              borderRadius: 1.25,
              border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
              backgroundColor: alpha(theme.palette.error.main, 0.08),
            }}
          >
            <Typography sx={{ fontSize: '0.82rem', color: theme.palette.error.main, fontWeight: 500 }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2.5,
          py: 1.5,
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
          {activeTab === 'unsplash' ? (
            <>
              <Box component="span" sx={{ fontSize: '0.9rem' }}>📷</Box>
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
                  '&:hover': { borderBottomColor: violet },
                }}
              >
                Unsplash
              </Link>
            </>
          ) : (
            <Box component="span" sx={{ fontFamily: MONO_FONT, fontSize: '0.7rem', letterSpacing: '0.04em' }}>
              {activeTab === 'upload' ? 'Drop · click · paste' : 'Direct URL — make sure hotlinking is allowed'}
            </Box>
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={uploading}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: theme.palette.text.secondary,
              '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
            }}
          >
            Cancel
          </Button>
          {activeTab === 'url' && (
            <Button
              onClick={handleUrlInsert}
              disabled={!imageUrl.trim()}
              variant="contained"
              endIcon={<ArrowIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: violet,
                color: '#fff',
                borderRadius: 1.25,
                px: 1.75,
                py: 0.75,
                boxShadow: 'none',
                '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
                '&.Mui-disabled': {
                  backgroundColor: alpha(violet, 0.35),
                  color: alpha('#fff', 0.7),
                },
              }}
            >
              Insert image
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default ImageUploadDialog;
