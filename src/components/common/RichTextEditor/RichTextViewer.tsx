/**
 * RichTextViewer Component
 * Read-only viewer for Draft.js rich text content
 */

import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';

import { createEditorStateFromValue } from 'components/common/RichTextEditor/utils/draftUtils';
import { createStyleMap } from 'components/common/RichTextEditor/utils/styleUtils';
import { blockStyleFn } from 'components/common/RichTextEditor/utils/editorActions';
import { createDecorator } from 'components/common/RichTextEditor/utils/decoratorUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from 'components/common/RichTextEditor/constants/colors';

interface RichTextViewerProps {
  content: string;
  minHeight?: number | string;
  /**
   * Optional handler for shared-trade link clicks. When omitted,
   * LinkComponent falls back to navigating to /shared/{id}. Provide this
   * to intercept clicks and show an inline preview (e.g. TradeGalleryDialog).
   */
  onSharedTradeClick?: (shareId: string, tradeId: string) => void;
}

const RichTextViewer: React.FC<RichTextViewerProps> = ({
  content,
  minHeight = 100,
  onSharedTradeClick,
}) => {
  const theme = useTheme();

  // Create decorator for links/entities
  const decorator = useMemo(
    () => createDecorator(undefined, undefined, undefined, undefined, undefined, onSharedTradeClick),
    [onSharedTradeClick]
  );

  // Create editor state from content
  const editorState = useMemo(() => {
    const state = createEditorStateFromValue(content);
    return EditorState.set(state, { decorator });
  }, [content, decorator]);

  // Create style map for custom styles
  const styleMap = useMemo(() => createStyleMap(theme, TEXT_COLORS, BACKGROUND_COLORS), [theme]);

  // Custom block renderer for images
  const blockRendererFn = (block: any) => {
    if (block.getType() === 'atomic') {
      return {
        component: AtomicBlock,
        editable: false,
      };
    }
    return null;
  };

  // Wrap blockStyleFn to tag header blocks with a per-key anchor class so
  // outlines can scroll into view via `.note-anchor-${blockKey}` selector.
  const anchoredBlockStyleFn = (block: any): string => {
    const base = blockStyleFn(block);
    const type = block.getType();
    if (type === 'header-one' || type === 'header-two' || type === 'header-three') {
      return `${base} note-anchor-${block.getKey()}`.trim();
    }
    return base;
  };

  return (
    <Box
      sx={{
        minHeight,
        '& .DraftEditor-root': {
          fontSize: '1rem',
          lineHeight: 2.1,
          color: theme.palette.text.primary,
        },
        '& .public-DraftEditorPlaceholder-root': {
          display: 'none',
        },
        '& .public-DraftEditor-content': {
          minHeight,
        },
        // List styles
        '& ul, & ol': {
          margin: '0.5em 0',
          paddingLeft: '1.5em',
        },
        '& li': {
          marginBottom: '0.25em',
        },
        // Heading styles
        '& h1': {
          fontSize: '2rem',
          fontWeight: 700,
          margin: '1em 0 0.5em',
        },
        '& h2': {
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: '0.8em 0 0.4em',
        },
        '& h3': {
          fontSize: '1.25rem',
          fontWeight: 600,
          margin: '0.6em 0 0.3em',
        },
        // Callout styles — mirror RichTextEditor.tsx so the editor and the
        // read-only viewer render the same shape for these blocks.
        '& .RichEditor-callout': {
          borderLeftStyle: 'solid',
          borderLeftWidth: '3px',
          padding: '8px 14px',
          margin: '4px 0',
          borderRadius: '4px',
          lineHeight: 1.6,
        },
        // Fuse adjacent callouts of the SAME variant only (mirrors the
        // editor — see notes on RichTextEditor.tsx for rationale).
        '& .RichEditor-callout-warning + .RichEditor-callout-warning, & .RichEditor-callout-info + .RichEditor-callout-info, & .RichEditor-callout-success + .RichEditor-callout-success, & .RichEditor-callout-danger + .RichEditor-callout-danger': {
          marginTop: 0,
          paddingTop: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        },
        '& .RichEditor-callout-warning:has(+ .RichEditor-callout-warning), & .RichEditor-callout-info:has(+ .RichEditor-callout-info), & .RichEditor-callout-success:has(+ .RichEditor-callout-success), & .RichEditor-callout-danger:has(+ .RichEditor-callout-danger)': {
          paddingBottom: 0,
          marginBottom: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
        '& .RichEditor-callout-warning': {
          borderLeftColor: theme.palette.warning.main,
          backgroundColor: alpha(theme.palette.warning.main, 0.08),
          color: theme.palette.warning.main,
        },
        '& .RichEditor-callout-info': {
          borderLeftColor: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          color: theme.palette.primary.light,
        },
        '& .RichEditor-callout-success': {
          borderLeftColor: theme.palette.success.main,
          backgroundColor: alpha(theme.palette.success.main, 0.08),
          color: theme.palette.success.main,
        },
        '& .RichEditor-callout-danger': {
          borderLeftColor: theme.palette.error.main,
          backgroundColor: alpha(theme.palette.error.main, 0.08),
          color: theme.palette.error.main,
        },
        // Blockquote styles
        '& blockquote': {
          borderLeft: `3px solid ${theme.palette.primary.main}`,
          paddingLeft: '1em',
          marginLeft: 0,
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
        },
        // Code block styles
        '& pre': {
          backgroundColor: theme.palette.action.hover,
          padding: '1em',
          borderRadius: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
        },
        // Link styles
        '& a': {
          color: theme.palette.primary.main,
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      }}
    >
      <Editor
        editorState={editorState}
        onChange={() => {}} // No-op for read-only
        readOnly={true}
        customStyleMap={styleMap}
        blockStyleFn={anchoredBlockStyleFn}
        blockRendererFn={blockRendererFn}
      />
    </Box>
  );
};

// Atomic block component for images
const AtomicBlock: React.FC<{ block: any; contentState: any }> = ({
  block,
  contentState,
}) => {
  const entity = contentState.getEntity(block.getEntityAt(0));
  const type = entity.getType();
  const data = entity.getData();

  if (type === 'IMAGE') {
    return (
      <Box
        component="img"
        src={data.src}
        alt={data.alt || ''}
        sx={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          my: 1,
        }}
      />
    );
  }

  return null;
};

export default RichTextViewer;
