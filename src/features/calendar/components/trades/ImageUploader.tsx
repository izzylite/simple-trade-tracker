import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  AddPhotoAlternate,
  ViewList,
  GridView,
  CloudUploadOutlined,
} from '@mui/icons-material';
import { useDialogTokens } from 'styles/dialogTokens';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from 'features/billing/hooks/useSubscription';

import { PendingImage, TradeImage } from './TradeForm';
import ImageGrid, { GridImage, GridPendingImage } from './ImageGrid';

interface ImageUploaderProps {
  pendingImages: Array<PendingImage>;
  uploadedImages: Array<TradeImage>;
  editingTrade: boolean
  onImageUpload: (files: FileList) => void;
  onImageCaptionChange: (index: number, caption: string, isPending: boolean) => void;
  onImageRemove: (index: number, isPending: boolean) => void;
  onImagesReordered?: (images: Array<GridImage | GridPendingImage>) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  pendingImages,
  uploadedImages,
  editingTrade,
  onImageUpload,
  onImageCaptionChange,
  onImageRemove,
  onImagesReordered
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { violet, violetSoft, violetSofter, hairline, surfaceInset } =
    useDialogTokens();
  const navigate = useNavigate();
  // Tier gate — free users can't upload chart screenshots. We disable the
  // affordance instead of letting them hit the `tier_no_image_uploads`
  // error from `supabaseStorageService.uploadFile`. While loading, default
  // to the existing (paid) behavior to avoid a flash of "disabled" for
  // paid users on every dialog open.
  const { isPaid, loaded } = useSubscription();
  const uploadsBlocked = loaded && !isPaid;
  const tierTooltip = uploadsBlocked
    ? 'Image uploads are a paid feature — upgrade to attach charts to your trades.'
    : '';

  // Tracks dragenter/leave depth so nested children flickering doesn't toggle
  // the drop-zone styling off mid-drag.
  const [dragDepth, setDragDepth] = useState(0);
  const isDragging = dragDepth > 0;

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleAddImageClick = () => {
    if (uploadsBlocked) {
      navigate('/pricing');
      return;
    }
    fileInputRef.current?.click();
  };

  const isAnyImageUploading = (): boolean => pendingImages.length > 0;
  const hasImages = pendingImages.length + uploadedImages.length > 0;

  const organizeImagesVertically = () => {
    if (!onImagesReordered || isAnyImageUploading()) return;

    const allImages = [...pendingImages, ...uploadedImages];
    const sortedImages = [...allImages].sort((a, b) => {
      const aRow = a.row ?? 0;
      const bRow = b.row ?? 0;
      const aCol = a.column ?? 0;
      const bCol = b.column ?? 0;
      if (aRow === bRow) return aCol - bCol;
      return aRow - bRow;
    });

    const reorganizedImages = sortedImages.map((image, index) => ({
      ...image,
      row: index,
      column: 0,
      column_width: 100,
    }));

    const newPendingImages = reorganizedImages.filter(img => 'file' in img) as GridPendingImage[];
    const newUploadedImages = reorganizedImages.filter(img => !('file' in img)) as GridImage[];
    onImagesReordered([...newPendingImages, ...newUploadedImages]);
  };

  const organizeImagesInGrid = () => {
    if (!onImagesReordered || isAnyImageUploading()) return;

    const allImages = [...pendingImages, ...uploadedImages];
    const sortedImages = [...allImages].sort((a, b) => {
      const aRow = a.row ?? 0;
      const bRow = b.row ?? 0;
      const aCol = a.column ?? 0;
      const bCol = b.column ?? 0;
      if (aRow === bRow) return aCol - bCol;
      return aRow - bRow;
    });

    const maxColumns = 3;
    const columnWidth = 100 / maxColumns;

    const reorganizedImages = sortedImages.map((image, index) => {
      const row = Math.floor(index / maxColumns);
      const column = index % maxColumns;
      return { ...image, row, column, columnWidth };
    });

    const newPendingImages = reorganizedImages.filter(img => 'file' in img) as GridPendingImage[];
    const newUploadedImages = reorganizedImages.filter(img => !('file' in img)) as GridImage[];
    onImagesReordered([...newPendingImages, ...newUploadedImages]);
  };

