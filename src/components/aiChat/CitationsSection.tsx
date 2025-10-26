/**
 * Citations Section Component
 * Displays sources and citations from AI agent tool usage
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Link,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { Citation } from '../../types/aiChat';

interface CitationsSectionProps {
  citations: Citation[];
  compact?: boolean;
}

const CitationsSection: React.FC<CitationsSectionProps> = ({
  citations,
  compact = false
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!compact);

  if (!citations || citations.length === 0) {
    return null;
  }

  const getToolColor = (toolName: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (toolName) {
      case 'search_web':
        return 'primary';
      case 'scrape_url':
        return 'secondary';
      case 'execute_sql':
        return 'info';
      case 'price_data':
        return 'success';
      default:
        return 'default';
    }
  };

  const getToolLabel = (toolName: string): string => {
    switch (toolName) {
      case 'search_web':
        return 'Web Search';
      case 'scrape_url':
        return 'Article';
      case 'execute_sql':
        return 'Database';
      case 'price_data':
        return 'Price Data';
      default:
        return toolName;
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          p: 1,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.5)
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          Sources ({citations.length})
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <IconButton
            size="small"
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Citations List */}
      <Collapse in={expanded} timeout="auto">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mt: 1,
            pl: 1
          }}
        >
          {citations.map((citation, index) => (
            <Paper
              key={citation.id}
              variant="outlined"
              sx={{
                p: 1.5,
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 1.5,
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.action.hover, 0.3),
                  borderColor: theme.palette.primary.main
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {/* Citation Number */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    flexShrink: 0
                  }}
                >
                  {index + 1}
                </Box>

                {/* Citation Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Title and Tool Badge */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {citation.title}
                    </Typography>
                    <Chip
                      label={getToolLabel(citation.toolName || '')}
                      size="small"
                      color={getToolColor(citation.toolName || '')}
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        flexShrink: 0
                      }}
                    />
                  </Box>

                  {/* URL */}
                  <Link
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenUrl(citation.url);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.75rem',
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {citation.url}
                    <OpenInNewIcon sx={{ fontSize: 12, flexShrink: 0 }} />
                  </Link>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CitationsSection;

