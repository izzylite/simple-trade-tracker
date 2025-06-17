import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Card,
  CardMedia,
  CardActionArea,
  useTheme,
  alpha,
  Link
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import Shimmer from '../Shimmer';

interface UnsplashImage {
  id: string;
  urls: {
    small: string;
    regular: string;
    full: string;
  };
  links: {
    download_location: string;
    html: string;
  };
  alt_description: string;
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
}

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
  title = "Choose a cover image"
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);

  const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY;

  const popularSearches = [
    'trading charts',
    'financial markets',
    'business success',
    'growth analytics',
    'stock market',
    'cryptocurrency',
    'investment',
    'profit growth'
  ];

  const generatePlaceholderImages = (query: string): UnsplashImage[] => {
    const categories = ['trading', 'finance', 'business', 'charts', 'success', 'growth'];
    const selectedCategory = categories.find(cat => query.toLowerCase().includes(cat)) || 'business';

    return Array.from({ length: 24 }, (_, i) => ({
      id: `placeholder-${i}`,
      urls: {
        small: `https://picsum.photos/400/200?random=${i}&blur=1`,
        regular: `https://picsum.photos/800/400?random=${i}`,
        full: `https://picsum.photos/1200/600?random=${i}`
      },
      links: {
        download_location: '',
        html: ''
      },
      alt_description: `${selectedCategory} image ${i + 1}`,
      user: {
        name: 'Demo User',
        username: 'demo_user',
        links: {
          html: ''
        }
      }
    }));
  };

  const handleSearchImages = async (query: string = searchQuery) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      if (!UNSPLASH_ACCESS_KEY) {
        console.warn('Unsplash API key not configured, using placeholder images');
        setImages(generatePlaceholderImages(query));
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
        setImages(data.results);
      } else {
        console.error('Failed to fetch images from Unsplash');
        setImages(generatePlaceholderImages(query));
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setImages(generatePlaceholderImages(query));
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (image: UnsplashImage) => {
    // Trigger download endpoint as required by Unsplash guidelines
    if (image.links.download_location && UNSPLASH_ACCESS_KEY) {
      try {
        await fetch(image.links.download_location, {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        });
      } catch (error) {
        console.error('Error triggering download endpoint:', error);
      }
    }

    // Pass the image data including attribution info
    onImageSelect(image.urls.regular, {
      id: image.id,
      photographer: image.user.name,
      photographerUsername: image.user.username,
      photographerUrl: `${image.user.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      unsplashUrl: `${image.links.html}?utm_source=trade-tracker&utm_medium=referral`,
      altDescription: image.alt_description
    });
    onClose();
  };

  const handlePopularSearchClick = (search: string) => {
    setSearchQuery(search);
    handleSearchImages(search);
  };

  // Load default images when dialog opens
  React.useEffect(() => {
    if (open && images.length === 0) {
      setSearchQuery('trading charts');
      handleSearchImages('trading charts');
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1.5,
            maxHeight: '90vh',
            background: (theme) => theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
              : `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)`,
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: (theme) => `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`
          }
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 2,
        pt: 3,
        px: 3,
        background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)`,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box>
          <Typography variant="h5" sx={{
            fontWeight: 700,
            background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 0.5
          }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Choose from thousands of high-quality images
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': {
              bgcolor: 'error.main',
              color: 'white',
              borderColor: 'error.main'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, px: 3, overflow: 'hidden' }}>
        {/* Search */}
        <Box sx={{
          display: 'flex',
          gap: 2,
          my: 3, 

        }}>
          <TextField
            fullWidth
            size="medium"
            placeholder="Search for trading charts, financial markets, business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchImages()}
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ mr: 1.5, color: 'primary.main' }} />,
                sx: {
                  borderRadius: 1,
                  '&:hover': {
                    borderColor: 'primary.main'
                  }
                }
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1
              },
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          />
          <Button
            variant="contained"
            onClick={() => handleSearchImages()}
            disabled={loading}
            sx={{
              minWidth: 120,
              borderRadius: 1,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              '&:hover': {
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                transform: 'translateY(-1px)',
                boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
              }
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
          </Button>
        </Box>

        {/* Popular searches */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{
            color: 'text.primary',
            mb: 1.5,
            display: 'block',
            fontWeight: 600
          }}>
            ✨ Popular searches
          </Typography>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1
          }}>
            {popularSearches.map((search) => (
              <Button
                key={search}
                size="small"
                variant="outlined"
                onClick={() => handlePopularSearchClick(search)}
                sx={{
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  borderRadius: 1,
                  minWidth: 'auto',
                  px: 2,
                  py: 0.5,
                  borderColor: 'divider',
                  color: 'text.primary',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 0%, ${alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.15 : 0.05)} 100%)`,
                    transform: 'translateY(-1px)',
                    boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`
                  }
                }}
              >
                {search}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Images Grid */}
        <Box sx={{
          maxHeight: '450px',
          overflow: 'auto',
          scrollbarWidth: 'thin',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) => theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.6)} 0%, ${alpha(theme.palette.primary.light, 0.6)} 100%)`
              : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
            borderRadius: '4px',
            '&:hover': {
              background: (theme) => theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.8)} 0%, ${alpha(theme.palette.primary.light, 0.8)} 100%)`
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
            }
          }
        }}>
          {loading ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)'
                },
                gap: 1.5
              }}
            >
              {Array.from({ length: 20 }).map((_, index) => (
                <Shimmer
                  key={index}
                  height={140}
                  borderRadius={1}
                  variant="wave"
                  intensity="medium"
                />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)'
                },
                gap: 1.5
              }}
            >
              {images.map((image) => (
                <Card
                  key={image.id}
                  sx={{
                    borderRadius: 1,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      transform: 'translateY(-4px) scale(1.02)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                      borderColor: 'primary.main',
                      '& .image-overlay': {
                        opacity: 1
                      }
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => handleImageClick(image)}
                    sx={{
                      position: 'relative',
                      '&:hover .MuiCardActionArea-focusHighlight': {
                        opacity: 0
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="140"
                      image={image.urls.small}
                      alt={image.alt_description || 'Cover image'}
                      sx={{
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }}
                    />

                    {/* Hover overlay */}
                    <Box
                      className="image-overlay"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Select Image
                      </Typography>
                    </Box>

                    {/* Attribution overlay - only show for real Unsplash images */}
                    {image.user.username !== 'demo_user' && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          color: 'white',
                          p: 1,
                          fontSize: '0.7rem'
                        }}
                      >
                        <Typography variant="caption" sx={{
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}>
                          📸 {image.user.name}
                        </Typography>
                      </Box>
                    )}
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Unsplash Attribution Footer */}
        <Box sx={{
          mt: 3,
          pt: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.primary.light, 0.02)} 100%)`,
          borderRadius: 1,
          mx: -1,
          px: 2
        }}>
          <Typography variant="body2" sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}>
            <Box component="span" sx={{ fontSize: '1.2rem' }}>📷</Box>
            <Link
              href="https://unsplash.com/?utm_source=trade-tracker&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 600,
                borderBottom: '1px solid transparent',
                transition: 'border-color 0.2s ease',
                '&:hover': {
                  borderBottomColor: 'primary.main'
                }
              }}
            >
              Photo by Unsplash
            </Link>
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ImagePickerDialog;
