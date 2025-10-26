/**
 * HTML Message Renderer Component
 * Safely renders HTML-formatted messages with proper styling
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import DOMPurify from 'dompurify';

interface HtmlMessageRendererProps {
  html: string;
  textColor?: string;
  isUser?: boolean;
}

const HtmlMessageRenderer: React.FC<HtmlMessageRendererProps> = ({
  html,
  textColor = 'text.primary',
  isUser = false
}) => {
  const theme = useTheme();

  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'span', 'div'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
      KEEP_CONTENT: true
    });
  }, [html]);

  // Create a style object for the HTML content
  const htmlStyles = `
    p {
      margin: 0.5rem 0;
      line-height: 1.5;
    }
    
    strong {
      font-weight: 600;
    }
    
    em {
      font-style: italic;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin: 1rem 0 0.5rem 0;
      font-weight: 600;
    }
    
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.25rem; }
    h3 { font-size: 1.1rem; }
    h4 { font-size: 1rem; }
    h5 { font-size: 0.95rem; }
    h6 { font-size: 0.9rem; }
    
    ul, ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    
    li {
      margin: 0.25rem 0;
    }
    
    blockquote {
      margin: 0.5rem 0;
      padding-left: 1rem;
      border-left: 3px solid currentColor;
      opacity: 0.8;
    }
    
    code {
      background-color: rgba(0, 0, 0, 0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    
    pre {
      background-color: rgba(0, 0, 0, 0.05);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    a {
      color: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    
    a:hover {
      opacity: 0.8;
    }
    
    sup {
      font-size: 0.8em;
      vertical-align: super;
    }
  `;

  return (
    <Box
      sx={{
        '& p': {
          margin: '0.5rem 0',
          lineHeight: 1.5
        },
        '& strong': {
          fontWeight: 600
        },
        '& em': {
          fontStyle: 'italic'
        },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          margin: '1rem 0 0.5rem 0',
          fontWeight: 600
        },
        '& h1': { fontSize: '1.5rem' },
        '& h2': { fontSize: '1.25rem' },
        '& h3': { fontSize: '1.1rem' },
        '& h4': { fontSize: '1rem' },
        '& h5': { fontSize: '0.95rem' },
        '& h6': { fontSize: '0.9rem' },
        '& ul, & ol': {
          margin: '0.5rem 0',
          paddingLeft: '1.5rem'
        },
        '& li': {
          margin: '0.25rem 0'
        },
        '& blockquote': {
          margin: '0.5rem 0',
          paddingLeft: '1rem',
          borderLeft: `3px solid ${alpha(theme.palette.text.primary, 0.3)}`,
          opacity: 0.8
        },
        '& code': {
          backgroundColor: alpha(theme.palette.text.primary, 0.1),
          padding: '2px 4px',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.9em'
        },
        '& pre': {
          backgroundColor: alpha(theme.palette.text.primary, 0.05),
          padding: '1rem',
          borderRadius: 1,
          overflowX: 'auto',
          margin: '0.5rem 0'
        },
        '& pre code': {
          backgroundColor: 'transparent',
          padding: 0
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'underline',
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.8
          }
        },
        '& sup': {
          fontSize: '0.8em',
          verticalAlign: 'super'
        }
      }}
    >
      <Typography
        component="div"
        sx={{
          color: textColor,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </Box>
  );
};

export default HtmlMessageRenderer;

