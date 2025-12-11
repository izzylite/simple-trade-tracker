import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Editor, EditorState, convertToRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

// Import utilities, constants, and hooks
import { createEditorStateFromValue } from './RichTextEditor/utils/draftUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from './RichTextEditor/constants/colors';
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
  blockStyleFn,
  restoreScrollAndFocus
} from './RichTextEditor/utils/editorActions';
import { keyBindingFn, handleKeyCommand } from './RichTextEditor/utils/keyboardUtils';
import { createStyleMap } from './RichTextEditor/utils/styleUtils';
import {
  handleLinkDialogOpen,
  handleLinkDialogClose
} from './RichTextEditor/utils/linkDialogUtils';
import { createDecorator } from './RichTextEditor/utils/decoratorUtils';
import { insertImage, removeImageBlock } from './RichTextEditor/utils/imageUtils';
import ImageBlock from './RichTextEditor/components/ImageBlock';
import ImageUploadDialog from './RichTextEditor/components/ImageUploadDialog';
import EditorToolbar from './RichTextEditor/components/EditorToolbar';

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
  // Toolbar variant: 'floating' (default), 'sticky', or 'none'
  toolbarVariant?: 'floating' | 'sticky' | 'none';
  // Sticky toolbar position: 'top' (default) or 'bottom'
  stickyPosition?: 'top' | 'bottom';
  // Optional props for trade link navigation
  calendarId?: string;
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

// Ref handle for external toolbar control
export interface RichTextEditorHandle {
  editorState: EditorState;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  toggleInlineStyle: (style: string) => void;
  toggleBlockType: (blockType: string) => void;
  applyTextColor: (color: string) => void;
  applyBackgroundColor: (color: string) => void;
  applyHeading: (headingStyle: string) => void;
  clearFormatting: () => void;
  handleLinkClick: () => void;
  handleImageClick: () => void;
  setIsMenuOpen: (isOpen: boolean) => void;
}






