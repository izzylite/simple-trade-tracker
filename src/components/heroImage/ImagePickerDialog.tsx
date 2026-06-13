import React from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  Button,
  Link,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon, Image as ImageIcon } from '@mui/icons-material';
import UnsplashImagePicker from 'components/heroImage/UnsplashImagePicker';
import { UnsplashImage } from 'services/unsplashCache';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens } from 'styles/dialogTokens';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';

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
  title = 'Choose a cover image',
}) => {
  const theme = useTheme();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();
  const {
    violet,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    ghostButtonSx,
  } = useDialogTokens();

  const handleImageSelect = (image: UnsplashImage) => {
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG + 200 }}
      slotProps={{
        paper: {
          sx: {
            ...paperSx,
            ...(fullScreen ? { display: 'flex', flexDirection: 'column' } : {}),
            ...fullScreenPaperSx,
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, px: { xs: 2, sm: 2.5 }, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
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
          px: { xs: 2, sm: 2.5 },
          py: 2,
          ...scrollbarStyles(theme),
          overflowY: 'auto',
          flex: fullScreen ? 1 : undefined,
          maxHeight: fullScreen ? undefined : '75vh',
        }}
      >
        <UnsplashImagePicker
          onImageSelect={handleImageSelect}
          showClearCache
          showCacheStats
        />
      </Box>

      {/* Footer */}
      <Box
        sx={{
          ...footerSx,
          justifyContent: 'space-between',
          py: 1.25,
          px: { xs: 2, sm: 2.5 },
          pb: fullScreen ? SAFE_AREA_BOTTOM : 1.25,
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
        <Button onClick={onClose} sx={ghostButtonSx}>
          Cancel
        </Button>
      </Box>
    </Dialog>
  );
};

export default ImagePickerDialog;
