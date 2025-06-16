import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
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
  FormatClear
} from '@mui/icons-material';
import { Editor, EditorState, convertToRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

// Import utilities, constants, and hooks
import { createEditorStateFromValue } from './RichTextEditor/utils/draftUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from './RichTextEditor/constants/colors';
import { HEADING_OPTIONS } from './RichTextEditor/constants/headings';
import { useRecentColors } from './RichTextEditor/hooks/useRecentColors';
import { useFloatingToolbar } from './RichTextEditor/hooks/useFloatingToolbar';

// Import new utility functions
import {
  getCurrentLink,
  createLinkEntity,
  removeLinkEntity
} from './RichTextEditor/utils/linkUtils';
import {
  toggleInlineStyle,
  toggleBlockType,
  applyTextColor,
  applyBackgroundColor,
  applyHeading,
  clearFormatting,
  getCurrentBlockType,
  blockStyleFn,
  restoreScrollAndFocus
} from './RichTextEditor/utils/editorActions';
import { keyBindingFn, handleKeyCommand } from './RichTextEditor/utils/keyboardUtils';
import { createStyleMap, handleToolbarInteraction } from './RichTextEditor/utils/styleUtils';
import {
  createHeadingButtonClickHandler,
  createColorButtonClickHandler,
  createMenuCloseHandler
} from './RichTextEditor/utils/menuUtils';
import {
  handleLinkDialogOpen,
  handleLinkDialogClose
} from './RichTextEditor/utils/linkDialogUtils';
import { createDecorator } from './RichTextEditor/utils/decoratorUtils';

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  disabled?: boolean;
  hideCharacterCount?: boolean;
  maxLength?: number;
  // Optional props for trade link navigation
  calendarId?: string;
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}






