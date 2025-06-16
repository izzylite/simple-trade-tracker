import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import RichTextEditor from '../RichTextEditor';

/**
 * Test component to verify RichTextEditor functionality
 * This can be used for testing and debugging purposes
 */
const RichTextEditorTest: React.FC = () => {
  const [content, setContent] = useState('');
  const [externalValue, setExternalValue] = useState('');

  const handleContentChange = (newContent: string) => {
    console.log('Content changed:', newContent);
    setContent(newContent);
  };

  const loadSampleContent = () => {
    const sampleContent = JSON.stringify({
      blocks: [
        {
          key: 'sample',
          text: 'This is sample content with bold text and colors!',
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [
            { offset: 25, length: 4, style: 'BOLD' },
            { offset: 35, length: 6, style: 'TEXT_COLOR_FF0000' }
          ],
          entityRanges: [],
          data: {}
        }
      ],
      entityMap: {}
    });
    setExternalValue(sampleContent);
  };

  const clearContent = () => {
    setExternalValue('');
    setContent('');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        RichTextEditor Test
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={loadSampleContent}>
          Load Sample Content
        </Button>
        <Button variant="outlined" onClick={clearContent}>
          Clear Content
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>
        Controlled Editor (with external value):
      </Typography>
      <RichTextEditor
        value={externalValue}
        onChange={setExternalValue}
        placeholder="Type something here..."
        label="Controlled Editor"
        helperText="This editor is controlled by external state"
        minHeight={150}
      />

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Uncontrolled Editor (internal state):
      </Typography>
      <RichTextEditor
        onChange={handleContentChange}
        placeholder="Type something here..."
        label="Uncontrolled Editor"
        helperText="This editor manages its own state"
        minHeight={150}
      />

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Disabled Editor:
      </Typography>
      <RichTextEditor
        value={externalValue}
        placeholder="This editor is disabled"
        label="Disabled Editor"
        helperText="This editor is in read-only mode"
        disabled
        minHeight={100}
      />

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Current Content (JSON):
        </Typography>
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontSize: '0.875rem',
            overflow: 'auto',
            maxHeight: 200
          }}
        >
          {content || 'No content yet...'}
        </Box>
      </Box>
    </Box>
  );
};

export default RichTextEditorTest;
