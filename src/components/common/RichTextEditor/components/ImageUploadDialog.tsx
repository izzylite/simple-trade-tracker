import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Card,
  CardMedia,
  CardActionArea,
  Link,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import RoundedTabs, { TabPanel } from '../../RoundedTabs';
import Shimmer from '../../../Shimmer';
import { uploadFile, getPublicUrl, optimizeImage } from '../../../../services/supabaseStorageService';
import { supabase } from '../../../../config/supabase';
import { unsplashCache, UnsplashImage } from '../../../../services/unsplashCache';
import { FILE_SIZE_LIMITS, formatFileSize } from '../../../../utils/fileValidation';
import { scrollbarStyles } from '../../../../styles/scrollbarStyles';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImageInsert: (src: string, alt?: string) => void;
}

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
  open,
  onClose,
  onImageInsert,
}) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Unsplash state
  const [searchQuery, setSearchQuery] = useState('');
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImage[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const tabs = [
    { label: 'Upload' },
    { label: 'URL' },
    { label: 'Unsplash' },
  ];

  const popularSearches = [
    'trading charts',
    'business',
    'technology',
    'abstract',
    'nature',
    'minimal',
    'finance',
    'growth',
  ];

  const resetState = () => {
    setImageUrl('');
    setAltText('');
    setError(null);
    setPreviewUrl(null);
    setUploading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setError(null);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Check file size (1MB limit)
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
      if (userError || !user) {
        throw new Error('Please sign in to upload images');
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `users/${user.id}/note-images/${filename}`;

      const { error: uploadError } = await uploadFile('trade-images', filePath, optimizedFile, {
        contentType: optimizedFile.type,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = getPublicUrl('trade-images', filePath);
      onImageInsert(publicUrl, altText || file.name);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
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
    handleClose();
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
    setError(null);

    try {
      const cachedImages = unsplashCache.getCachedImages(query);
      if (cachedImages) {
        setUnsplashImages(cachedImages);
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
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUnsplashImages(data.results);
        unsplashCache.cacheImages(query, data.results);
      } else {
        setError('Failed to fetch images from Unsplash');
      }
    } catch (err) {
      setError('Error fetching images');
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleUnsplashImageSelect = async (image: UnsplashImage) => {
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        });
      } catch (err) {
        // Silent fail for download tracking
      }
    }

    const imageUrl = `${image.urls.regular}&w=800`;
    onImageInsert(imageUrl, image.alt_description || `Photo by ${image.user.name}`);
    handleClose();
  };

  const handlePopularSearchClick = (search: string) => {
    setSearchQuery(search);
    handleSearchUnsplash(search);
  };

  useEffect(() => {
    if (open && activeTab === 2 && unsplashImages.length === 0) {
      setSearchQuery('abstract');
      handleSearchUnsplash('abstract');
    }
  }, [open, activeTab]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: 2100 }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageIcon />
          Insert Image
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent onPaste={handlePaste}>
        <RoundedTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          size="small"
          sx={{ mb: 2, width: 'fit-content' }}
        />

        {/* Upload Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: `2px dashed ${dragOver ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 2,
              padding: 4,
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              backgroundColor: dragOver
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.background.default, 0.5),
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            {previewUrl ? (
              <Box sx={{ position: 'relative' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 8,
                    opacity: uploading ? 0.5 : 1,
                  }}
                />
                {uploading && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Uploading...
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <>
                <UploadIcon sx={{ fontSize: 48, color: theme.palette.text.secondary, mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Drop an image here or click to browse
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Supports: JPG, PNG, GIF, WebP (max 1MB)
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

          <TextField
            fullWidth
            label="Alt text (optional)"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            size="small"
            sx={{ mt: 2 }}
            placeholder="Describe the image for accessibility"
          />
        </TabPanel>

        {/* URL Tab */}
        <TabPanel value={activeTab} index={1}>
          <TextField
            fullWidth
            label="Image URL"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://example.com/image.jpg"
            size="small"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && imageUrl.trim()) {
                handleUrlInsert();
              }
            }}
          />

          <TextField
            fullWidth
            label="Alt text (optional)"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            size="small"
            sx={{ mt: 2 }}
            placeholder="Describe the image for accessibility"
          />

          {imageUrl && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Preview
              </Typography>
              <img
                src={imageUrl}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 200,
                  borderRadius: 8,
                }}
                onError={() => setError('Failed to load image from URL')}
              />
            </Box>
          )}
        </TabPanel>

        {/* Unsplash Tab */}
        <TabPanel value={activeTab} index={2}>
          {/* Search Bar - Styled like ImagePickerDialog */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              mb: 2,
              alignItems: 'center',
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Search for an image..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUnsplash()}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ mr: 1.5, color: 'primary.main' }} />,
                  sx: { borderRadius: 1 }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 1 },
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            />
            <Button
              variant="contained"
              onClick={() => handleSearchUnsplash()}
              disabled={unsplashLoading}
              sx={{
                minWidth: 100,
                borderRadius: 1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                }
              }}
            >
              {unsplashLoading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
            </Button>
          </Box>

          {/* Popular searches */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.75rem' }}>
              Popular searches
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {popularSearches.map((search) => (
                <Button
                  key={search}
                  size="small"
                  variant="outlined"
                  onClick={() => handlePopularSearchClick(search)}
                  sx={{
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderRadius: 1,
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    borderColor: 'divider',
                    color: 'text.primary',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`
                      : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                    '&:hover': {
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 0%, ${alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 100%)`,
                      transform: 'translateY(-1px)',
                      boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`
                    }
                  }}
                >
                  {search}
                </Button>
              ))}
            </Box>
          </Box>

          {/* Image Grid */}
          <Box
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              overflowX: 'hidden',
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.9)
                : alpha(theme.palette.background.default, 0.9),
              p: 1.5,
              ...scrollbarStyles(theme),
            }}
          >
            {unsplashLoading ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <Shimmer key={i} height={100} borderRadius={1} variant="wave" intensity="medium" />
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                }}
              >
                {unsplashImages.map((image) => (
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
                      onClick={() => handleUnsplashImageSelect(image)}
                      sx={{
                        position: 'relative',
                        '&:hover .MuiCardActionArea-focusHighlight': {
                          opacity: 0
                        }
                      }}
                    >
                      <CardMedia
                        component="img"
                        height="100"
                        image={image.urls.small}
                        alt={image.alt_description || 'Unsplash image'}
                        sx={{ objectFit: 'cover' }}
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
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                          Select
                        </Typography>
                      </Box>

                      {/* Attribution overlay */}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          color: 'white',
                          p: 0.75,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 500,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          by {image.user.name}
                        </Typography>
                      </Box>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}
          </Box>

          {/* Unsplash Attribution Footer */}
          <Box sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}>
            <Typography variant="body2" sx={{
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              fontSize: '0.75rem'
            }}>
              📷
              <Link
                href="https://unsplash.com/?utm_source=trade-tracker&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Photos by Unsplash
              </Link>
            </Typography>
          </Box>
        </TabPanel>

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {activeTab === 1 && (
          <Button
            onClick={handleUrlInsert}
            variant="contained"
            disabled={!imageUrl.trim()}
          >
            Insert Image
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImageUploadDialog;
