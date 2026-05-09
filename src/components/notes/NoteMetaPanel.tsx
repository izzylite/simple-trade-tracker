import React, { useMemo } from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { convertFromRaw } from 'draft-js';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface NoteMetaPanelProps {
  note: Note | null;
}

interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

function extractHeadings(content: string): Heading[] {
  if (!content) return [];
  try {
    const raw = JSON.parse(content);
    return (raw.blocks as Array<{ type: string; text: string; key: string }>)
      .filter(b => b.type === 'header-two' || b.type === 'header-three')
      .map(b => ({
        level: b.type === 'header-two' ? 2 : 3,
        text: b.text,
        id: b.key,
      })) as Heading[];
  } catch {
    return [];
  }
}

function countWords(content: string): number {
  if (!content) return 0;
  try {
    const text = convertFromRaw(JSON.parse(content)).getPlainText();
    return text.trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }
}

const NoteMetaPanel: React.FC<NoteMetaPanelProps> = ({ note }) => {
  const theme = useTheme();

  const headings = useMemo(() => (note ? extractHeadings(note.content) : []), [note?.content]);
  const wordCount = useMemo(() => (note ? countWords(note.content) : 0), [note?.content]);
  const readMins = Math.max(1, Math.round(wordCount / 200));

  const sectionLabelSx = {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'text.disabled',
    mb: 1.25,
  };

  const statCardSx = {
    bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0.6),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '10px',
    px: 1.5,
    py: 1.25,
  };

  if (!note) {
    return (
      <Box
        sx={{
          borderLeft: `1px solid ${theme.palette.divider}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="caption" color="text.disabled">
          No note selected
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderLeft: `1px solid ${theme.palette.divider}`,
        height: '100%',
        overflowY: 'auto',
        bgcolor: 'background.default',
        ...scrollbarStyles(theme),
      }}
    >
      <Box sx={{ px: 2.75, py: 3, display: 'flex', flexDirection: 'column', gap: 3.25 }}>

        {/* Stats */}
        <Box>
          <Typography sx={sectionLabelSx}>Stats</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Box sx={statCardSx}>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Words
              </Typography>
              <Typography sx={{ fontWeight: 700, fontFeatureSettings: "'tnum' on", fontSize: '1rem', mt: 0.25, letterSpacing: '-0.015em' }}>
                {wordCount.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={statCardSx}>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Read
              </Typography>
              <Typography sx={{ fontWeight: 700, fontFeatureSettings: "'tnum' on", fontSize: '1rem', mt: 0.25, letterSpacing: '-0.015em' }}>
                {readMins}m
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Outline */}
        {headings.length > 0 && (
          <Box>
            <Typography sx={sectionLabelSx}>Outline</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {headings.map((h, i) => (
                <Box
                  key={`${h.id}-${i}`}
                  onClick={() => {
                    const el = document.querySelector(`.note-anchor-${h.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: h.level === 3 ? 2 : 1.25,
                    py: 0.5,
                    color: 'text.secondary',
                    fontSize: h.level === 3 ? '0.78rem' : '0.83rem',
                    fontWeight: h.level === 3 ? 500 : 600,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'all 150ms',
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0),
                    },
                    '&::before': {
                      content: '""',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      bgcolor: 'text.disabled',
                      flexShrink: 0,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    {h.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Details */}
        <Box>
          <Typography sx={sectionLabelSx}>Details</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <DetailRow
              label="Created"
              value={new Date(note.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            />
            <DetailRow
              label="Updated"
              value={new Date(note.updated_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            />
            {note.is_pinned && <DetailRow label="Status" value="Pinned" valueColor="primary.main" />}
            {note.is_archived && <DetailRow label="Status" value="Archived" valueColor="warning.main" />}
            {note.by_assistant && <DetailRow label="Author" value="Orion" valueColor="primary.light" />}
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: valueColor ?? 'text.secondary',
        textAlign: 'right',
      }}
    >
      {value}
    </Typography>
  </Box>
);

export default NoteMetaPanel;