const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text here...',
  label,
  helperText,
  minHeight = 150,
  maxHeight = 'none',
  disabled = false,
  hideCharacterCount = false,
  maxLength,
  calendarId,
  trades,
  onOpenGalleryMode
}) => {
  const theme = useTheme();

  // Refs must be declared before any useEffect that uses them
  const editorRef = useRef<Editor>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef<string | undefined>(value);
  const savedScrollPositionRef = useRef<number>(0);

  // Create decorator with props
  const decorator = useMemo(() => createDecorator(calendarId, trades, onOpenGalleryMode), [calendarId, trades, onOpenGalleryMode]);

  const [editorState, setEditorState] = useState(() => {
    const initialState = createEditorStateFromValue(value);
    return EditorState.set(initialState, { decorator });
  });
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  // Update editor state when value prop changes (for controlled component behavior)
  useEffect(() => {
    if (value !== previousValueRef.current) {
      previousValueRef.current = value;

      if (value !== undefined) {
        const newEditorState = createEditorStateFromValue(value);
        const newEditorStateWithDecorator = EditorState.set(newEditorState, { decorator });
        // Only update if the content is actually different to avoid infinite loops
        const currentContent = convertToRaw(editorState.getCurrentContent());
        const newContent = convertToRaw(newEditorStateWithDecorator.getCurrentContent());

        if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
          setEditorState(newEditorStateWithDecorator);
        }
      }
    }
  }, [value, editorState, decorator]);

  // Effect to restore scroll position when link dialog closes
  useEffect(() => {
    if (!linkDialogOpen && savedScrollPositionRef.current > 0) {
      const editorElement = editorWrapperRef.current;
      if (editorElement) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          editorElement.scrollTop = savedScrollPositionRef.current;
          // Reset the saved position
          savedScrollPositionRef.current = 0;
          // Restore focus to editor
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.focus();
            }
          }, 50);
        });
      }
    }
  }, [linkDialogOpen]);

  // Use custom hooks for better organization
  const {
    recentTextColors,
    recentBgColors,
    addRecentTextColor,
    addRecentBgColor
  } = useRecentColors();

  const {
    showFloatingToolbar,
    floatingToolbarPosition
  } = useFloatingToolbar({
    disabled,
    editorWrapperRef,
    toolbarRef,
    colorMenuAnchor,
    headingMenuAnchor,
    linkDialogOpen,
  });

  // Focus the editor when clicked
  const focusEditor = () => {
    if (editorRef.current && !disabled) {
      editorRef.current.focus();
    }
  };



  // Handle editor state changes
  const handleEditorChange = (state: EditorState) => {
    const prevContentState = editorState.getCurrentContent();
    const newContentState = state.getCurrentContent();

    // Check character limit if maxLength is specified
    if (maxLength && newContentState.getPlainText().length > maxLength) {
      // If the new content exceeds the limit, don't update the state
      return;
    }

    setEditorState(state);

    if (onChange) {
      // Only save if content has actually changed (prevents unnecessary updates)
      // Compare the raw content to detect actual changes
      const prevRaw = convertToRaw(prevContentState);
      const newRaw = convertToRaw(newContentState);

      if (JSON.stringify(prevRaw) !== JSON.stringify(newRaw)) {
        onChange(JSON.stringify(newRaw));
      }
    }
  };

  // Create action handlers using utilities
  const handleToggleInlineStyle = (style: string) => {
    const newState = toggleInlineStyle(editorState, style, editorRef);
    handleEditorChange(newState);
  };

  const handleToggleBlockType = (blockType: string) => {
    const newState = toggleBlockType(editorState, blockType, editorRef);
    handleEditorChange(newState);
  };

  // Apply text color using utility
  const handleApplyTextColor = (color: string) => {
    const { newState, scrollTop } = applyTextColor(
      editorState,
      color,
      editorRef,
      addRecentTextColor,
      TEXT_COLORS
    );

    handleEditorChange(newState);
    setColorMenuAnchor(null);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Apply background color using utility
  const handleApplyBackgroundColor = (color: string) => {
    const { newState, scrollTop } = applyBackgroundColor(
      editorState,
      color,
      editorRef,
      addRecentBgColor,
      BACKGROUND_COLORS
    );

    handleEditorChange(newState);
    setColorMenuAnchor(null);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Create menu handlers using utilities
  const handleHeadingButtonClick = createHeadingButtonClickHandler(
    headingMenuAnchor,
    setHeadingMenuAnchor,
    editorRef
  );

  const handleColorButtonClick = createColorButtonClickHandler(
    colorMenuAnchor,
    setColorMenuAnchor,
    editorRef
  );



  // Apply heading using utility
  const handleApplyHeading = (headingStyle: string) => {
    const { newState, scrollTop } = applyHeading(editorState, headingStyle, editorRef);
    handleEditorChange(newState);
    setHeadingMenuAnchor(null);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Clear formatting using utility
  const handleClearFormatting = () => {
    const newState = clearFormatting(editorState, editorRef);
    if (newState) {
      handleEditorChange(newState);
    }
  };

  // Link handlers using utilities
  const handleLinkClick = () => {
    handleLinkDialogOpen(
      editorState,
      editorWrapperRef,
      savedScrollPositionRef,
      setLinkText,
      setLinkUrl,
      setLinkDialogOpen
    );
  };

  const insertLink = () => {
    if (!linkUrl.trim()) return;

    const newState = createLinkEntity(editorState, linkUrl, linkText);
    handleEditorChange(newState);

    handleLinkDialogClose(setLinkDialogOpen, setLinkText, setLinkUrl);

    // Restore focus
    // setTimeout(() => {
    //   if (editorRef.current) {
    //     editorRef.current.focus();
    //   }
    // }, 100);
  };

  const removeLink = () => {
    const newState = removeLinkEntity(editorState);
    handleEditorChange(newState);

    // Restore focus
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 0);
  };



  // Create style map using utility
  const styleMap = createStyleMap(theme, TEXT_COLORS, BACKGROUND_COLORS);

  // Create keyboard command handler using utility
  const handleKeyCommandWrapper = (command: string, state: EditorState): 'handled' | 'not-handled' => {
    return handleKeyCommand(command, state, {
      clearFormatting: handleClearFormatting,
      handleLinkClick,
      removeLink,
      getCurrentLink: () => getCurrentLink(editorState),
      handleEditorChange
    });
  };


  // Render color menu
  const renderColorMenu = () => {
    // Use a fragment or null to avoid rendering issues when closed
    if (!colorMenuAnchor) return null;

    return (
      <Menu
        id="color-menu" // Added ID for aria-controls
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={() => {
          setColorMenuAnchor(null);
          // Don't check selection when menu closes to prevent unwanted scrolling
          // The toolbar will be repositioned naturally when user interacts with editor again
          // Refocus editor after closing menu only if editor still has focus logically
          if (editorState.getSelection().getHasFocus()) {
             setTimeout(() => editorRef.current?.focus(), 0);
          }
        }}
        disablePortal={false} // Keep portal for proper positioning
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableScrollLock={true} // Prevent scroll lock that might cause jumps
        disableAutoFocus={true} // Prevent auto focus that might cause scroll
        disableEnforceFocus={true} // Prevent focus enforcement
        slotProps={{
          paper: {
            onMouseDown: handleToolbarInteraction, // Use interaction handler
            onTouchStart: handleToolbarInteraction, // Use interaction handler
            sx: {
              width: 200, // Slightly wider
              padding: 1.5,
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.98)
                : alpha(theme.palette.background.paper, 0.98),
              backdropFilter: 'blur(8px)',
              borderRadius: 1,
              boxShadow: theme.shadows[6], // Slightly more shadow for menus
              zIndex: 1400, // Higher than the toolbar
              mt: 0.5, // Small margin top
            }
          }
        }}
      >
        {/* Recently Used Colors Section */}
        {(recentTextColors.length > 0 || recentBgColors.length > 0) && (
            <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ mb: 1, color: theme.palette.text.secondary, display: 'block' }}>
                    Recently Used
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {/* Text Colors with 'A' */}
                    {recentTextColors.map((color) => (
                    <Tooltip key={`recent-text-${color.color}`} title={`Text: ${color.label}`}>
                        <IconButton
                        size="small"
                        onClick={() => handleApplyTextColor(color.color)}
                        sx={{
                            width: 24, height: 24,
                            backgroundColor: color.color === 'default' ? 'transparent' : color.label === 'White' ? "gray" : alpha(color.color, 0.1),
                            color: color.color,
                            border: `1px solid ${color.color}`,
                            borderRadius: 1, p: 0, minWidth: 0,
                            '&:hover': { opacity: 0.8 },
                            fontSize: '0.75rem', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        aria-label={`Apply ${color.label} text color`}
                        >
                        A
                        </IconButton>
                    </Tooltip>
                    ))}
                    {/* Background Colors */}
                    {recentBgColors.map((color) => (
                    <Tooltip key={`recent-bg-${color.color}`} title={`Background: ${color.label}`}>
                        <IconButton
                        size="small"
                        onClick={() => handleApplyBackgroundColor(color.color)}
                        sx={{
                            width: 24, height: 24,
                            backgroundColor: color.color,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1, p: 0, minWidth: 0,
                            '&:hover': { opacity: 0.8 }
                        }}
                         aria-label={`Apply ${color.label} background color`}
                        />
                    </Tooltip>
                    ))}
                </Box>
                 <Divider sx={{ my: 1.5 }} />
            </Box>
        )}

        {/* Text Colors Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ mb: 1, color: theme.palette.text.secondary, display: 'block' }}>
            Text Color
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(24px, 1fr))', gap: 0.5 }}>
            {TEXT_COLORS.map((color) => (
              <Tooltip key={`text-${color.color}`} title={color.label}>
                <IconButton
                  size="small"
                  onClick={() => handleApplyTextColor(color.color)}
                  sx={{
                    width: 24, height: 24,
                    backgroundColor: color.color === 'default' ? 'transparent' : color.label === 'White' ? "gray" : alpha(color.color, 0.1),
                    color: color.color === 'default' ? theme.palette.text.primary : color.color,
                    border: color.color === 'default'
                      ? `1px solid ${theme.palette.divider}`
                      : `1px solid ${color.color}`,
                    borderRadius: 1, p: 0, minWidth: 0,
                    '&:hover': {
                      opacity: 0.8,
                      backgroundColor: color.color === 'default' ? 'transparent' : color.label === 'White' ? "gray" : color.color
                    },
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  aria-label={`Apply ${color.label} text color`}
                >
                  {/* Use 'A' for text color indication */}
                  {color.color === 'default' ? <Typography variant="caption" sx={{lineHeight: 1}}>Aa</Typography> : 'A'}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </Box>

        {/* Background Colors Section */}
        <Box>
          <Typography variant="caption" sx={{ mb: 1, color: theme.palette.text.secondary, display: 'block' }}>
            Background Color
          </Typography>
           <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(24px, 1fr))', gap: 0.5 }}>
            {BACKGROUND_COLORS.map((color) => (
              <Tooltip key={`bg-${color.color}`} title={color.label}>
                <IconButton
                  size="small"
                  onClick={() => handleApplyBackgroundColor(color.color)}
                  sx={{
                    width: 24, height: 24,

                    backgroundColor: color.color === 'default' ? 'transparent' : alpha(color.color,0.8),
                    border: `1px solid ${color.color === 'default' ? theme.palette.divider :color.color}`,
                    borderRadius: 1, p: 0, minWidth: 0,
                    '&:hover': { opacity: 0.8, backgroundColor: color.color === 'default' ? 'transparent' : color.color },
                    // Use slash for default background
                    ...(color.color === 'default' && {
                        backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.3)} calc(50% - 0.5px), ${alpha(theme.palette.text.primary, 0.3)} calc(50% + 0.5px), transparent calc(50% + 0.5px))`
                    })
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
    // Use a fragment or null to avoid rendering issues when closed
    if (!headingMenuAnchor) return null;

    const currentBlock = getCurrentBlockType(editorState);

    return (
      <Menu
        id="heading-menu" // Added ID for aria-controls
        anchorEl={headingMenuAnchor}
        open={Boolean(headingMenuAnchor)}
        onClose={() => {
          setHeadingMenuAnchor(null);
          // Don't check selection when menu closes to prevent unwanted scrolling
          // The toolbar will be repositioned naturally when user interacts with editor again
          if (editorState.getSelection().getHasFocus()) {
             setTimeout(() => editorRef.current?.focus(), 0);
          }
        }}
        disablePortal={false} // Keep portal for proper positioning
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableScrollLock={true} // Prevent scroll lock that might cause jumps
        disableAutoFocus={true} // Prevent auto focus that might cause scroll
        disableEnforceFocus={true} // Prevent focus enforcement
        slotProps={{
          paper: {
            onMouseDown: handleToolbarInteraction,
            onTouchStart: handleToolbarInteraction,
            sx: {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.98)
                : alpha(theme.palette.background.paper, 0.98),
              backdropFilter: 'blur(8px)',
              borderRadius: 1,
              boxShadow: theme.shadows[6],
              zIndex: 1400, // Higher than the toolbar
              mt: 0.5,
            }
          }
        }}
      >
        {HEADING_OPTIONS.map((option) => (
          <MenuItem
            key={option.style}
            onClick={() => handleApplyHeading(option.style)}
            selected={currentBlock === option.style}
            sx={{
                fontWeight: option.style.includes('header') ? 'bold' : 500, // Use bold for headers, medium for normal text
                fontSize: option.style === 'header-one' ? '1.4rem' : option.style === 'header-two' ? '1.2rem' : option.style === 'header-three' ? '1rem' : '0.85rem',
                fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    );
  };

  // Render the floating toolbar
  const renderFloatingToolbar = () => {
    // Only render if toolbar should be visible and we have position data
    if (!showFloatingToolbar || !floatingToolbarPosition) return null;

    const currentStyles = editorState.getCurrentInlineStyle();
    const currentBlockType = getCurrentBlockType(editorState);
    const currentLink = getCurrentLink(editorState);

    return (
      // Using div for positioning
      <div
        style={{
          position: 'absolute',
          top: floatingToolbarPosition.top,
          left: floatingToolbarPosition.left,
          zIndex: 1300, // Ensure above editor content but below menus
        }}
        // Fade in/out via CSS animation on the Paper instead of Fade component
      >
        <MuiPaper
          ref={toolbarRef}
          onMouseDown={handleToolbarInteraction}
          onTouchStart={handleToolbarInteraction}
          elevation={6}
          sx={{
            borderRadius: '8px', // Slightly less rounded
            overflow: 'hidden',
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.default, 0.9) // Slightly darker background
              : alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme.palette.divider}`, // Use divider color
            boxShadow: theme.shadows[4], // Standard shadow
            transition: 'opacity 0.15s ease-out, transform 0.15s ease-out', // Smoother transition
            animation: 'floatingToolbarFadeIn 0.15s ease-out forwards',
            '@keyframes floatingToolbarFadeIn': {
              '0%': { opacity: 0, transform: 'translateY(8px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            },
            // Style for hiding (could use display: none or opacity: 0)
            // opacity: showFloatingToolbar ? 1 : 0,
            // pointerEvents: showFloatingToolbar ? 'auto' : 'none',
          }}
          role="toolbar"
          aria-label="Text Formatting"
        >
            <Toolbar
              variant="dense"
              sx={{
                p: 0.5,
                minHeight: 'auto',
                display: 'flex',
                flexWrap: 'nowrap',
                justifyContent: 'center',
                 // Ensure buttons are visible against backdrop
                '& .MuiIconButton-root, & .MuiToggleButton-root': {
                   color: theme.palette.text.secondary, // Use secondary text color for icons
                   '&:hover': {
                     backgroundColor: alpha(theme.palette.action.hover, 0.1),
                     color: theme.palette.text.primary, // Darken icon on hover
                   },
                   '&.Mui-selected': {
                     backgroundColor: alpha(theme.palette.primary.main, 0.15),
                     color: theme.palette.primary.main, // Use primary color for selected
                     '&:hover': {
                       backgroundColor: alpha(theme.palette.primary.main, 0.25),
                     }
                   }
                 },
              }}
            >
              {/* Text Formatting */}
              <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
                 <Tooltip title="Bold (Ctrl+B)">
                    <ToggleButton
                        value="bold"
                        selected={currentStyles.has('BOLD')}
                        onClick={() => handleToggleInlineStyle('BOLD')}
                        disabled={disabled}
                        aria-pressed={currentStyles.has('BOLD')}
                        aria-label="Bold"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatBold fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
                 <Tooltip title="Italic (Ctrl+I)">
                    <ToggleButton
                        value="italic"
                        selected={currentStyles.has('ITALIC')}
                        onClick={() => handleToggleInlineStyle('ITALIC')}
                        disabled={disabled}
                        aria-pressed={currentStyles.has('ITALIC')}
                        aria-label="Italic"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatItalic fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
                 <Tooltip title="Underline (Ctrl+U)">
                    <ToggleButton
                        value="underline"
                        selected={currentStyles.has('UNDERLINE')}
                        onClick={() => handleToggleInlineStyle('UNDERLINE')}
                        disabled={disabled}
                        aria-pressed={currentStyles.has('UNDERLINE')}
                        aria-label="Underline"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatUnderlined fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
              </ToggleButtonGroup>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

              {/* Heading Menu */}
              <Box sx={{ mr: 0.5 }}>
                <Tooltip title="Heading Style">
                    <IconButton
                        size="small"
                        onClick={handleHeadingButtonClick}
                        disabled={disabled}
                        aria-haspopup="true"
                        aria-controls={headingMenuAnchor ? 'heading-menu' : undefined}
                        aria-expanded={Boolean(headingMenuAnchor)}
                        aria-label="Heading Style"
                        sx={{ padding: '4px 6px' }}
                    >
                        <Title fontSize="small" /><ArrowDropDown fontSize="inherit" sx={{ ml: -0.5 }}/>
                    </IconButton>
                 </Tooltip>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

              {/* List Formatting */}
               <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
                 <Tooltip title="Bullet List">
                    <ToggleButton
                        value="bullet-list"
                        selected={currentBlockType === 'unordered-list-item'}
                        onClick={() => handleToggleBlockType('unordered-list-item')}
                        disabled={disabled}
                        aria-pressed={currentBlockType === 'unordered-list-item'}
                        aria-label="Bullet List"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatListBulleted fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
                 <Tooltip title="Numbered List">
                    <ToggleButton
                        value="number-list"
                        selected={currentBlockType === 'ordered-list-item'}
                        onClick={() => handleToggleBlockType('ordered-list-item')}
                        disabled={disabled}
                        aria-pressed={currentBlockType === 'ordered-list-item'}
                        aria-label="Numbered List"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatListNumbered fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
               </ToggleButtonGroup>

               <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

               {/* Color Formatting */}
               <Box>
                 <Tooltip title="Text & Background Color">
                    <IconButton
                        size="small"
                        onClick={handleColorButtonClick}
                        disabled={disabled}
                        aria-haspopup="true"
                        aria-controls={colorMenuAnchor ? 'color-menu' : undefined}
                        aria-expanded={Boolean(colorMenuAnchor)}
                        aria-label="Text and background color"
                         sx={{ padding: '4px 6px' }}
                    >
                        <Palette fontSize="small" />
                    </IconButton>
                 </Tooltip>
               </Box>

               <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

               {/* Link and Clear Formatting */}
               <ToggleButtonGroup size="small" sx={{ mr: 0.5 }}>
                 <Tooltip title={currentLink ? `Edit Link: ${currentLink.url}` : "Insert Link (Ctrl+L)"}>
                    <ToggleButton
                        value="link"
                        selected={Boolean(currentLink)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLinkClick();
                        }}
                        onMouseDown={handleToolbarInteraction}
                        onTouchStart={handleToolbarInteraction}
                        disabled={disabled}
                        aria-pressed={Boolean(currentLink)}
                        aria-label={currentLink ? "Edit Link" : "Insert Link"}
                        sx={{
                          padding: '4px 6px',
                          ...(currentLink && {
                            backgroundColor: alpha(theme.palette.primary.main, 0.15),
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.25),
                            }
                          })
                        }}
                    >
                        <Link fontSize="small" />
                    </ToggleButton>
                 </Tooltip>
                 <Tooltip title="Clear Formatting (Ctrl+Shift+X)">
                    <IconButton
                        size="small"
                        onClick={handleClearFormatting}
                        disabled={disabled}
                        aria-label="Clear Formatting"
                        sx={{ padding: '4px 6px' }}
                    >
                        <FormatClear fontSize="small" />
                    </IconButton>
                 </Tooltip>
               </ToggleButtonGroup>


            </Toolbar>
        </MuiPaper>
      </div>
    );
  };


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {label && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
          {label}
        </Typography>
      )}

      {/* Main Editor Wrapper */}
      <Box
        sx={{
          opacity: disabled ? 0.6 : 1,
          position: 'relative', // Crucial for absolute positioning of toolbar

          overflow: 'hidden', // Clip potential overflows (like toolbar if not positioned carefully)
          transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          
        }}
      >
        {/* Editor Scrollable Area */}
        <Box
          ref={editorWrapperRef}
          onClick={focusEditor}
          sx={{
            padding: theme.spacing(1.2, 1.8), // Reduced padding to match smaller text
            minHeight,
            maxHeight,
            overflow: 'auto', // Keep scrolling internal to this Box
            cursor: disabled ? 'not-allowed' : 'text',
            position: 'relative', // Needed for placeholder positioning
            ...scrollbarStyles(theme),

            // --- Draft JS Editor Styles ---
            '& .public-DraftEditorPlaceholder-root': {
                color: theme.palette.text.disabled,
                position: 'absolute',
                top: theme.spacing(1.2), // Match reduced padding
                left: theme.spacing(1.8), // Match reduced padding
                zIndex: 0, // Below content
                pointerEvents: 'none', // Don't interfere with clicks
                opacity: 0.8,
                fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
                fontWeight: 500, // Medium weight for thicker text
            },
            '& .public-DraftEditor-content': {
              minHeight: typeof minHeight === 'number' ? `calc(${minHeight}px - ${theme.spacing(3)})` : `calc(${minHeight} - ${theme.spacing(3)})`, // Adjust minHeight based on padding
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontSize: '1rem',
              lineHeight: 1.3, // Reduced line height to match the image
              fontWeight: 500, // Medium weight for thicker text
              color: theme.palette.text.primary,
              position: 'relative',
              zIndex: 1, // Above placeholder
              // Selection color handled globally or via theme usually
              '& *::selection': {
                 backgroundColor: alpha(theme.palette.primary.main, 0.3),
              },
            },
            // Custom Block Styles
            '& .RichEditor-h1': {
              fontSize: '1.4rem', fontWeight: 'bold', margin: '0.8rem 0 0.4rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h2': {
              fontSize: '1.2rem', fontWeight: 'bold', margin: '0.6rem 0 0.3rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h3': {
              fontSize: '1rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem', fontStyle: 'italic',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-ul, & .RichEditor-ol': {
              marginLeft: '1.5rem', // Reduced indentation for lists
              marginBlockStart: '0.4em',
              marginBlockEnd: '0.4em',
              paddingInlineStart: '0', // Reset browser default padding
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontWeight: 500, // Medium weight for thicker text
            },
            '& .RichEditor-ul li, & .RichEditor-ol li': {
              margin: '0.2rem 0',
              paddingLeft: '0.4rem', // Reduced space between bullet/number and text
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontWeight: 500, // Medium weight for thicker text
            },
             '& .RichEditor-ul li::marker': { // Style bullets if needed
                 // content: '"• "';
                 // color: theme.palette.text.secondary;
             },
             '& .RichEditor-ol': { // Ensure ol counters work
                 // listStyleType: 'decimal';
             },
             // Link styles - enhanced visual feedback
             '& .rich-editor-link': {
               color: `${theme.palette.primary.main} !important`,
               textDecoration: 'underline !important',
               cursor: 'pointer !important',
               backgroundColor: `${alpha(theme.palette.primary.main, 0.08)} !important`,
               padding: '2px 4px !important',
               borderRadius: '4px !important',
               border: `1px solid ${alpha(theme.palette.primary.main, 0.2)} !important`,
               display: 'inline-block !important',
               transition: 'all 0.2s ease-in-out !important',
               margin: '0 1px !important',
               fontWeight: '500 !important',
               '&:hover': {
                 color: `${theme.palette.primary.dark} !important`,
                 backgroundColor: `${alpha(theme.palette.primary.main, 0.15)} !important`,
                 borderColor: `${alpha(theme.palette.primary.main, 0.4)} !important`,
                 transform: 'translateY(-1px) !important',
                 boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)} !important`,
               },
               '&:active': {
                 transform: 'translateY(0px) !important',
                 backgroundColor: `${alpha(theme.palette.primary.main, 0.2)} !important`,
                 boxShadow: `0 1px 4px ${alpha(theme.palette.primary.main, 0.3)} !important`,
               }
             }
          }}
        >
          <Editor
            ref={editorRef}
            editorState={editorState}
            onChange={handleEditorChange}
            placeholder={placeholder}
            customStyleMap={styleMap}
            blockStyleFn={blockStyleFn}
            handleKeyCommand={handleKeyCommandWrapper}
            keyBindingFn={keyBindingFn}
            readOnly={disabled}
            spellCheck={true}
          />
        </Box>

        {/* Render the floating toolbar absolutely positioned relative to the main wrapper */}
        {renderFloatingToolbar()}

      </Box>

      {/* Render the menus (outside the main editor box, managed by MUI Menu logic) */}
      {renderHeadingMenu()}
      {renderColorMenu()}

      {/* Link Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={false}
        disableRestoreFocus={true}
      >
        <DialogTitle>{getCurrentLink(editorState) ? 'Edit Link' : 'Insert Link'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Link Text"
            fullWidth
            variant="outlined"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            sx={{ mb: 2 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkUrl.trim()) {
                e.preventDefault();
                insertLink();
              }
            }}
          />
          <TextField
            margin="dense"
            label="URL"
            fullWidth
            variant="outlined"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkUrl.trim()) {
                e.preventDefault();
                insertLink();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>
            Cancel
          </Button>
          {getCurrentLink(editorState) && (
            <Button
              onClick={() => {
                removeLink();
                setLinkDialogOpen(false);
                setLinkText('');
                setLinkUrl('');
              }}
              color="error"
              variant="outlined"
            >
              Remove Link
            </Button>
          )}
          <Button
            onClick={insertLink}
            variant="contained"
            disabled={!linkUrl.trim()}
          >
            {getCurrentLink(editorState) ? 'Update Link' : 'Insert Link'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Helper text and character count */}
      {(helperText || !hideCharacterCount) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
          {helperText && (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          )}
          {!hideCharacterCount && (() => {
            const currentLength = editorState.getCurrentContent().getPlainText().length;
            const isNearLimit = maxLength && currentLength > maxLength * 0.8;
            const isAtLimit = maxLength && currentLength >= maxLength;

            return (
              <Typography
                variant="caption"
                sx={{
                  ml: 'auto',
                  color: isAtLimit ? 'error.main' : isNearLimit ? 'warning.main' : 'text.secondary'
                }}
              >
                {currentLength}{maxLength ? ` / ${maxLength}` : ''} characters
              </Typography>
            );
          })()}
        </Box>
      )}
    </Box>
  );
};

export default RichTextEditor;