import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  PushPin as PinIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import { convertFromRaw } from 'draft-js';
import { format, startOfWeek, subWeeks } from 'date-fns';

import { Note, GAME_PLAN_TAG, LESSON_LEARNED_TAG, INSIGHT_TAG } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import RoundedTabs from '../common/RoundedTabs';
import { getTagDisplayLabel, getTagSubtitle } from './NoteEditorDialogTags';

/** Lifecycle tab — mutually exclusive, drives useNotes activeTab. */
export type NotesTab = 'all' | 'pinned' | 'archived';
/** Tag-category pill — 'all' or any tag string from the loaded notes. */
export type NotesTagPill = string;

interface NoteListPanelProps {
  notes: Note[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedNoteId?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNoteClick: (note: Note) => void;
  onNewNote: () => void;
  canCreateNote: boolean;
  tab: NotesTab;
  onTabChange: (t: NotesTab) => void;
  pill: NotesTagPill;
  onPillChange: (p: NotesTagPill) => void;
  total: number;
}

const extractPreview = (content: string): string => {
  if (!content) return '';
  try {
    return convertFromRaw(JSON.parse(content)).getPlainText();
  } catch {
    return content;
  }
};

/**
 * Color variants for system tags. Uses display labels via getTagDisplayLabel
 * (e.g. INSIGHT_TAG → "Insight", GAME_PLAN_TAG → "Game Plan") rather than
 * forcing PLAN/REVIEW/IDEA shorthand.
 */
const TAG_VARIANT: Record<string, 'plan' | 'review' | 'idea'> = {
  [GAME_PLAN_TAG]: 'plan',
  [LESSON_LEARNED_TAG]: 'review',
  [INSIGHT_TAG]: 'idea',
};

const TAB_LABELS: NotesTab[] = ['all', 'pinned', 'archived'];

function groupByRecency(notes: Note[]): Array<{ label: string; notes: Note[] }> {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = startOfWeek(subWeeks(now, 1));
  const buckets: Record<string, Note[]> = { 'This week': [], 'Last week': [], Older: [] };

  for (const note of notes) {
    const d = new Date(note.updated_at);
    if (d >= thisWeekStart) buckets['This week'].push(note);
    else if (d >= lastWeekStart) buckets['Last week'].push(note);
    else buckets['Older'].push(note);
  }

  return Object.entries(buckets)
    .filter(([, arr]) => arr.length > 0)
    .map(([label, notes]) => ({ label, notes }));
}

// ─── Inner note item ──────────────────────────────────────────────────────────

interface NoteItemProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, isActive, onClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const preview = useMemo(() => {
    const text = extractPreview(note.content);
    return text.length > 110 ? text.slice(0, 110) + '…' : text;
  }, [note.content]);

  const colorTags = useMemo(
    () => (note.tags ?? []).filter(t => t in TAG_VARIANT),
    [note.tags]
  );
  const otherTags = useMemo(
    () => (note.tags ?? []).filter(t => !(t in TAG_VARIANT)).slice(0, 2),
    [note.tags]
  );

