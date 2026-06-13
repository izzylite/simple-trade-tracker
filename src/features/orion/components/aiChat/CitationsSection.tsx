/**
 * Citations Section Component
 * Displays sources and citations from AI agent tool usage
 * Compact pill design with favicon previews that expands to show details
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Collapse,
  useTheme,
  alpha,
  Popover,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  ExpandMore as ExpandMoreIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { Citation } from 'features/orion/types/aiChat';

interface CitationsSectionProps {
  citations: Citation[];
  compact?: boolean;
}

const CitationsSection: React.FC<CitationsSectionProps> = ({
  citations,
  compact = false
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());

  if (!citations || citations.length === 0) {
    return null;
  }

   


  const getDomainFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string): string => {
    try {
      const domain = getDomainFromUrl(url);
      // Use Google's favicon service for reliable favicon fetching
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return '';
    }
  };

  const handleFaviconError = (url: string) => {
    setFaviconErrors(prev => new Set(prev).add(url));
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (compact) {
      setAnchorEl(event.currentTarget);
    } else {
      setExpanded(!expanded);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  // Get unique domains for favicon display (max 4)
  const uniqueCitations = citations.reduce((acc, citation) => {
    const domain = getDomainFromUrl(citation.url);
    if (!acc.some(c => getDomainFromUrl(c.url) === domain)) {
      acc.push(citation);
    }
    return acc;
  }, [] as Citation[]).slice(0, 4);

  // Render favicon avatar
  const renderFavicon = (url: string, size: number = 20) => {
    const faviconUrl = getFaviconUrl(url);
    const hasError = faviconErrors.has(url);

    if (hasError || !faviconUrl) {
      return (
        <Avatar
          sx={{
            width: size,
            height: size,
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
            color: 'primary.main'
          }}
        >
          <LanguageIcon sx={{ fontSize: size * 0.6 }} />
        </Avatar>
      );
    }

    return (
      <Avatar
        src={faviconUrl}
        sx={{
          width: size,
          height: size,
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`
        }}
        onError={() => handleFaviconError(url)}
      >
        <LanguageIcon sx={{ fontSize: size * 0.6 }} />
      </Avatar>
    );
  };

  // Render citation list content
  const renderCitationsList = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: compact ? 'min(350px, calc(100vw - 24px))' : '100%',
      }}
    >
      {/* Sticky header — citations scroll beneath it */}
      {compact && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            backgroundColor: 'background.paper',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Sources
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
            {citations.length} {citations.length === 1 ? 'source' : 'sources'}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          flexWrap: compact ? 'nowrap' : 'wrap',
          gap: compact ? 0.5 : 0.75,
          p: compact ? 1.5 : 0,
          maxHeight: compact ? 260 : 'none',
          overflow: compact ? 'auto' : 'visible',
        }}
      >
      {citations.map((citation) => (
        <Paper
          key={citation.id}
          variant="outlined"
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            flex: compact ? '1 1 auto' : '0 0 auto',
            maxWidth: compact ? 'none' : 180,
            minWidth: 0,
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.2),
              borderColor: alpha(theme.palette.primary.main, 0.4)
            }
          }}
          onClick={() => handleOpenUrl(citation.url)}
        >
          {/* Favicon */}
          {renderFavicon(citation.url, 22)}

          {/* Main content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.8rem'
              }}
            >
              {citation.title || getDomainFromUrl(citation.url)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.7rem'
              }}
            >
              {getDomainFromUrl(citation.url)}
            </Typography>
          </Box>

     

          {/* Open icon */}
          <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
        </Paper>
      ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* Compact "Sources" pill with favicons */}
      <Box
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          height: 28,
          px: 1,
          borderRadius: 999,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          cursor: 'pointer',
          transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
          '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.2),
            borderColor: alpha(theme.palette.primary.main, 0.4)
          }
        }}
      >
        {/* Favicon stack */}
        <AvatarGroup
          max={4}
          sx={{
            '& .MuiAvatar-root': {
              width: 18,
              height: 18,
              fontSize: '0.6rem',
              border: `1px solid ${theme.palette.background.paper}`,
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              color: 'primary.main'
            },
            '& .MuiAvatarGroup-avatar': {
              marginLeft: -0.75
            }
          }}
        >
          {uniqueCitations.map((citation) => (
            <Avatar
              key={citation.id}
              src={getFaviconUrl(citation.url)}
              sx={{
                width: 18,
                height: 18,
                backgroundColor: alpha(theme.palette.background.paper, 0.9)
              }}
              onError={() => handleFaviconError(citation.url)}
            >
              <LanguageIcon sx={{ fontSize: 10 }} />
            </Avatar>
          ))}
        </AvatarGroup>

        {/* "Sources" text */}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'text.secondary'
          }}
        >
          Sources
        </Typography>

        {/* Expand icon */}
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            color: 'text.secondary',
            transform: expanded || open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        />
      </Box>

      {/* Popover for compact mode */}
      {compact && (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left'
          }}
          sx={{ zIndex: 1500 }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                borderRadius: 1,
                boxShadow: theme.shadows[8],
                // Never exceed the viewport on a narrow phone.
                maxWidth: 'min(350px, calc(100vw - 24px))',
              }
            }
          }}
        >
          {renderCitationsList()}
        </Popover>
      )}

      {/* Collapse for non-compact mode */}
      {!compact && (
        <Collapse in={expanded} timeout="auto" sx={{ alignSelf: 'stretch' }}>
          <Box sx={{ mt: 1, width: '100%' }}>
            {renderCitationsList()}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default CitationsSection;
