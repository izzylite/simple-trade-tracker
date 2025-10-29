import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  RestartAlt as RestartAltIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon
} from '@mui/icons-material';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface ImageZoomDialogProps {
  open: boolean;
  onClose: () => void;
  imageProp: ImageZoomProp;
}

export interface ImageZoomProp{
  selectetdImageIndex: number;
  allImages: string[];
  useSolidBackground?: boolean; // Optional: use solid background for AI charts
}

const ImageZoomDialog: React.FC<ImageZoomDialogProps> = ({
  open,
  onClose,
  imageProp, 
}) => {
  // For backward compatibility, if imageUrl is provided but not images
  const images = imageProp?.allImages || [];
  const imageUrl = imageProp?.allImages[imageProp?.selectetdImageIndex || 0];
   
  const imageArray = images.length > 0 ? images : (imageUrl ? [imageUrl] : []);
  const [imageData, setImageData] = useState<ImageZoomProp>(imageProp);
 if(imageData==null && imageProp){
  setImageData(imageProp);
 }
  const theme = useTheme();

  // Determine if we should use solid background
  // Auto-detect if the current image is from QuickChart (AI-generated chart)
  const currentImageUrl = imageArray[imageData?.selectetdImageIndex || 0];
  const isAIChart = currentImageUrl?.includes('quickchart.io');
  const useSolidBackground = imageProp?.useSolidBackground ?? isAIChart;
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
      // We only need the image rect for calculating bounds
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

  // Navigation functions
  const navigateNext = useCallback(() => {
    if (imageArray.length <= 1) return;
    setImageData((prev) => {
      if (prev) {
        return {
          ...prev,
          selectetdImageIndex: (prev.selectetdImageIndex + 1) % imageArray.length
        };
      }
      return prev;
    });
  }, [imageArray.length]);

  const navigatePrevious = useCallback(() => {
    if (imageArray.length <= 1) return;
    setImageData((prev) => {
      if (prev) {
        return {
          ...prev,
          selectetdImageIndex: (prev.selectetdImageIndex - 1 + imageArray.length) % imageArray.length
        };
      }
      return prev;
    });
  }, [imageArray.length]);

  // Reset zoom when image changes
  useEffect(() => {
    if (open) {
      resetZoom();
    }
  }, [open, imageData]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        navigateNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use capture phase to handle events before they reach other components
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, imageData, imageArray.length, navigatePrevious, navigateNext, onClose]);

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
      sx={{
        zIndex: 1600 // Higher than AI drawer (1400) to ensure gallery appears on top
      }}
      PaperProps={{
        sx: {
          boxShadow: 'none',
          backgroundColor: useSolidBackground
            ? theme.palette.background.paper
            : 'transparent',
          overflow: 'hidden',
          maxWidth: '80%',
          borderRadius: useSolidBackground ? 2 : 0,
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
          }
        }
      }}
    >
      {imageArray.length > 0 && (
        <>
          {/* Navigation buttons */}
          {imageArray.length > 1 && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1200
                }}
              >
                <IconButton
                  onClick={navigatePrevious}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.7)'
                    }
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1200
                }}
              >
                <IconButton
                  onClick={navigateNext}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.7)'
                    }
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
            </>
          )}

          {/* Image counter */}
          {imageArray.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                fontSize: '0.875rem',
                fontWeight: 500,
                zIndex: 1200
              }}
            >
              {imageData?.selectetdImageIndex!! + 1} / {imageArray.length}
            </Box>
          )}
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
            backgroundColor: useSolidBackground
              ? theme.palette.background.default
              : 'transparent',
            padding: useSolidBackground ? 2 : 0,
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
              src={imageArray[imageData?.selectetdImageIndex || 0]}
              alt={`Trade ${imageData?.selectetdImageIndex!! + 1} of ${imageArray.length}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />
          </Box>


          {/* Controls */}
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
        </>
      )}
    </Dialog>
  );
};

export default ImageZoomDialog;
