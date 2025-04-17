import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Fade,
  Paper as MuiPaper // Use MuiPaper consistently
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
  Palette
} from '@mui/icons-material';
import { Editor, EditorState, RichUtils, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

// Define color options
const TEXT_COLORS = [
{ label: 'Default', color: 'default' }, // Handled specially in rendering
{ label: 'Black', color: '#000000' },
{ label: 'White', color: '#FFFFFF' },
{ label: 'Brown', color: '#BA856F' },
{ label: 'Orange', color: '#C07A47' },
{ label: 'Yellow', color: '#B58A48' },
{ label: 'Green', color: '#427256' },
{ label: 'Blue', color: '#379AD3' },
{ label: 'Purple', color: '#9664C9' },
{ label: 'Pink', color: '#9B4342' },
{ label: 'Red', color: '#BC4B4A' },
];

const BACKGROUND_COLORS = [
{ label: 'Default', color: 'default' }, // Handled specially
{ label: 'Black', color: '#000000' },
{ label: 'Dark Gray', color: '#2F2F2F' },
{ label: 'Brown', color: '#4A3228' },
{ label: 'Orange', color: '#5C3B23' },
{ label: 'Yellow', color: '#564328' },
{ label: 'Green', color: '#243D30' },
{ label: 'Blue', color: '#143A4E' },
{ label: 'Purple', color: '#3C2D49' },
{ label: 'Pink', color: '#4E2C3C' },
{ label: 'Red', color: '#522E2A' },
];

// Define heading options
const HEADING_OPTIONS = [
  { label: 'Normal', style: 'unstyled' },
  { label: 'Heading 1', style: 'header-one' },
  { label: 'Heading 2', style: 'header-two' },
  { label: 'Heading 3', style: 'header-three' },
];

// Add character limit constant
const MAX_CHARACTER_LIMIT = 2024;

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

// Helper function for scrollbar styling
const scrollbarStyles = (theme: any) => ({
  '&::-webkit-scrollbar': {
    width: '10px',
    height: '10px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: '6px',
    margin: '4px 0',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark'
      ? alpha(theme.palette.primary.main, 0.3)
      : alpha(theme.palette.primary.main, 0.2),
    borderRadius: '6px',
    border: theme.palette.mode === 'dark'
      ? '2px solid rgba(0, 0, 0, 0.2)'
      : '2px solid rgba(255, 255, 255, 0.2)',
    '&:hover': {
      background: theme.palette.mode === 'dark'
        ? alpha(theme.palette.primary.main, 0.5)
        : alpha(theme.palette.primary.main, 0.4),
    },
  },
});


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
  const [editorState, setEditorState] = useState(() => {
    if (value) {
      try {
        // Try to parse the value as raw content
        const rawContent = JSON.parse(value);
        // Basic check if it looks like Draft.js raw content
        if (rawContent && Array.isArray(rawContent.blocks) && typeof rawContent.entityMap === 'object') {
          const contentState = convertFromRaw(rawContent);
          return EditorState.createWithContent(contentState);
        } else {
            // If not valid raw JSON, treat as plain text
             return EditorState.createWithContent(ContentState.createFromText(value));
        }
      } catch (e) {
        // If parsing fails or it's not raw content, create with plain text
        console.warn("RichTextEditor: Failed to parse initial value as Draft.js raw content. Treating as plain text.", e);
        return EditorState.createWithContent(ContentState.createFromText(value));
      }
    }
    return EditorState.createEmpty();
  });

  const editorRef = useRef<Editor>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);

  // State for tracking recently used colors
  const [recentlyUsedTextColors, setRecentlyUsedTextColors] = useState<Array<{ label: string; color: string }>>([]);
  const [recentlyUsedBgColors, setRecentlyUsedBgColors] = useState<Array<{ label: string; color: string }>>([]);

  // Load recently used colors from localStorage on component mount
  useEffect(() => {
    try {
      const savedTextColors = localStorage.getItem('richTextEditor_recentTextColors');
      const savedBgColors = localStorage.getItem('richTextEditor_recentBgColors');

      if (savedTextColors) {
        setRecentlyUsedTextColors(JSON.parse(savedTextColors));
      } else {
         setRecentlyUsedTextColors([]); // Initialize if nothing in storage
      }

      if (savedBgColors) {
        setRecentlyUsedBgColors(JSON.parse(savedBgColors));
      } else {
         setRecentlyUsedBgColors([]); // Initialize if nothing in storage
      }
    } catch (error) {
      console.error('Error loading recently used colors from localStorage:', error);
       setRecentlyUsedTextColors([]);
       setRecentlyUsedBgColors([]);
    }
  }, []);

  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState<{ top: number; left: number } | null>(null);

  // Focus the editor when clicked
  const focusEditor = () => {
    if (editorRef.current && !disabled) {
      editorRef.current.focus();
    }
  };

  // Function to get selection rectangle
  const getSelectionRect = (): DOMRect | null => {
    try { // Add try-catch for robustness
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return null;
        }
        const range = selection.getRangeAt(0);
        return range.getBoundingClientRect();
    } catch (e) {
        console.error("Error getting selection rect:", e);
        return null;
    }
  };

 // Function to update and show/hide floating toolbar
  const checkSelectionAndPositionToolbar = useCallback(() => {
    if (disabled || !editorWrapperRef.current) return;

    const selection = window.getSelection();
    const hasText = selection && !selection.isCollapsed && selection.rangeCount > 0;

    if (hasText) {
      try {
        const selectionRect = getSelectionRect();

        if (selectionRect && selectionRect.width > 0 && editorWrapperRef.current) { // Ensure wrapperRef exists
          const editorRect = editorWrapperRef.current.getBoundingClientRect();
          const editorScrollTop = editorWrapperRef.current.scrollTop;
          const editorScrollLeft = editorWrapperRef.current.scrollLeft;

          // Use actual toolbar dimensions if available, otherwise estimate
          // Note: Dimensions might be slightly off if read during animation/transition
          const toolbarHeight = toolbarRef.current?.offsetHeight ?? 48;
          const toolbarWidth = toolbarRef.current?.offsetWidth ?? 320;
          const spacing = 8; // Space between selection and toolbar

          // Calculate base position relative to the editor's viewport entry
          let top = selectionRect.top - editorRect.top - toolbarHeight - spacing;
          let left = selectionRect.left - editorRect.left + (selectionRect.width / 2) - (toolbarWidth / 2);

          // Add scroll position to get position relative to the scrollable content
          top += editorScrollTop;
          left += editorScrollLeft;

          // --- FIXED: Boundary checks accounting for scroll ---
          const safeTopBoundary = editorScrollTop + spacing;
          const safeBottomBoundaryForTopPositioning = selectionRect.bottom - editorRect.top + spacing + editorScrollTop;

          // If not enough space above (or it goes above the scrolled viewport), position below
          if (top < safeTopBoundary) {
            top = safeBottomBoundaryForTopPositioning;
          }

          // Prevent going off left edge (relative to scrolled content)
          const safeLeftBoundary = editorScrollLeft + spacing;
          left = Math.max(safeLeftBoundary, left);

          // Prevent going off right edge (relative to scrolled content)
          // editorRect.width is viewport width, consider scrollbar width
          const scrollbarWidthAllowance = 15; // Adjust as needed
          const safeRightBoundary = editorRect.width - toolbarWidth - spacing + editorScrollLeft - scrollbarWidthAllowance;
          left = Math.min(safeRightBoundary, left);
          // --- End Fixed Boundary Checks ---

          setFloatingToolbarPosition({ top, left });
          if (!showFloatingToolbar) { // Only set true if it was previously false to potentially reduce re-renders
             setShowFloatingToolbar(true);
          }
          return;
        }
      } catch (error) {
        console.error('Error positioning toolbar:', error);
        // Fall through to hide toolbar on error
      }
    }

    // Hide toolbar if no valid selection OR an error occurred positioning it
    // Only hide if no menus anchored to the toolbar are open
    if (!colorMenuAnchor && !headingMenuAnchor) {
      // Check if it's currently shown before setting state
      if (showFloatingToolbar) {
          setShowFloatingToolbar(false);
          // Optionally reset position: setFloatingToolbarPosition(null); // Can cause jumpiness if reset immediately
      }
    }
  }, [disabled, colorMenuAnchor, headingMenuAnchor, showFloatingToolbar]); // Added showFloatingToolbar dependency

  // Handle editor state changes
  const handleEditorChange = (state: EditorState) => {
    // Get the current content state
    const contentState = state.getCurrentContent();
    
    // Check if content has changed
    if (contentState !== editorState.getCurrentContent()) {
      // Get plain text to check length
      const plainText = contentState.getPlainText();
      
      // If text exceeds limit, don't update the state
      if (plainText.length > MAX_CHARACTER_LIMIT) {
        return;
      }
      
      setEditorState(state);
      
      if (onChange) {
        // Check if there's any content
        const hasText = contentState.hasText();
        if (!hasText && contentState.getBlockMap().size === 1) {
          onChange('');
        } else {
          const rawContent = convertToRaw(contentState);
          onChange(JSON.stringify(rawContent));
        }
      }
    }
  };

  // Effect to add/remove event listeners for selection
  useEffect(() => {
    const editorElement = editorWrapperRef.current;
    if (!editorElement || disabled) return;

    // Use a slight delay on mouseup to allow selection to finalize
    const handleMouseUp = () => setTimeout(checkSelectionAndPositionToolbar, 0);
    const handleTouchEnd = () => setTimeout(checkSelectionAndPositionToolbar, 0);
    // Check on key up for keyboard selections & cursor movement
    const handleKeyUp = (event: KeyboardEvent) => {
        // Check for arrow keys, selection keys (Shift+Arrows), Home, End etc.
        if (
            event.key.includes('Arrow') ||
            ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key) ||
            (event.shiftKey && ['Delete', 'Backspace'].includes(event.key)) // Selection changes
        ) {
             setTimeout(checkSelectionAndPositionToolbar, 0);
        }
    };

    editorElement.addEventListener('mouseup', handleMouseUp);
    editorElement.addEventListener('touchend', handleTouchEnd);
    editorElement.addEventListener('keyup', handleKeyUp); // Listen on editor for keys
    // Check on focus as well
    editorElement.addEventListener('focus', checkSelectionAndPositionToolbar);


    return () => {
      editorElement.removeEventListener('mouseup', handleMouseUp);
      editorElement.removeEventListener('touchend', handleTouchEnd);
      editorElement.removeEventListener('keyup', handleKeyUp);
      editorElement.removeEventListener('focus', checkSelectionAndPositionToolbar);

    };
  }, [checkSelectionAndPositionToolbar, disabled]); // Re-run if disabled state changes or function reference changes


  // Effect to hide toolbar on outside click
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as Node;

          // Check if click is outside the editor and the toolbar
          const isOutsideEditor = editorWrapperRef.current && !editorWrapperRef.current.contains(target);
          const isOutsideToolbar = toolbarRef.current && !toolbarRef.current.contains(target);
          // A basic check if click is outside menu anchors (more robust would involve menu refs)
          const isOutsideMenus = !colorMenuAnchor && !headingMenuAnchor;

          if (showFloatingToolbar && isOutsideEditor && isOutsideToolbar && isOutsideMenus) {
              setShowFloatingToolbar(false);
              // setFloatingToolbarPosition(null); // Avoid resetting position immediately
              return; // Hide and exit
          }

          // Check if click is *inside* editor but possibly clears selection
          if (
              editorWrapperRef.current &&
              editorWrapperRef.current.contains(target) &&
              isOutsideToolbar // Ensure click isn't on toolbar itself
          ) {
              // Use RAF or timeout to check selection state *after* the click's effects
              requestAnimationFrame(() => {
                  const selection = window.getSelection();
                  if (selection && selection.isCollapsed) {
                      // Only hide if no menus are open
                      if (!colorMenuAnchor && !headingMenuAnchor) {
                          setShowFloatingToolbar(false);
                           // setFloatingToolbarPosition(null);
                      }
                  }
              });
          }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showFloatingToolbar, colorMenuAnchor, headingMenuAnchor]); // Dependencies ensure checks use current menu state

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
            setRecentlyUsedTextColors(prev => {
                const filtered = prev.filter(c => c.color !== color);
                const newList = [colorObj, ...filtered].slice(0, 5); // Keep 5 most recent
                try { localStorage.setItem('richTextEditor_recentTextColors', JSON.stringify(newList)); }
                catch (error) { console.error('Error saving recent text colors:', error); }
                return newList;
            });
        }
    }
    // If default, we just remove all text colors (already done above)

    handleEditorChange(nextEditorState);
    setColorMenuAnchor(null); // Close menu
    setTimeout(() => editorRef.current?.focus(), 0); // Refocus editor
   };

    // Apply background color
    const applyBackgroundColor = (color: string) => {
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
                setRecentlyUsedBgColors(prev => {
                    const filtered = prev.filter(c => c.color !== color);
                    const newList = [colorObj, ...filtered].slice(0, 5); // Keep 5 most recent
                    try { localStorage.setItem('richTextEditor_recentBgColors', JSON.stringify(newList)); }
                    catch (error) { console.error('Error saving recent bg colors:', error); }
                    return newList;
                });
            }
        }
        // If default, we just remove all background colors (already done above)

        handleEditorChange(nextEditorState);
        setColorMenuAnchor(null); // Close menu
        setTimeout(() => editorRef.current?.focus(), 0); // Refocus editor
    };

  // Handle menu anchor button clicks (toggle open/close)
  const handleHeadingButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (headingMenuAnchor) {
      setHeadingMenuAnchor(null); // Close if already open
       setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setHeadingMenuAnchor(event.currentTarget); // Open if closed
    }
  };

  const handleColorButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (colorMenuAnchor) {
      setColorMenuAnchor(null); // Close if already open
       setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setColorMenuAnchor(event.currentTarget); // Open if closed
    }
  };

  // Apply heading style
  const applyHeading = (headingStyle: string) => {
    // Get the current selection and content
    const selection = editorState.getSelection();
    const contentState = editorState.getCurrentContent();
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

    // Close menu and refocus
    setHeadingMenuAnchor(null);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  // Custom style map for colors
  const styleMap: Record<string, React.CSSProperties> = {};
  // Add text colors to the style map
  TEXT_COLORS.forEach(color => {
    if (color.color !== 'default') {
      styleMap[`TEXT_COLOR_${color.color.replace('#', '')}`] = { color: color.color };
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
          // Check selection immediately after closing menu (might be slightly delayed by animations)
          setTimeout(checkSelectionAndPositionToolbar, 50);
          // Refocus editor after closing menu only if editor still has focus logically
          if (editorState.getSelection().getHasFocus()) {
             setTimeout(() => editorRef.current?.focus(), 0);
          }
        }}
        disablePortal={false} // Keep within editor flow for positioning
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
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
        {(recentlyUsedTextColors.length > 0 || recentlyUsedBgColors.length > 0) && (
            <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ mb: 1, color: theme.palette.text.secondary, display: 'block' }}>
                    Recently Used
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {/* Text Colors with 'A' */}
                    {recentlyUsedTextColors.map((color) => (
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
                    {recentlyUsedBgColors.map((color) => (
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
          setTimeout(checkSelectionAndPositionToolbar, 50);
          if (editorState.getSelection().getHasFocus()) {
             setTimeout(() => editorRef.current?.focus(), 0);
          }
        }}
        disablePortal={false}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
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
                fontWeight: option.style.includes('header') ? 'bold' : 'normal',
                fontSize: option.style === 'header-one' ? '1.4rem' : option.style === 'header-two' ? '1.2rem' : option.style === 'header-three' ? '1.1rem' : 'inherit',
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
          transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
        }}
      >
        {/* Editor Scrollable Area */}
        <Box
          ref={editorWrapperRef}
          onClick={focusEditor}
          sx={{
            padding: theme.spacing(1.5, 2), // Adjust padding
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
                top: theme.spacing(1.5), // Match padding
                left: theme.spacing(2), // Match padding
                zIndex: 0, // Below content
                pointerEvents: 'none', // Don't interfere with clicks
                opacity: 0.8,
            },
            '& .public-DraftEditor-content': {
              minHeight: typeof minHeight === 'number' ? `calc(${minHeight}px - ${theme.spacing(3)})` : `calc(${minHeight} - ${theme.spacing(3)})`, // Adjust minHeight based on padding
              fontFamily: theme.typography.fontFamily,
              fontSize: '1rem',
              lineHeight: 1.6,
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
              fontSize: '1.75rem', fontWeight: 'bold', margin: '1rem 0 0.5rem',
              color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
              paddingBottom: '0.3rem', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            },
            '& .RichEditor-h2': {
              fontSize: '1.4rem', fontWeight: 'bold', margin: '0.8rem 0 0.4rem',
              color: theme.palette.mode === 'dark' ? theme.palette.secondary.light : theme.palette.secondary.dark,
            },
            '& .RichEditor-h3': {
              fontSize: '1.2rem', fontWeight: 'bold', margin: '0.6rem 0 0.3rem', fontStyle: 'italic',
            },
            '& .RichEditor-ul, & .RichEditor-ol': {
              marginLeft: '1.8rem', // Indentation for lists
              marginBlockStart: '0.5em',
              marginBlockEnd: '0.5em',
              paddingInlineStart: '0', // Reset browser default padding
            },
            '& .RichEditor-ul li, & .RichEditor-ol li': {
              margin: '0.25rem 0',
              paddingLeft: '0.5rem', // Space between bullet/number and text
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

        {/* Character count indicator */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 8, 
          right: 8, 
          fontSize: '0.75rem', 
          color: theme.palette.text.secondary,
          opacity: 0.7,
          pointerEvents: 'none'
        }}>
          {editorState.getCurrentContent().getPlainText().length}/{MAX_CHARACTER_LIMIT}
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