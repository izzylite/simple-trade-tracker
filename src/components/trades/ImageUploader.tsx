import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import { AddPhotoAlternate, ViewList, GridView } from '@mui/icons-material';

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



type LayoutMode = 'vertical' | 'grid';

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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageUpload(e.target.files);
      // Reset the input value so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleAddImageClick = () => {
    fileInputRef.current?.click();
  };

  // Check if any images are currently uploading
  const isAnyImageUploading = (): boolean => {
    return pendingImages.some(img =>
      img.upload_progress !== undefined &&
      img.upload_progress >= 0 &&
      img.upload_progress < 100
    );
  };

  const organizeImagesVertically = () => {
    if (!onImagesReordered || isAnyImageUploading()) return;

    const allImages = [...pendingImages, ...uploadedImages];

    // Sort images by their existing row and column values to maintain relative order
    const sortedImages = [...allImages].sort((a, b) => {
      const aRow = a.row ?? 0;
      const bRow = b.row ?? 0;
      const aCol = a.column ?? 0;
      const bCol = b.column ?? 0;

      if (aRow === bRow) return aCol - bCol;
      return aRow - bRow;
    });

    // Reorganize images vertically (one per row)
    const reorganizedImages = sortedImages.map((image, index) => ({
      ...image,
      row: index,
      column: 0,
      column_width: 100 // Full width for vertical layout
    }));

    // Split back into pending and uploaded images
    const newPendingImages = reorganizedImages.filter(img => 'file' in img) as GridPendingImage[];
    const newUploadedImages = reorganizedImages.filter(img => !('file' in img)) as GridImage[];

    // Update the layout
    onImagesReordered([...newPendingImages, ...newUploadedImages]);
  };

  const organizeImagesInGrid = () => {
    if (!onImagesReordered || isAnyImageUploading()) return;

    const allImages = [...pendingImages, ...uploadedImages];

    // Sort images by their existing row and column values to maintain relative order
    const sortedImages = [...allImages].sort((a, b) => {
      const aRow = a.row ?? 0;
      const bRow = b.row ?? 0;
      const aCol = a.column ?? 0;
      const bCol = b.column ?? 0;

      if (aRow === bRow) return aCol - bCol;
      return aRow - bRow;
    });

    // Calculate grid layout with max 3 columns
    const maxColumns = 3;
    const columnWidth = 100 / maxColumns;

    const reorganizedImages = sortedImages.map((image, index) => {
      const row = Math.floor(index / maxColumns);
      const column = index % maxColumns;

      return {
        ...image,
        row,
        column,
        columnWidth
      };
    });

    // Split back into pending and uploaded images
    const newPendingImages = reorganizedImages.filter(img => 'file' in img) as GridPendingImage[];
    const newUploadedImages = reorganizedImages.filter(img => !('file' in img)) as GridImage[];

    // Update the layout
    onImagesReordered([...newPendingImages, ...newUploadedImages]);
   
  };

  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      onImageUpload(dataTransfer.files);
    }
  };

  useEffect(() => {
    // Add paste event listener to the document
    document.addEventListener('paste', handlePaste);

    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onImageUpload]); // Add onImageUpload to the dependency array

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Images
      </Typography>

      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddPhotoAlternate />}
            onClick={handleAddImageClick}
          >
            Add Images
          </Button>
          <Box sx={{ flex: 1 }} />  {/* This will push the buttons to the right */}

          <Tooltip title="Arrange images vertically (one per row)">
            <span> {/* Wrapper needed for disabled Tooltip */}
              <IconButton
                onClick={organizeImagesVertically}
                color={'default'}
                disabled={pendingImages.length + uploadedImages.length < 2 || isAnyImageUploading()}
              >
                <ViewList />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Arrange images in a grid (max 3 columns)">
            <span> {/* Wrapper needed for disabled Tooltip */}
              <IconButton
                onClick={organizeImagesInGrid}
                color={'default'}
                disabled={pendingImages.length + uploadedImages.length < 2 || isAnyImageUploading()}
              >
                <GridView />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          You can also paste images directly (Ctrl+V). Maximum file size: 1MB per image.
        </Typography>
      </Box>

      {(pendingImages.length > 0 || uploadedImages.length > 0) && (
        <ImageGrid
          pendingImages={pendingImages}
          uploadedImages={uploadedImages}
          editingTrade={editingTrade}
          onImageCaptionChange={onImageCaptionChange}
          onImageRemove={onImageRemove}
          onImagesReordered={onImagesReordered}
        />
      )}
    </Box>
  );
};


export default ImageUploader;
