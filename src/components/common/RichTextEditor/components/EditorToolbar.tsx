/**
 * EditorToolbar Component
 * Standalone reusable toolbar for Draft.js rich text editors
 * Supports both 'floating' and 'sticky' variants
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Toolbar,
  IconButton,
  Tooltip,
  Divider,
  Typography,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Paper as MuiPaper,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatListBulleted,
  FormatListNumbered,
  Title,
  ArrowDropDown,
  Palette,
  Link,
  FormatClear,
  Image as ImageIcon,
} from '@mui/icons-material';
import { EditorState, DraftInlineStyle } from 'draft-js';

import { TEXT_COLORS, BACKGROUND_COLORS } from '../constants/colors';
import { HEADING_OPTIONS } from '../constants/headings';
import { useRecentColors } from '../hooks/useRecentColors';
import { handleToolbarInteraction } from '../utils/styleUtils';
import { getCurrentBlockType } from '../utils/editorActions';
import { getCurrentLink } from '../utils/linkUtils';

const Z_INDEX = 2000;

export interface EditorToolbarProps {
  editorState: EditorState;
  disabled?: boolean;
  variant?: 'floating' | 'sticky';
  stickyPosition?: 'top' | 'bottom';
  position?: { top: number; left: number };
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
  // Formatting handlers
  onToggleInlineStyle: (style: string) => void;
  onToggleBlockType: (blockType: string) => void;
  onApplyTextColor: (color: string) => void;
  onApplyBackgroundColor: (color: string) => void;
  onApplyHeading: (headingStyle: string) => void;
  onClearFormatting: () => void;
  onLinkClick: () => void;
  onImageClick: () => void;
  // Callback when any menu opens/closes (for floating toolbar visibility management)
  onMenuOpenChange?: (isOpen: boolean) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorState,
  disabled = false,
  variant = 'floating',
  stickyPosition = 'top',
  position,
  toolbarRef: externalToolbarRef,
  onToggleInlineStyle,
  onToggleBlockType,
  onApplyTextColor,
  onApplyBackgroundColor,
  onApplyHeading,
  onClearFormatting,
  onLinkClick,
  onImageClick,
  onMenuOpenChange,
}) => {
  const theme = useTheme();
  const internalToolbarRef = useRef<HTMLDivElement>(null);
  const toolbarRef = externalToolbarRef || internalToolbarRef;

  // Menu states
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);

  // Recent colors hook
  const {
    recentTextColors,
    recentBgColors,
    addRecentTextColor,
    addRecentBgColor,
  } = useRecentColors();

  // Guard against undefined or invalid editorState
  // Check that editorState exists, has content, and has a valid selection
  if (!editorState) {
    return null;
  }

  const content = editorState.getCurrentContent();
  const selection = editorState.getSelection();

  if (!content || !selection) {
    return null;
  }

  // Additional guard: check that the selection's anchor block exists
  const anchorKey = selection.getAnchorKey();
  if (!anchorKey || !content.getBlockForKey(anchorKey)) {
    return null;
  }

  // Get current editor state info - wrap in try-catch for extra safety
  let currentStyles;
  let currentBlockType;
  let currentLink;

  try {
    currentStyles = editorState.getCurrentInlineStyle();
    currentBlockType = getCurrentBlockType(editorState);
    currentLink = getCurrentLink(editorState);
  } catch (error) {
    // If getting styles fails, return null to avoid rendering broken toolbar
    return null;
  }

  // Menu handlers
  const handleHeadingButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    if (headingMenuAnchor) {
      setHeadingMenuAnchor(null);
      onMenuOpenChange?.(Boolean(colorMenuAnchor));
    } else {
      setHeadingMenuAnchor(event.currentTarget);
      onMenuOpenChange?.(true);
    }
  };

  const handleColorButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    if (colorMenuAnchor) {
      setColorMenuAnchor(null);
      onMenuOpenChange?.(Boolean(headingMenuAnchor));
    } else {
      setColorMenuAnchor(event.currentTarget);
      onMenuOpenChange?.(true);
    }
  };

  // Color application with recent colors tracking
  const handleApplyTextColor = (color: string) => {
    const colorItem = TEXT_COLORS.find(c => c.color === color);
    if (colorItem && color !== 'default') {
      addRecentTextColor(colorItem);
    }
    onApplyTextColor(color);
    setColorMenuAnchor(null);
    onMenuOpenChange?.(Boolean(headingMenuAnchor));
  };

  const handleApplyBackgroundColor = (color: string) => {
    const colorItem = BACKGROUND_COLORS.find(c => c.color === color);
    if (colorItem && color !== 'default') {
      addRecentBgColor(colorItem);
    }
    onApplyBackgroundColor(color);
    setColorMenuAnchor(null);
    onMenuOpenChange?.(Boolean(headingMenuAnchor));
  };

  const handleApplyHeadingInternal = (headingStyle: string) => {
    onApplyHeading(headingStyle);
    setHeadingMenuAnchor(null);
    onMenuOpenChange?.(Boolean(colorMenuAnchor));
  };

  // Handle menu close callbacks
  const handleColorMenuClose = () => {
    setColorMenuAnchor(null);
    onMenuOpenChange?.(Boolean(headingMenuAnchor));
  };

  const handleHeadingMenuClose = () => {
    setHeadingMenuAnchor(null);
    onMenuOpenChange?.(Boolean(colorMenuAnchor));
  };

  // Render color menu
  const renderColorMenu = () => {
    if (!colorMenuAnchor) return null;

    return (
      <Menu
        id="color-menu"
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={handleColorMenuClose}
        disablePortal={false}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableScrollLock={true}
        disableAutoFocus={true}
        disableEnforceFocus={true}
        sx={{ zIndex: Z_INDEX }}
        slotProps={{
          paper: {
            onMouseDown: handleToolbarInteraction,
            onTouchStart: handleToolbarInteraction,
            sx: {
              width: 180,
              padding: 1.5,
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.95)
                : alpha(theme.palette.background.paper, 0.98),
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              boxShadow: theme.palette.mode === 'dark'
                ? `0 8px 32px ${alpha('#000000', 0.4)}, 0 2px 8px ${alpha('#000000', 0.2)}`
                : `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}, 0 2px 8px ${alpha('#000000', 0.1)}`,
              mt: 0.5,
            }
          }
        }}
      >
        {/* Recently Used Colors Section */}
        {(recentTextColors.length > 0 || recentBgColors.length > 0) && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                mb: 1,
                color: theme.palette.text.primary,
                display: 'block',
                fontWeight: 600,
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}
            >
              Recently Used
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {recentTextColors.map((color) => (
                <Tooltip key={`recent-text-${color.color}`} title={`Text: ${color.label}`} placement="top">
                  <IconButton
                    size="small"
                    onClick={() => handleApplyTextColor(color.color)}
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: color.color === 'default' ? 'transparent' : color.label === 'White' ? alpha(theme.palette.grey[400], 0.3) : alpha(color.color, 0.15),
                      color: color.color === 'default' ? theme.palette.text.primary : color.color,
                      border: `1px solid ${color.color === 'default' ? theme.palette.divider : color.color}`,
                      borderRadius: '6px',
                      p: 0,
                      minWidth: 0,
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-1px) scale(1.05)',
                        boxShadow: `0 4px 12px ${alpha(color.color === 'default' ? theme.palette.text.primary : color.color, 0.3)}`,
                      }
                    }}
                    aria-label={`Apply ${color.label} text color`}
                  >
                    A
                  </IconButton>
                </Tooltip>
              ))}
              {recentBgColors.map((color) => (
                <Tooltip key={`recent-bg-${color.color}`} title={`Background: ${color.label}`} placement="top">
                  <IconButton
                    size="small"
                    onClick={() => handleApplyBackgroundColor(color.color)}
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: color.color === 'default' ? 'transparent' : color.color,
                      border: `1px solid ${color.color === 'default' ? theme.palette.divider : alpha(color.color, 0.8)}`,
                      borderRadius: '6px',
                      p: 0,
                      minWidth: 0,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      ...(color.color === 'default' && {
                        backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.4)} calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.4)} calc(50% + 0.5px), transparent calc(50% + 0.5px))`
                      }),
                      '&:hover': {
                        transform: 'translateY(-1px) scale(1.05)',
                        boxShadow: `0 4px 12px ${alpha(color.color === 'default' ? theme.palette.text.primary : color.color, 0.4)}`,
                      }
                    }}
                    aria-label={`Apply ${color.label} background color`}
                  />
                </Tooltip>
              ))}
            </Box>
            <Divider sx={{ my: 1.5, backgroundColor: alpha(theme.palette.divider, 0.3), height: '1px' }} />
          </Box>
        )}

        {/* Text Colors Section */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{
              mb: 1,
              color: theme.palette.text.primary,
              display: 'block',
              fontWeight: 600,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}
          >
            Text Color
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(24px, 1fr))', gap: 0.5 }}>
            {TEXT_COLORS.map((color) => (
              <Tooltip key={`text-${color.color}`} title={color.label} placement="top">
                <IconButton
                  size="small"
                  onClick={() => handleApplyTextColor(color.color)}
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: color.color === 'default' ? 'transparent' : color.label === 'White' ? alpha(theme.palette.grey[400], 0.3) : alpha(color.color, 0.15),
                    color: color.color === 'default' ? theme.palette.text.primary : color.color,
                    border: `1px solid ${color.color === 'default' ? theme.palette.divider : color.color}`,
                    borderRadius: '6px',
                    p: 0,
                    minWidth: 0,
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-1px) scale(1.05)',
                      boxShadow: `0 4px 12px ${alpha(color.color === 'default' ? theme.palette.text.primary : color.color, 0.3)}`,
                    }
                  }}
                  aria-label={`Apply ${color.label} text color`}
                >
                  {color.color === 'default' ? <Typography variant="caption" sx={{ lineHeight: 1, fontSize: '0.7rem' }}>Aa</Typography> : 'A'}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </Box>

        {/* Background Colors Section */}
        <Box>
          <Typography
            variant="caption"
            sx={{
              mb: 1,
              color: theme.palette.text.primary,
              display: 'block',
              fontWeight: 600,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}
          >
            Background Color
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(24px, 1fr))', gap: 0.5 }}>
            {BACKGROUND_COLORS.map((color) => (
              <Tooltip key={`bg-${color.color}`} title={color.label} placement="top">
                <IconButton
                  size="small"
                  onClick={() => handleApplyBackgroundColor(color.color)}
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: color.color === 'default' ? 'transparent' : color.color,
                    border: `1px solid ${color.color === 'default' ? theme.palette.divider : alpha(color.color, 0.8)}`,
                    borderRadius: '6px',
                    p: 0,
                    minWidth: 0,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    ...(color.color === 'default' && {
                      backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.4)} calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.4)} calc(50% + 0.5px), transparent calc(50% + 0.5px))`
                    }),
                    '&:hover': {
                      transform: 'translateY(-1px) scale(1.05)',
                      boxShadow: `0 4px 12px ${alpha(color.color === 'default' ? theme.palette.text.primary : color.color, 0.4)}`,
                    }
                  }}
                  aria-label={`Apply ${color.label} background color`}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      </Menu>
    );
  };

  // Render heading menu
  const renderHeadingMenu = () => {
    if (!headingMenuAnchor) return null;

    return (
      <Menu
        id="heading-menu"
        anchorEl={headingMenuAnchor}
        open={Boolean(headingMenuAnchor)}
        onClose={handleHeadingMenuClose}
        disablePortal={false}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableScrollLock={true}
        disableAutoFocus={true}
        disableEnforceFocus={true}
        disableRestoreFocus={true}
        sx={{ zIndex: Z_INDEX }}
        slotProps={{
          paper: {
            onMouseDown: handleToolbarInteraction,
            onTouchStart: handleToolbarInteraction,
            sx: {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.95)
                : alpha(theme.palette.background.paper, 0.98),
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              boxShadow: theme.palette.mode === 'dark'
                ? `0 8px 32px ${alpha('#000000', 0.4)}, 0 2px 8px ${alpha('#000000', 0.2)}`
                : `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}, 0 2px 8px ${alpha('#000000', 0.1)}`,
              mt: 1,
              position: 'fixed',
              willChange: 'transform',
            }
          }
        }}
      >
        {HEADING_OPTIONS.map((option) => (
          <MenuItem
            key={option.style}
            onClick={() => handleApplyHeadingInternal(option.style)}
            selected={currentBlockType === option.style}
            sx={{
              fontWeight: option.style.includes('header') ? 'bold' : 500,
              fontSize: option.style === 'header-one' ? '1.4rem' : option.style === 'header-two' ? '1.2rem' : option.style === 'header-three' ? '1rem' : '0.85rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              borderRadius: '8px',
              margin: '2px 4px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                transform: 'translateX(4px)',
              },
              '&.Mui-selected': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.18),
                }
              }
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    );
  };

  // Common toolbar button styles
  const getToolbarButtonStyles = () => ({
    '& .MuiIconButton-root, & .MuiToggleButton-root': {
      color: theme.palette.text.secondary,
      borderRadius: '8px',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        color: theme.palette.primary.main,
        transform: 'translateY(-1px)',
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
      },
      '&.Mui-selected': {
        backgroundColor: alpha(theme.palette.primary.main, 0.12),
        color: theme.palette.primary.main,
        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.18),
          transform: 'translateY(-1px)',
          boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
        }
      }
    },
    '& .MuiDivider-root': {
      backgroundColor: alpha(theme.palette.divider, 0.3),
      margin: theme.spacing(0, 0.75),
      height: '24px',
      alignSelf: 'center',
    }
  });

  // Render toolbar content (shared between variants)
  const renderToolbarContent = () => (
    <Toolbar
      variant="dense"
      sx={{
        p: 1,
        minHeight: 'auto',
        display: 'flex',
        flexWrap: 'nowrap',
        justifyContent: variant === 'sticky' ? 'flex-start' : 'center',
        gap: 0.5,
        ...getToolbarButtonStyles(),
      }}
    >
      {/* Text Formatting */}
      <ToggleButtonGroup
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            border: 'none',
            margin: '0 2px',
            padding: '6px 8px',
            minWidth: '36px',
            height: '36px',
          }
        }}
      >
        <Tooltip title="Bold (Ctrl+B)" placement="top">
          <ToggleButton
            value="bold"
            selected={currentStyles.has('BOLD')}
            onClick={() => onToggleInlineStyle('BOLD')}
            disabled={disabled}
            aria-pressed={currentStyles.has('BOLD')}
            aria-label="Bold"
          >
            <FormatBold fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Italic (Ctrl+I)" placement="top">
          <ToggleButton
            value="italic"
            selected={currentStyles.has('ITALIC')}
            onClick={() => onToggleInlineStyle('ITALIC')}
            disabled={disabled}
            aria-pressed={currentStyles.has('ITALIC')}
            aria-label="Italic"
          >
            <FormatItalic fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Underline (Ctrl+U)" placement="top">
          <ToggleButton
            value="underline"
            selected={currentStyles.has('UNDERLINE')}
            onClick={() => onToggleInlineStyle('UNDERLINE')}
            disabled={disabled}
            aria-pressed={currentStyles.has('UNDERLINE')}
            aria-label="Underline"
          >
            <FormatUnderlined fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Heading Menu */}
      <Box>
        <Tooltip title="Heading Style" placement="top">
          <IconButton
            size="small"
            onClick={handleHeadingButtonClick}
            disabled={disabled}
            aria-haspopup="true"
            aria-controls={headingMenuAnchor ? 'heading-menu' : undefined}
            aria-expanded={Boolean(headingMenuAnchor)}
            aria-label="Heading Style"
            sx={{
              padding: '6px 8px',
              minWidth: '36px',
              height: '36px',
              margin: '0 2px',
            }}
          >
            <Title fontSize="small" />
            <ArrowDropDown fontSize="inherit" sx={{ ml: -0.5, fontSize: '16px' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* List Formatting */}
      <ToggleButtonGroup
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            border: 'none',
            margin: '0 2px',
            padding: '6px 8px',
            minWidth: '36px',
            height: '36px',
          }
        }}
      >
        <Tooltip title="Bullet List" placement="top">
          <ToggleButton
            value="bullet-list"
            selected={currentBlockType === 'unordered-list-item'}
            onClick={() => onToggleBlockType('unordered-list-item')}
            disabled={disabled}
            aria-pressed={currentBlockType === 'unordered-list-item'}
            aria-label="Bullet List"
          >
            <FormatListBulleted fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Numbered List" placement="top">
          <ToggleButton
            value="number-list"
            selected={currentBlockType === 'ordered-list-item'}
            onClick={() => onToggleBlockType('ordered-list-item')}
            disabled={disabled}
            aria-pressed={currentBlockType === 'ordered-list-item'}
            aria-label="Numbered List"
          >
            <FormatListNumbered fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Color Formatting */}
      <Box>
        <Tooltip title="Text & Background Color" placement="top">
          <IconButton
            size="small"
            onClick={handleColorButtonClick}
            disabled={disabled}
            aria-haspopup="true"
            aria-controls={colorMenuAnchor ? 'color-menu' : undefined}
            aria-expanded={Boolean(colorMenuAnchor)}
            aria-label="Text and background color"
            sx={{
              padding: '6px 8px',
              minWidth: '36px',
              height: '36px',
              margin: '0 2px',
            }}
          >
            <Palette fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Link and Clear Formatting */}
      <ToggleButtonGroup
        size="small"
        sx={{
          '& .MuiToggleButton-root, & .MuiIconButton-root': {
            border: 'none',
            margin: '0 2px',
            padding: '6px 8px',
            minWidth: '36px',
            height: '36px',
          }
        }}
      >
        <Tooltip title={currentLink ? `Edit Link: ${currentLink.url}` : "Insert Link (Ctrl+L)"} placement="top">
          <ToggleButton
            value="link"
            selected={Boolean(currentLink)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLinkClick();
            }}
            onMouseDown={handleToolbarInteraction}
            onTouchStart={handleToolbarInteraction}
            disabled={disabled}
            aria-pressed={Boolean(currentLink)}
            aria-label={currentLink ? "Edit Link" : "Insert Link"}
          >
            <Link fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Insert Image" placement="top">
          <IconButton
            size="small"
            onClick={onImageClick}
            onMouseDown={handleToolbarInteraction}
            onTouchStart={handleToolbarInteraction}
            disabled={disabled}
            aria-label="Insert Image"
          >
            <ImageIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear Formatting (Ctrl+Shift+X)" placement="top">
          <IconButton
            size="small"
            onClick={onClearFormatting}
            disabled={disabled}
            aria-label="Clear Formatting"
          >
            <FormatClear fontSize="small" />
          </IconButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Toolbar>
  );

  // Render floating variant
  if (variant === 'floating' && position) {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            top: position.top,
            left: position.left,
            zIndex: Z_INDEX,
          }}
        >
          <MuiPaper
            ref={toolbarRef as React.RefObject<HTMLDivElement>}
            onMouseDown={handleToolbarInteraction}
            onTouchStart={handleToolbarInteraction}
            elevation={0}
            sx={{
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.95)
                : alpha(theme.palette.background.paper, 0.98),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              boxShadow: theme.palette.mode === 'dark'
                ? `0 8px 32px ${alpha('#000000', 0.4)}, 0 2px 8px ${alpha('#000000', 0.2)}`
                : `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}, 0 2px 8px ${alpha('#000000', 0.1)}`,
              transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
              animation: 'floatingToolbarFadeIn 0.15s ease-out forwards',
              '@keyframes floatingToolbarFadeIn': {
                '0%': { opacity: 0, transform: 'translateY(8px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' }
              },
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark'
                  ? `0 12px 40px ${alpha('#000000', 0.5)}, 0 4px 12px ${alpha('#000000', 0.3)}`
                  : `0 12px 40px ${alpha(theme.palette.primary.main, 0.2)}, 0 4px 12px ${alpha('#000000', 0.15)}`,
                transform: 'translateY(-1px)',
              }
            }}
            role="toolbar"
            aria-label="Text Formatting"
          >
            {renderToolbarContent()}
          </MuiPaper>
        </div>
        {renderHeadingMenu()}
        {renderColorMenu()}
      </>
    );
  }

  // Render sticky variant
  return (
    <>
      <Box
        ref={toolbarRef as React.RefObject<HTMLDivElement>}
        onMouseDown={handleToolbarInteraction}
        onTouchStart={handleToolbarInteraction}
        sx={{
          position: 'sticky',
          ...(stickyPosition === 'top' ? { top: 0 } : { bottom: 0 }),
          zIndex: Z_INDEX - 100,
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.95)
            : alpha(theme.palette.background.paper, 0.98),
          backdropFilter: 'blur(20px)',
          ...(stickyPosition === 'top'
            ? { borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}` }
            : { borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}` }),
          boxShadow: stickyPosition === 'top'
            ? `0 2px 8px ${alpha('#000000', 0.1)}`
            : `0 -2px 8px ${alpha('#000000', 0.1)}`,
        }}
        role="toolbar"
        aria-label="Text Formatting"
      >
        {renderToolbarContent()}
      </Box>
      {renderHeadingMenu()}
      {renderColorMenu()}
    </>
  );
};

export default EditorToolbar;
