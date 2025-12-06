import React, { useState } from 'react';
import { Box, IconButton, LinearProgress, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Delete as DeleteIcon, OpenInFull as ExpandIcon, Image as ImageIcon } from '@mui/icons-material';
import { ContentBlock, ContentState } from 'draft-js';

interface ImageBlockProps {
  block: ContentBlock;
  contentState: ContentState;
  blockProps: {
    onRemove: (blockKey: string) => void;
    readOnly?: boolean;
  };
}

const ImageBlock: React.FC<ImageBlockProps> = ({ block, contentState, blockProps }) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const entityKey = block.getEntityAt(0);
  if (!entityKey) return null;

  const entity = contentState.getEntity(entityKey);
  const { src, alt, width } = entity.getData();

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    blockProps.onRemove(block.getKey());
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(src, '_blank');
  };

  if (hasError) {
    return (
      <Box
        sx={{
          padding: 2,
          backgroundColor: alpha(theme.palette.error.main, 0.1),
          borderRadius: 2,
          border: `1px dashed ${theme.palette.error.main}`,
          textAlign: 'center',
          color: theme.palette.error.main,
          my: 1,
        }}
      >
        Failed to load image
        {!blockProps.readOnly && (
          <IconButton size="small" onClick={handleRemove} sx={{ ml: 1 }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box
      contentEditable={false}
      sx={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        my: 1.5,
        userSelect: 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box
        sx={{
          position: 'relative',
          maxWidth: width || '100%',
          width: '100%',
          overflow: 'hidden', 
          // Ensure minimum dimensions during loading
          minHeight: isLoading ? 150 : undefined,
          minWidth: isLoading ? 200 : undefined,
          backgroundColor: isLoading ? alpha(theme.palette.action.hover, 0.3) : undefined,
        }}
      >
        {/* Loading placeholder */}
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              zIndex: 1,
            }}
          >
            <ImageIcon sx={{ fontSize: 40, color: alpha(theme.palette.text.secondary, 0.4) }} />
            <Typography variant="caption" color="text.secondary">
              Loading image...
            </Typography>
            <Box sx={{ width: '60%', maxWidth: 200 }}>
              <LinearProgress />
            </Box>
          </Box>
        )}

        <img
          src={src}
          alt={alt || 'Inserted image'}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out',
          }}
        />

        {/* Overlay controls */}
        {isHovered && !blockProps.readOnly && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 0.5,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              backdropFilter: 'blur(8px)',
              borderRadius: 1,
              padding: 0.5,
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.2)}`,
            }}
          >
            <IconButton
              size="small"
              onClick={handleExpand}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              <ExpandIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleRemove}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.error.main,
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ImageBlock;
