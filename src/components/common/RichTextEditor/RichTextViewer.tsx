/**
 * RichTextViewer Component
 * Read-only viewer for Draft.js rich text content
 */

import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';

import { createEditorStateFromValue } from './utils/draftUtils';
import { createStyleMap } from './utils/styleUtils';
import { blockStyleFn } from './utils/editorActions';
import { createDecorator } from './utils/decoratorUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from './constants/colors';

interface RichTextViewerProps {
  content: string;
  minHeight?: number | string;
}

const RichTextViewer: React.FC<RichTextViewerProps> = ({
  content,
  minHeight = 100,
}) => {
  const theme = useTheme();

  // Create decorator for links/entities
  const decorator = useMemo(() => createDecorator(), []);

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

  return (
    <Box
      sx={{
        minHeight,
        '& .DraftEditor-root': {
          fontSize: '1rem',
          lineHeight: 1.7,
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
        blockStyleFn={blockStyleFn}
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
