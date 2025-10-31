/**
 * Markdown Renderer Component
 * Renders markdown content with proper styling for tables, code blocks, and more
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  Chip
} from '@mui/material';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useTheme();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Table rendering
        table: ({ children }) => (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              my: 2,
              maxWidth: '100%',
              overflow: 'auto',
              backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              borderRadius: 2
            }}
          >
            <Table size="small" sx={{ minWidth: 300 }}>
              {children}
            </Table>
          </TableContainer>
        ),
        thead: ({ children }) => (
          <TableHead
            sx={{
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.primary.main, 0.08)
            }}
          >
            {children}
          </TableHead>
        ),
        tbody: ({ children }) => <TableBody>{children}</TableBody>,
        tr: ({ children }) => <TableRow>{children}</TableRow>,
        th: ({ children }) => (
          <TableCell
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: 'primary.main',
              borderBottom: `2px solid ${theme.palette.primary.main}`,
              py: 1.5,
              px: 2
            }}
          >
            {children}
          </TableCell>
        ),
        td: ({ children }) => (
          <TableCell
            sx={{
              fontSize: '0.85rem',
              py: 1.5,
              px: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            {children}
          </TableCell>
        ),

        // Code blocks
        code: ({ inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          if (!inline && language) {
            return (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  my: 1,
                  backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'auto'
                }}
              >
                {language && (
                  <Chip
                    label={language}
                    size="small"
                    sx={{ mb: 1, fontSize: '0.75rem' }}
                  />
                )}
                <Typography
                  component="pre"
                  sx={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit'
                  }}
                >
                  {children}
                </Typography>
              </Paper>
            );
          }

          // Inline code
          return (
            <Box
              component="code"
              sx={{
                backgroundColor: alpha(theme.palette.text.primary, 0.1),
                padding: '2px 4px',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.875em'
              }}
              {...props}
            >
              {children}
            </Box>
          );
        },

        // Paragraphs
        p: ({ children }) => (
          <Typography
            component="p"
            sx={{
              mb: 1.5,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {children}
          </Typography>
        ),

        // Headings
        h1: ({ children }) => (
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, mt: 2, mb: 1.5 }}
          >
            {children}
          </Typography>
        ),
        h2: ({ children }) => (
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, mt: 2, mb: 1 }}
          >
            {children}
          </Typography>
        ),
        h3: ({ children }) => (
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mt: 1.5, mb: 1 }}
          >
            {children}
          </Typography>
        ),

        // Lists
        ul: ({ children }) => (
          <Box component="ul" sx={{ pl: 3, mb: 1.5 }}>
            {children}
          </Box>
        ),
        ol: ({ children }) => (
          <Box component="ol" sx={{ pl: 3, mb: 1.5 }}>
            {children}
          </Box>
        ),
        li: ({ children }) => (
          <Box
            component="li"
            sx={{
              mb: 0.5,
              lineHeight: 1.6,
              '& > p': { mb: 0 }
            }}
          >
            {children}
          </Box>
        ),

        // Blockquote
        blockquote: ({ children }) => (
          <Box
            component="blockquote"
            sx={{
              borderLeft: `4px solid ${theme.palette.primary.main}`,
              pl: 2,
              py: 0.5,
              my: 1.5,
              fontStyle: 'italic',
              color: 'text.secondary',
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: 1
            }}
          >
            {children}
          </Box>
        ),

        // Horizontal rule
        hr: () => (
          <Box
            component="hr"
            sx={{
              border: 'none',
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              my: 2
            }}
          />
        ),

        // Strong (bold)
        strong: ({ children }) => (
          <Box component="strong" sx={{ fontWeight: 700 }}>
            {children}
          </Box>
        ),

        // Emphasis (italic)
        em: ({ children }) => (
          <Box component="em" sx={{ fontStyle: 'italic' }}>
            {children}
          </Box>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