  const tagBg: Record<'plan' | 'review' | 'idea', string> = {
    plan: alpha(theme.palette.primary.main, 0.16),
    review: alpha(theme.palette.success.main, 0.16),
    idea: 'rgba(245,158,11,0.18)',
  };
  const tagColor: Record<'plan' | 'review' | 'idea', string> = {
    plan: theme.palette.primary.light,
    review: theme.palette.success.main,
    idea: '#f59e0b',
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.5,
        borderTop: `1px solid ${theme.palette.divider}`,
        cursor: 'pointer',
        position: 'relative',
        bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
        transition: 'background 150ms cubic-bezier(0.22,1,0.36,1)',
        '&:hover': {
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.12)
            : alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.02),
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isActive ? '2px' : 0,
          bgcolor: 'primary.main',
          transition: 'width 150ms',
        },
      }}
    >
      {/* Row 1: title + date */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            color: 'text.primary',
          }}
        >
          {note.is_pinned && (
            <PinIcon sx={{ fontSize: '0.7rem', color: 'primary.main', mr: 0.5, verticalAlign: 'middle' }} />
          )}
          {note.by_assistant && (
            <AIIcon sx={{ fontSize: '0.7rem', color: 'primary.main', mr: 0.5, verticalAlign: 'middle' }} />
          )}
          {note.title || 'Untitled'}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.disabled',
            fontWeight: 600,
            flexShrink: 0,
            fontFeatureSettings: "'tnum' on",
          }}
        >
          {format(new Date(note.updated_at), 'MMM d')}
        </Typography>
      </Box>

      {/* Row 2: preview */}
      {preview && (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'text.secondary',
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: colorTags.length || otherTags.length ? 0.75 : 0,
          }}
        >
          {preview}
        </Typography>
      )}

      {/* Row 3: tags — display labels via getTagDisplayLabel */}
      {(colorTags.length > 0 || otherTags.length > 0) && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {colorTags.map(t => {
            const variant = TAG_VARIANT[t];
            return (
              <Box
                key={t}
                sx={{
                  fontSize: '0.62rem',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: '999px',
                  bgcolor: tagBg[variant],
                  color: tagColor[variant],
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {getTagDisplayLabel(t).toUpperCase()}
              </Box>
            );
          })}
          {otherTags.map(t => (
            <Box
              key={t}
              sx={{
                fontSize: '0.62rem',
                px: 0.75,
                py: 0.25,
                borderRadius: '999px',
                bgcolor: alpha(isDark ? '#fff' : '#000', 0.05),
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {getTagDisplayLabel(t).toUpperCase()}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

const NoteListPanel: React.FC<NoteListPanelProps> = ({
  notes,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  selectedNoteId,
  searchQuery,
  onSearchChange,
  onNoteClick,
  onNewNote,
  canCreateNote,
  tab,
  onTabChange,
  pill,
  onPillChange,
  total,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Build pill list from the union of tags across loaded notes
  const availableTagPills = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) =>
      getTagDisplayLabel(a).localeCompare(getTagDisplayLabel(b))
    );
  }, [notes]);

  // Tag pill filters locally; tab scoped via useNotes
  const filteredNotes = useMemo(() => {
    if (pill === 'all') return notes;
    return notes.filter(n => n.tags?.includes(pill));
  }, [notes, pill]);

  const groups = useMemo(() => groupByRecency(filteredNotes), [filteredNotes]);

  return (
    <Box
      sx={{
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2.25, pt: 2, pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.015em' }}
          >
            Notes
          </Typography>
          <Tooltip title={canCreateNote ? 'New note' : 'Pick a specific calendar first'} placement="left">
            <span>
              <IconButton
                size="small"
                onClick={onNewNote}
                disabled={!canCreateNote}
                sx={{ color: 'primary.main' }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontFeatureSettings: "'tnum' on",
            fontSize: '0.72rem',
          }}
        >
          {total} {total === 1 ? 'entry' : 'entries'}
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ px: 1.75, pt: 1, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search notes…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
                  <ClearIcon sx={{ fontSize: '0.875rem' }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
            sx: {
              borderRadius: 2,
              fontSize: '0.85rem',
              bgcolor: alpha(isDark ? '#fff' : '#000', 0.03),
              '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            },
          }}
        />
      </Box>

      {/* Lifecycle tabs: All / Pinned / Archived */}
      <Box sx={{ px: 1.75, pb: 1 }}>
        <RoundedTabs
          tabs={[
            { label: 'All' },
            { label: 'Pinned' },
            { label: 'Archived' },
          ]}
          activeTab={TAB_LABELS.indexOf(tab)}
          onTabChange={(_e, idx) => onTabChange(TAB_LABELS[idx] ?? 'all')}
          size="small"
          fullWidth
        />
      </Box>

      {/* Tag pills: dynamic — All + every tag present on loaded notes */}
      {availableTagPills.length > 0 && (
        <Box
          sx={{
            px: 1.75,
            pb: 1,
            display: 'flex',
            gap: 0.5,
            flexWrap: 'wrap',
          }}
        >
          {(['all', ...availableTagPills]).map(key => {
            const active = pill === key;
            const tip = key === 'all'
              ? 'Show notes with any tag'
              : (getTagSubtitle(key) || getTagDisplayLabel(key));
            return (
              <Tooltip key={key} title={tip} arrow placement="top">
                <Box
                  component="button"
                  onClick={() => onPillChange(key)}
                  sx={{
                    background: active ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
                    border: `1px solid ${active
                      ? alpha(theme.palette.primary.main, 0.32)
                      : theme.palette.divider}`,
                    color: active ? theme.palette.primary.light : 'text.secondary',
                    borderRadius: '999px',
                    px: 1.25,
                    py: 0.5,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 150ms',
                    '&:hover': {
                      color: active ? theme.palette.primary.light : 'text.primary',
                    },
                  }}
                >
                  {key === 'all' ? 'All' : getTagDisplayLabel(key)}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', ...scrollbarStyles(theme) }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Box
              key={i}
              sx={{ px: 2, py: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}
            >
              <Box sx={{ height: 13, width: '55%', bgcolor: alpha(theme.palette.text.primary, 0.06), borderRadius: 1, mb: 0.75 }} />
              <Box sx={{ height: 11, width: '88%', bgcolor: alpha(theme.palette.text.primary, 0.04), borderRadius: 1, mb: 0.5 }} />
              <Box sx={{ height: 11, width: '65%', bgcolor: alpha(theme.palette.text.primary, 0.04), borderRadius: 1 }} />
            </Box>
          ))
        ) : filteredNotes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery
                ? 'No notes found'
                : tab === 'pinned' ? 'No pinned notes'
                : tab === 'archived' ? 'No archived notes'
                : pill !== 'all' ? `No notes tagged ${getTagDisplayLabel(pill)}`
                : 'No notes yet'}
            </Typography>
          </Box>
        ) : (
          <>
            {groups.map(group => (
              <React.Fragment key={group.label}>
                <Box
                  sx={{
                    px: 2.25,
                    py: 0.75,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                    borderTop: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {group.label}
                </Box>
                {group.notes.map(note => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isActive={note.id === selectedNoteId}
                    onClick={() => onNoteClick(note)}
                  />
                ))}
              </React.Fragment>
            ))}
            {hasMore && (
              <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  sx={{
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: theme.palette.divider,
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.4),
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  {loadingMore ? (
                    <>
                      <CircularProgress size={12} sx={{ mr: 0.75 }} />
                      Loading…
                    </>
                  ) : (
                    `Load more (${total - notes.length} left)`
                  )}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default NoteListPanel;
