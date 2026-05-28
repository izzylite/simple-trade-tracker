import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  Button,
  TextField,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Link,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  PhotoLibrary as LibraryIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { uploadFile, getPublicUrl, optimizeImage } from 'services/supabaseStorageService';
import { supabase } from 'config/supabase';
import { UnsplashImagePicker } from 'components/heroImage';
import { UnsplashImage } from 'services/unsplashCache';
import { FILE_SIZE_LIMITS, formatFileSize } from 'utils/fileValidation';
import { isDarkMode } from 'utils/themeMode';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import { dialogProps } from 'styles/dialogStyles';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { useSubscription } from 'features/billing/contexts/SubscriptionContext';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImageInsert: (src: string, alt?: string) => void;
}

type TabKey = 'upload' | 'url' | 'unsplash';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'upload', label: 'Upload', icon: <UploadIcon sx={{ fontSize: 14 }} /> },
  { key: 'url', label: 'URL', icon: <LinkIcon sx={{ fontSize: 14 }} /> },
  { key: 'unsplash', label: 'Unsplash', icon: <LibraryIcon sx={{ fontSize: 14 }} /> },
];

const UNSPLASH_TAB_QUERIES = [
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
  const isDark = isDarkMode(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Tier gate — free users can't upload to storage. URL + Unsplash tabs
  // still work since they just embed remote URLs (no `uploadFile` call).
  // When uploads are blocked we land users on the URL tab and disable the
  // Upload tab affordance.
  const { isPaid, loaded } = useSubscription();
  const uploadsBlocked = loaded && !isPaid;

  const [activeTab, setActiveTab] = useState<TabKey>('upload');

  // Once the subscription resolves, kick free users off the Upload tab so
  // they don't sit on a disabled empty state.
  useEffect(() => {
    if (uploadsBlocked && activeTab === 'upload') {
      setActiveTab('url');
    }
  }, [uploadsBlocked, activeTab]);
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const {
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoLabelSx,
    optionalSx,
    inputSx,
    primaryButtonSx,
    ghostButtonSx,
  } = useDialogTokens();

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
      const msg = err?.message ?? String(err);
      // Tier guard from supabaseStorageService.uploadFile — show the
      // upgrade nudge inline instead of a raw error string. The disabled
      // Upload tab normally prevents this path, but a paid user can lose
      // entitlement mid-session.
      if (msg.includes('tier_no_image_uploads')) {
        setError('Image uploads are a paid feature — upgrade to attach charts.');
      } else {
        setError(msg || 'Failed to upload image');
      }
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

  const handleUnsplashImageSelect = (image: UnsplashImage) => {
    const url = `${image.urls.regular}&w=800`;
    onImageInsert(url, image.alt_description || `Photo by ${image.user.name}`);
    resetState();
    onClose();
  };

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
        // Keep the Upload tab clickable when blocked so users land on the
        // tier nudge inside it — the empty disabled tab would feel broken.
        const isPaywalled = tab.key === 'upload' && uploadsBlocked;
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
              opacity: isPaywalled && !selected ? 0.6 : 1,
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
          sx: paperSx,
        },
      }}
    >
      {/* Header */}
      <Box sx={headerSx}>
        <Box sx={iconAvatarSx}>
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
        {activeTab === 'upload' && uploadsBlocked && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.25,
              p: 3,
              borderRadius: 1.5,
              border: `1px dashed ${alpha(violet, isDark ? 0.45 : 0.35)}`,
              backgroundColor: violetSofter,
              textAlign: 'center',
            }}
          >
            <UploadIcon sx={{ fontSize: 32, color: violet }} />
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Upload is a paid feature
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>
              Upgrade to upload your own images. You can still paste a URL or
              pick from Unsplash on the other tabs.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                onClose();
                navigate('/pricing');
              }}
              sx={{ ...primaryButtonSx, mt: 0.5 }}
            >
              See plans
            </Button>
          </Box>
        )}
        {activeTab === 'upload' && !uploadsBlocked && (
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
          <UnsplashImagePicker
            onImageSelect={handleUnsplashImageSelect}
            defaultQuery="abstract"
            popularSearches={UNSPLASH_TAB_QUERIES}
            resultsHeight={340}
            tileHeight={110}
            loadingPlaceholders={12}
          />
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
      <Box sx={{ ...footerSx, justifyContent: 'space-between' }}>
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
            sx={ghostButtonSx}
          >
            Cancel
          </Button>
          {activeTab === 'url' && (
            <Button
              onClick={handleUrlInsert}
              disabled={!imageUrl.trim()}
              variant="contained"
              endIcon={<ArrowIcon sx={{ fontSize: 14 }} />}
              sx={primaryButtonSx}
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
