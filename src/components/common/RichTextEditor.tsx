import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Paper as MuiPaper
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
  Palette
} from '@mui/icons-material';
import { Editor, EditorState, RichUtils, convertToRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

// Import utilities, constants, and hooks
import { createEditorStateFromValue } from './RichTextEditor/utils/draftUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from './RichTextEditor/constants/colors';
import { HEADING_OPTIONS } from './RichTextEditor/constants/headings';
import { useRecentColors } from './RichTextEditor/hooks/useRecentColors';
import { useFloatingToolbar } from './RichTextEditor/hooks/useFloatingToolbar';

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  disabled?: boolean;
}




const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text here...',
  label,
  helperText,
  minHeight = 150,
  maxHeight = 'none',
  disabled = false
}) => {
  const theme = useTheme();
  const [editorState, setEditorState] = useState(() => createEditorStateFromValue(value));

  // Update editor state when value prop changes (for controlled component behavior)
  useEffect(() => {
    if (value !== previousValueRef.current) {
      previousValueRef.current = value;

      if (value !== undefined) {
        const newEditorState = createEditorStateFromValue(value);
        // Only update if the content is actually different to avoid infinite loops
        const currentContent = convertToRaw(editorState.getCurrentContent());
        const newContent = convertToRaw(newEditorState.getCurrentContent());

        if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
          setEditorState(newEditorState);
        }
      }
    }
  }, [value]);

  const editorRef = useRef<Editor>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef<string | undefined>(value);
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);

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



   // Function to prevent editor blur/selection clear when interacting with toolbar
   const handleToolbarInteraction = (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault(); // Prevent editor losing focus
      // event.stopPropagation(); // Usually not needed unless nested click handlers conflict
   };


  // Toggle inline styles (bold, italic, underline)
  const toggleInlineStyle = (style: string) => {
    handleEditorChange(RichUtils.toggleInlineStyle(editorState, style));
     // Keep focus on editor after applying style
     setTimeout(() => editorRef.current?.focus(), 0);
  };

  // Toggle block types (headings, lists)
  const toggleBlockType = (blockType: string) => {
    // Get current styles to preserve them
    const currentStyles = editorState.getCurrentInlineStyle();

    // Apply the block type change
    let nextEditorState = RichUtils.toggleBlockType(editorState, blockType);

    // Preserve text color styles by re-applying them
    const textColorStyles = currentStyles.filter((style): style is string =>
      style !== undefined && style.startsWith('TEXT_COLOR_')
    ).toArray();

    // Re-apply each text color style
    textColorStyles.forEach(style => {
      nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
    });

    // Update the editor state
    handleEditorChange(nextEditorState);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

   // Apply text color
   const applyTextColor = (color: string) => {
    // Store current scroll position before applying color
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    const currentStyle = editorState.getCurrentInlineStyle();
    let nextEditorState = editorState;

    // Remove any existing text color styles in the selection
    const textColorStyles = currentStyle.filter((style): style is string =>
        style !== undefined && style.startsWith('TEXT_COLOR_')
    ).toArray();
    textColorStyles.forEach(style => {
        nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
    });

    // Apply the new text color if it's not default
    if (color !== 'default') {
        const newStyle = `TEXT_COLOR_${color.replace('#', '')}`;
        nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, newStyle);

        // Update recently used text colors
        const colorObj = TEXT_COLORS.find(c => c.color === color);
        if (colorObj) {
            addRecentTextColor(colorObj);
        }
    }

    handleEditorChange(nextEditorState);
    setColorMenuAnchor(null);

    // Restore scroll position and focus
    setTimeout(() => {
      if (editorElement) {
        editorElement.scrollTop = scrollTop;
      }
      editorRef.current?.focus();
    }, 0);
   };

    // Apply background color
    const applyBackgroundColor = (color: string) => {
        // Store current scroll position before applying color
        const editorElement = editorRef.current?.editor;
        const scrollTop = editorElement?.scrollTop || 0;

        const currentStyle = editorState.getCurrentInlineStyle();
        let nextEditorState = editorState;

        // Remove any existing background color styles in the selection
        const bgColorStyles = currentStyle.filter((style): style is string =>
            style !== undefined && style.startsWith('BG_COLOR_')
        ).toArray();
        bgColorStyles.forEach(style => {
            nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
        });

        // Apply the new background color if it's not default
        if (color !== 'default') {
            const newStyle = `BG_COLOR_${color.replace('#', '')}`;
            nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, newStyle);

            // Update recently used background colors
            const colorObj = BACKGROUND_COLORS.find(c => c.color === color);
            if (colorObj) {
                addRecentBgColor(colorObj);
            }
        }

        handleEditorChange(nextEditorState);
        setColorMenuAnchor(null);

        // Restore scroll position and focus
        setTimeout(() => {
          if (editorElement) {
            editorElement.scrollTop = scrollTop;
          }
          editorRef.current?.focus();
        }, 0);
    };

  // Handle menu anchor button clicks (toggle open/close)
  const handleHeadingButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Store current scroll position before opening menu
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    if (headingMenuAnchor) {
      setHeadingMenuAnchor(null); // Close if already open
       setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setHeadingMenuAnchor(event.currentTarget); // Open if closed

      // Restore scroll position after menu opens
      setTimeout(() => {
        if (editorElement) {
          editorElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  };

  const handleColorButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Store current scroll position before opening menu
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    if (colorMenuAnchor) {
      setColorMenuAnchor(null); // Close if already open
       setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setColorMenuAnchor(event.currentTarget); // Open if closed

      // Restore scroll position after menu opens
      setTimeout(() => {
        if (editorElement) {
          editorElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  };

  // Apply heading style
  const applyHeading = (headingStyle: string) => {
    // Store current scroll position before applying heading
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    const currentStyles = editorState.getCurrentInlineStyle();

    // Apply the block type change
    let nextEditorState = RichUtils.toggleBlockType(editorState, headingStyle);

    // Preserve text color styles by re-applying them
    // This is necessary because sometimes toggling block types can affect inline styles
    const textColorStyles = currentStyles.filter((style): style is string =>
      style !== undefined && style.startsWith('TEXT_COLOR_')
    ).toArray();

    // Re-apply each text color style
    textColorStyles.forEach(style => {
      nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
    });

    // Update the editor state
    handleEditorChange(nextEditorState);

    // Close menu and restore scroll position
    setHeadingMenuAnchor(null);
    setTimeout(() => {
      if (editorElement) {
        editorElement.scrollTop = scrollTop;
      }
      editorRef.current?.focus();
    }, 0);
  };

  // Custom style map for colors
  const styleMap: Record<string, React.CSSProperties> = {};
  // Add text colors to the style map
  TEXT_COLORS.forEach(color => {
    if (color.color !== 'default') {
      // Use softer white (#CCCCCC) for dark mode, pure white for light mode
      const finalColor = color.color === '#FFFFFF' && theme.palette.mode === 'dark'
        ? '#CCCCCC'
        : color.color;
      styleMap[`TEXT_COLOR_${color.color.replace('#', '')}`] = { color: finalColor };
    }
  });
  // Add background colors to the style map
  BACKGROUND_COLORS.forEach(color => {
    if (color.color !== 'default') {
      styleMap[`BG_COLOR_${color.color.replace('#', '')}`] = { backgroundColor: color.color };
    }
  });

  // Get the current block type
  const getCurrentBlockType = (): string => {
    const selection = editorState.getSelection();
    if (!selection.getHasFocus()) return 'unstyled'; // Return default if no focus
    try {
        const contentState = editorState.getCurrentContent();
        const startKey = selection.getStartKey();
        const currentBlock = contentState.getBlockForKey(startKey);
        return currentBlock.getType();
    } catch (e) {
        console.error("Error getting block type:", e);
        return 'unstyled';
    }
  };

  // Custom block renderer CSS classes
  const blockStyleFn = (contentBlock: any): string => {
    const type = contentBlock.getType();
    switch (type) {
      case 'header-one':
        return 'RichEditor-h1';
      case 'header-two':
        return 'RichEditor-h2';
      case 'header-three':
        return 'RichEditor-h3';
      case 'unordered-list-item':
        return 'RichEditor-ul';
      case 'ordered-list-item':
        return 'RichEditor-ol';
      default:
        return ''; // Let Draft handle default block styling
    }
  };

  // Handle keyboard shortcuts
  const handleKeyCommand = (command: string, state: EditorState): 'handled' | 'not-handled' => {
    const newState = RichUtils.handleKeyCommand(state, command);
    if (newState) {
      handleEditorChange(newState);
      return 'handled';
    }
    return 'not-handled';
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
                        onClick={() => applyTextColor(color.color)}
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
                        onClick={() => applyBackgroundColor(color.color)}
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
                  onClick={() => applyTextColor(color.color)}
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
                  onClick={() => applyBackgroundColor(color.color)}
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

    const currentBlock = getCurrentBlockType();

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
            onClick={() => applyHeading(option.style)}
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
    const currentBlockType = getCurrentBlockType();

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
                        onClick={() => toggleInlineStyle('BOLD')}
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
                        onClick={() => toggleInlineStyle('ITALIC')}
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
                        onClick={() => toggleInlineStyle('UNDERLINE')}
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
                        onClick={() => toggleBlockType('unordered-list-item')}
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
                        onClick={() => toggleBlockType('ordered-list-item')}
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
          backgroundColor: theme.palette.background.paper
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
            handleKeyCommand={handleKeyCommand}
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


      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default RichTextEditor;