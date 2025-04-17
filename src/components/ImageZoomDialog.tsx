import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';

interface ImageZoomDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

const ImageZoomDialog: React.FC<ImageZoomDialogProps> = ({
  open,
  onClose,
  imageUrl
}) => {
  const theme = useTheme();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const newScale = delta > 0
      ? Math.max(1, scale - 0.1)
      : Math.min(3, scale + 0.1);

    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;

    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    if (imageRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();

      const maxX = (imageRect.width * (scale - 1)) / 2;
      const maxY = (imageRect.height * (scale - 1)) / 2;

      const boundedX = Math.min(Math.max(-maxX, newX), maxX);
      const boundedY = Math.min(Math.max(-maxY, newY), maxY);

      setPosition({
        x: boundedX,
        y: boundedY
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Reset zoom when image changes
  useEffect(() => {
    if (open) {
      resetZoom();
    }
  }, [open, imageUrl]);

  // Add event listeners for mouse up on document level
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
          overflow: 'hidden',
          maxWidth: '80%',
          '& .MuiDialogContent-root': {
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              '&:hover': {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.3)'
                  : 'rgba(0, 0, 0, 0.3)'
              }
            }
          }
        }
      }}
    >
      {imageUrl && (
        <Box
          ref={containerRef}
          sx={{
            position: 'relative',
            width: '100%',
            height: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: scale > 1 ? 'grab' : 'default',
            '&:active': {
              cursor: scale > 1 ? 'grabbing' : 'default'
            }
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <Box
            sx={{
              position: 'relative',
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Trade"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              gap: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 1,
              p: 0.5
            }}
          >
            <IconButton
              onClick={() => setScale(Math.max(1, scale - 0.1))}
              disabled={scale <= 1}
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <ZoomInIcon sx={{ transform: 'rotate(45deg)' }} />
            </IconButton>
            <IconButton
              onClick={() => setScale(Math.min(3, scale + 0.1))}
              disabled={scale >= 3}
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <ZoomInIcon />
            </IconButton>
            <IconButton
              onClick={resetZoom}
              disabled={scale === 1}
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <RestartAltIcon />
            </IconButton>
            <IconButton
              onClick={onClose}
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Dialog>
  );
};

export default ImageZoomDialog;
