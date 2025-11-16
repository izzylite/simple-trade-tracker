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

  const getDomainFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.replace(/^www\./, '');
    } catch {
      return url;
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
            gap: 0.75,
            mt: 0.75,
            pl: 1
          }}
        >
          {citations.map((citation, index) => (
            <Paper
              key={citation.id}
              variant="outlined"
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.action.hover, 0.4),
                  borderColor: alpha(theme.palette.primary.main, 0.8)
                }
              }}
            >
              {/* Index badge */}
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  flexShrink: 0
                }}
              >
                {index + 1}
              </Box>

              {/* Main content */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  cursor: 'pointer'
                }}
                onClick={() => handleOpenUrl(citation.url)}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {getDomainFromUrl(citation.url)}
                </Typography>
                {(citation.title || citation.url) && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {citation.title || citation.url}
                  </Typography>
                )}
              </Box>

              {/* Tool tag */}
              {citation.toolName && (
                <Chip
                  label={getToolLabel(citation.toolName)}
                  size="small"
                  color={getToolColor(citation.toolName)}
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    flexShrink: 0,
                    borderRadius: 999
                  }}
                />
              )}

              {/* Open in new tab */}
              <Tooltip title="Open in new tab">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenUrl(citation.url);
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CitationsSection;