  // Clipboard paste — captured at document level so the user can paste images
  // any time the dialog is open (matches the previous behavior). Skipped
  // entirely for free users so paste doesn't trigger the tier guard error.
  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (uploadsBlocked) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      onImageUpload(dataTransfer.files);
    }
  }, [onImageUpload, uploadsBlocked]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ─── Drag-and-drop ───────────────────────────────────────────────────────
  const dropZoneOnly = (e: React.DragEvent) => {
    // Only react to file drags (not text/HTML drags from rich content).
    return Array.from(e.dataTransfer.types).includes('Files');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!dropZoneOnly(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(d => d + 1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!dropZoneOnly(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneOnly(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(d => Math.max(0, d - 1));
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!dropZoneOnly(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    if (uploadsBlocked) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImageUpload(e.dataTransfer.files);
    }
  };

  // Shared drop-zone styling — used full-bleed in the empty state, and as a
  // compact "Add more" button when images are already present.
  const dropZoneSx = (compact: boolean) => ({
    flex: compact ? 'none' : 1,
    minHeight: compact ? 'auto' : 220,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? 0.5 : 1.25,
    px: 3,
    py: compact ? 2 : 4,
    borderRadius: 2,
    border: `2px dashed ${isDragging ? violet : hairline}`,
    backgroundColor: isDragging ? violetSofter : surfaceInset,
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
    textAlign: 'center' as const,
    '&:hover': {
      borderColor: alpha(violet, 0.7),
      backgroundColor: violetSofter,
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header — title + layout toggles (toggles only matter when images exist) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.25,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Images
        </Typography>

        {hasImages && (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Arrange images vertically (one per row)">
              <span>
                <IconButton
                  onClick={organizeImagesVertically}
                  size="small"
                  disabled={
                    pendingImages.length + uploadedImages.length < 2 ||
                    isAnyImageUploading()
                  }
                >
                  <ViewList fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Arrange images in a grid (max 3 columns)">
              <span>
                <IconButton
                  onClick={organizeImagesInGrid}
                  size="small"
                  disabled={
                    pendingImages.length + uploadedImages.length < 2 ||
                    isAnyImageUploading()
                  }
                >
                  <GridView fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {hasImages ? (
        <>
          {/* Compact "Add more" drop zone above the grid. */}
          <Tooltip title={tierTooltip} placement="top">
            <Box
              onClick={handleAddImageClick}
              onDragEnter={uploadsBlocked ? undefined : handleDragEnter}
              onDragOver={uploadsBlocked ? undefined : handleDragOver}
              onDragLeave={uploadsBlocked ? undefined : handleDragLeave}
              onDrop={uploadsBlocked ? undefined : handleDrop}
              role="button"
              tabIndex={0}
              aria-disabled={uploadsBlocked}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleAddImageClick();
                }
              }}
              sx={{
                ...dropZoneSx(true),
                mb: 1.5,
                opacity: uploadsBlocked ? 0.55 : 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddPhotoAlternate sx={{ fontSize: 20, color: violet }} />
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: violet }}>
                  {uploadsBlocked ? 'Upgrade to attach charts' : 'Add more'}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {uploadsBlocked
                  ? 'Image uploads are a paid feature — click to see plans.'
                  : 'Drop files, click to browse, or paste (Ctrl+V) · max 1MB each'}
              </Typography>
            </Box>
          </Tooltip>

          <ImageGrid
            pendingImages={pendingImages}
            uploadedImages={uploadedImages}
            editingTrade={editingTrade}
            onImageCaptionChange={onImageCaptionChange}
            onImageRemove={onImageRemove}
            onImagesReordered={onImagesReordered}
          />
        </>
      ) : (
        // Empty state — full-height drop zone fills the tab so the dialog
        // stays a consistent height across tabs.
        <Tooltip title={tierTooltip} placement="top">
          <Box
            onClick={handleAddImageClick}
            onDragEnter={uploadsBlocked ? undefined : handleDragEnter}
            onDragOver={uploadsBlocked ? undefined : handleDragOver}
            onDragLeave={uploadsBlocked ? undefined : handleDragLeave}
            onDrop={uploadsBlocked ? undefined : handleDrop}
            role="button"
            tabIndex={0}
            aria-disabled={uploadsBlocked}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAddImageClick();
              }
            }}
            sx={{
              ...dropZoneSx(false),
              opacity: uploadsBlocked ? 0.55 : 1,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: violetSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0.5,
              }}
            >
              <CloudUploadOutlined sx={{ fontSize: 28, color: violet }} />
            </Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>
              {uploadsBlocked
                ? 'Charts are a paid feature'
                : isDragging
                  ? 'Drop to upload'
                  : 'Drop screenshots here'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>
              {uploadsBlocked ? (
                <>Upgrade to attach screenshots and chart images to your trades.</>
              ) : (
                <>
                  Drag &amp; drop, click to browse, or paste with Ctrl+V.
                  <br />Max 1&nbsp;MB per image.
                </>
              )}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddPhotoAlternate />}
              onClick={(e) => {
                e.stopPropagation();
                handleAddImageClick();
              }}
              sx={{ mt: 1.5, borderRadius: 1.25, textTransform: 'none' }}
            >
              {uploadsBlocked ? 'See plans' : 'Browse files'}
            </Button>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

export default ImageUploader;