const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
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
  toolbarVariant = 'floating',
  stickyPosition = 'top',
  calendarId,
  trades,
  onOpenGalleryMode
}, ref) => {
  const theme = useTheme();
  const Z_INDEX = 2000;

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

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
          // setTimeout(() => {
          //   if (editorRef.current) {
          //     editorRef.current.focus();
          //   }
          // }, 50);
        });
      }
    }
  }, [linkDialogOpen]);

  // Use custom hooks for better organization
  const {
    showFloatingToolbar,
    floatingToolbarPosition
  } = useFloatingToolbar({
    disabled,
    editorWrapperRef,
    toolbarRef,
    isMenuOpen,
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
      () => {}, // Recent colors are managed in EditorToolbar
      TEXT_COLORS
    );

    handleEditorChange(newState);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Apply background color using utility
  const handleApplyBackgroundColor = (color: string) => {
    const { newState, scrollTop } = applyBackgroundColor(
      editorState,
      color,
      editorRef,
      () => {}, // Recent colors are managed in EditorToolbar
      BACKGROUND_COLORS
    );

    handleEditorChange(newState);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Apply heading using utility
  const handleApplyHeading = (headingStyle: string) => {
    const { newState } = applyHeading(editorState, headingStyle, editorRef);
    handleEditorChange(newState);
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
    // setTimeout(() => {
    //   if (editorRef.current) {
    //     editorRef.current.focus();
    //   }
    // }, 0);
  };

  // Image handlers
  const handleImageClick = () => {
    setImageDialogOpen(true);
  };

  // Expose methods to parent via ref for external toolbar control
  useImperativeHandle(ref, () => ({
    editorState,
    toolbarRef,
    toggleInlineStyle: handleToggleInlineStyle,
    toggleBlockType: handleToggleBlockType,
    applyTextColor: handleApplyTextColor,
    applyBackgroundColor: handleApplyBackgroundColor,
    applyHeading: handleApplyHeading,
    clearFormatting: handleClearFormatting,
    handleLinkClick,
    handleImageClick,
    setIsMenuOpen,
  }), [editorState, handleToggleInlineStyle, handleToggleBlockType, handleApplyTextColor,
      handleApplyBackgroundColor, handleApplyHeading, handleClearFormatting, handleLinkClick, handleImageClick]);

  const handleImageInsert = (src: string, alt?: string) => {
    const newState = insertImage(editorState, src, alt);
    handleEditorChange(newState);
    setImageDialogOpen(false);
    setTimeout(() => editorRef.current?.focus(), 100);
  };

  const handleImageRemove = (blockKey: string) => {
    const newState = removeImageBlock(editorState, blockKey);
    handleEditorChange(newState);
  };

  // Block renderer for atomic blocks (images)
  const blockRendererFn = (contentBlock: any) => {
    if (contentBlock.getType() === 'atomic') {
      const contentState = editorState.getCurrentContent();
      const entityKey = contentBlock.getEntityAt(0);
      if (entityKey) {
        const entity = contentState.getEntity(entityKey);
        if (entity.getType() === 'IMAGE') {
          return {
            component: ImageBlock,
            editable: false,
            props: {
              onRemove: handleImageRemove,
              readOnly: disabled,
            },
          };
        }
      }
    }
    return null;
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
          position: 'relative', // Crucial for absolute positioning of toolbar
          overflow: 'hidden', // Clip potential overflows (like toolbar if not positioned carefully)
          transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        }}
      >
        {/* Sticky Toolbar at top when variant is 'sticky' and stickyPosition is 'top' */}
        {toolbarVariant === 'sticky' && stickyPosition === 'top' && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="sticky"
            stickyPosition="top"
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

        {/* Editor Scrollable Area */}
        <Box
          ref={editorWrapperRef}
          onClick={focusEditor}
          sx={{
            padding: theme.spacing(1.2, 1.8),
            minHeight,
            maxHeight,
            overflow: 'auto',
            cursor: 'text',
            position: 'relative',
            ...scrollbarStyles(theme),
            '& .public-DraftEditorPlaceholder-root': {
                color: theme.palette.text.disabled,
                position: 'absolute',
                top: theme.spacing(1.2),
                left: theme.spacing(1.8),
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.8,
                fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
                fontWeight: 500,
                fontSize: '0.9rem', // Reduced placeholder font size
            },
            '& .public-DraftEditor-content': {
              minHeight: typeof minHeight === 'number' ? `calc(${minHeight}px - ${theme.spacing(3)})` : `calc(${minHeight} - ${theme.spacing(3)})`,
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontSize: '0.9rem', // Reduced text size
              lineHeight: 1.9,
              fontWeight: 500,
              color: theme.palette.text.primary,
              position: 'relative',
              zIndex: 1,
              '& *::selection': {
                 backgroundColor: alpha(theme.palette.primary.main, 0.3),
              },
            },
            // Custom Block Styles
            '& .RichEditor-h1': {
              fontSize: '1.1rem', fontWeight: 'bold', margin: '0.8rem 0 0.4rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h2': {
              fontSize: '1rem', fontWeight: 'bold', margin: '0.6rem 0 0.3rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h3': {
              fontSize: '0.95rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem', fontStyle: 'italic',
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
            blockRendererFn={blockRendererFn}
            handleKeyCommand={handleKeyCommandWrapper}
            keyBindingFn={keyBindingFn}
            readOnly={disabled}
            spellCheck={true}
          />
        </Box>

        {/* Render the floating toolbar absolutely positioned relative to the main wrapper */}
        {toolbarVariant === 'floating' && showFloatingToolbar && floatingToolbarPosition && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="floating"
            position={floatingToolbarPosition}
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

        {/* Sticky Toolbar at bottom when variant is 'sticky' and stickyPosition is 'bottom' */}
        {toolbarVariant === 'sticky' && stickyPosition === 'bottom' && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="sticky"
            stickyPosition="bottom"
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

      </Box>

      {/* Link Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={false}
        disableRestoreFocus={true}
        sx={{ zIndex: Z_INDEX }}
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

      {/* Image Upload Dialog */}
      <ImageUploadDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onImageInsert={handleImageInsert}
      />

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
});

// Add display name for debugging
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;