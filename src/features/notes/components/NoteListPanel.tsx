import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlineIcon,
  SmartToy as AIIcon,
  Notes as NotesIcon,
  ArrowForward as ArrowForwardIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  FilterList as FilterListIcon,
  KeyboardArrowDown as ArrowDownIcon,
  AutoAwesome as SparkleIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import { convertFromRaw } from 'draft-js';
import { format } from 'date-fns';

import {
  Note,
  GAME_PLAN_TAG,
  LESSON_LEARNED_TAG,
  INSIGHT_TAG,
  STRATEGY_TAG,
  GUIDELINE_TAG,
  PSYCHOLOGY_TAG,
  RISK_MANAGEMENT_TAG,
  SLASH_COMMAND_TAG,
  GENERAL_TAG,
} from 'features/notes/types/note';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { getTagDisplayLabel } from 'features/notes/components/NoteEditorDialogTags';
import { isDarkMode } from 'utils/themeMode';
import { getShadow, getControlClusterSx } from 'styles/designTokens';

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
  /** Omit to hide the "new note" affordance entirely (read/edit-only panel). */
  onNewNote?: () => void;
  canCreateNote?: boolean;
  /** Optional — toggles pinned state on the given note. */
  onTogglePin?: (note: Note) => void;
  /** Optional — toggles archived state on the given note. */
  onToggleArchive?: (note: Note) => void;
  /**
   * Optional — permanently deletes the given note. The panel renders a
   * built-in confirmation dialog before invoking this callback.
   */
  onDelete?: (note: Note) => void | Promise<void>;
  /** Optional — opens an Orion chat targeted at this note context. */
  onAskOrion?: () => void;
  tab: NotesTab;
  onTabChange: (t: NotesTab) => void;
  pill: NotesTagPill;
  onPillChange: (p: NotesTagPill) => void;
  total: number;
  /**
   * Per-tab counts so badges render on every tab without requiring selection.
   * Falls back to a single-tab badge (driven by `total`) when omitted.
   */
  tabCounts?: { all: number; pinned: number; archived: number };
  /** Hide the "Notes" title + entries count header. Default true. */
  showHeader?: boolean;
  /**
   * Optional controlled value for the inline-expanded row. When provided
   * together with `onExpandedIdChange`, the panel becomes a controlled
   * component and the host owns this state — used by CalendarNotesPanel
   * so the expanded row survives the lg↔︎drawer breakpoint swap.
   */
  expandedId?: string | null;
  onExpandedIdChange?: React.Dispatch<React.SetStateAction<string | null>>;
  /**
   * Skip the inline expand/preview affordance — clicking a row fires
   * `onNoteClick` directly. Used by the standalone /notes page where
   * the full editor is the natural next step; the trade-calendar
   * notes side-panel keeps the expand-preview because there is no
   * dedicated note view to navigate to.
   */
  disableExpand?: boolean;
}

const TAG_COLOR_MAP: Record<string, string> = {
  [GUIDELINE_TAG]: '#a78bfa',
  [STRATEGY_TAG]: '#f472b6',
  [INSIGHT_TAG]: '#f59e0b',
  [SLASH_COMMAND_TAG]: '#facc15',
  [GAME_PLAN_TAG]: '#38bdf8',
  [PSYCHOLOGY_TAG]: '#fb7185',
  [RISK_MANAGEMENT_TAG]: '#ef4444',
  [LESSON_LEARNED_TAG]: '#22c55e',
  [GENERAL_TAG]: '#94a3b8',
};

const FALLBACK_TAG_COLOR = '#94a3b8';
const getTagColor = (tag: string): string => TAG_COLOR_MAP[tag] ?? FALLBACK_TAG_COLOR;

const TAB_LABELS: NotesTab[] = ['all', 'pinned', 'archived'];

const extractPreview = (content: string): string => {
  if (!content) return '';
  try {
    return convertFromRaw(JSON.parse(content)).getPlainText();
  } catch {
    return content;
  }
};

/**
 * Picks the visually leading tag for a note row — first system tag if any,
 * otherwise the first tag, otherwise null.
 */
function getPrimaryTag(note: Note): string | null {
  const tags = note.tags ?? [];
  for (const t of tags) if (t in TAG_COLOR_MAP) return t;
  return tags[0] ?? null;
}

// ─── Tag dot ────────────────────────────────────────────────────────────────

interface TagDotProps {
  tag: string | null;
  size?: number;
}

const TagDot: React.FC<TagDotProps> = ({ tag, size = 8 }) => {
  const color = tag ? getTagColor(tag) : FALLBACK_TAG_COLOR;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
        boxShadow: `0 0 0 2px ${alpha(color, 0.15)}`,
      }}
    />
  );
};

// ─── Segmented tabs (All / Pinned / Archived) ───────────────────────────────

interface TabsCompactProps {
  tab: NotesTab;
  onTabChange: (t: NotesTab) => void;
  /** Count per tab. Each badge renders when its count is a number. */
  counts: { all: number; pinned: number; archived: number };
}

const TabsCompact: React.FC<TabsCompactProps> = ({ tab, onTabChange, counts }) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);

  return (
    <Box
      sx={{
        display: 'flex',
        ...getControlClusterSx(theme),
        borderRadius: '8px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {TAB_LABELS.map((t) => {
        const selected = tab === t;
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        const count = counts[t];
        return (
          <Box
            key={t}
            component="button"
            onClick={() => onTabChange(t)}
            sx={{
              flex: 1,
              px: 1.25,
              py: 0.75,
              bgcolor: selected ? 'primary.main' : 'transparent',
              border: 0,
              borderRadius: '6px',
              color: selected ? 'primary.contrastText' : 'text.secondary',
              font: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              transition: 'all 120ms',
              '&:hover': {
                color: selected ? 'primary.contrastText' : 'text.primary',
              },
            }}
          >
            {label}
            <Box
              component="span"
              sx={{
                fontSize: '0.66rem',
                px: 0.625,
                borderRadius: '999px',
                bgcolor: selected
                  ? alpha('#fff', 0.18)
                  : alpha(theme.palette.text.primary, 0.08),
                color: selected ? 'primary.contrastText' : 'text.secondary',
                fontWeight: 700,
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {count}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Tag filter strip (horizontal scroll) ───────────────────────────────────

interface TagFilterStripProps {
  pill: NotesTagPill;
  onPillChange: (p: NotesTagPill) => void;
  /** [tag → count] across the current note set. */
  tagCounts: Map<string, number>;
  totalCount: number;
}

const TagFilterStrip: React.FC<TagFilterStripProps> = ({
  pill,
  onPillChange,
  tagCounts,
  totalCount,
}) => {
  const theme = useTheme();

  const entries: Array<{ key: string; label: string; color: string | null; count: number }> = [
    { key: 'all', label: 'All', color: null, count: totalCount },
    ...Array.from(tagCounts.entries())
      .sort(([a], [b]) => getTagDisplayLabel(a).localeCompare(getTagDisplayLabel(b)))
      .map(([tag, count]) => ({
        key: tag,
        label: getTagDisplayLabel(tag),
        color: getTagColor(tag),
        count,
      })),
  ];

  const handleClick = useCallback(
    (key: string, target: HTMLElement) => {
      onPillChange(key);
      // Center the clicked chip inside the strip so the next/previous chips
      // peek in — gives the user a clear "what comes next" affordance.
      target.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    },
    [onPillChange],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        scrollSnapType: 'x proximity',
        scrollPaddingInline: 16,
        // Hide scrollbar across engines — chip navigation replaces the thumb.
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none', width: 0, height: 0 },
      }}
    >
      {entries.map((e) => {
        const active = pill === e.key;
        return (
          <Box
            key={e.key}
            component="button"
            onClick={(ev: React.MouseEvent<HTMLButtonElement>) =>
              handleClick(e.key, ev.currentTarget)
            }
            sx={{
              flexShrink: 0,
              scrollSnapAlign: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.625,
              px: 1.125,
              py: 0.5,
              bgcolor: active
                ? alpha(theme.palette.text.primary, 0.06)
                : 'transparent',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '999px',
              color: active ? 'text.primary' : 'text.secondary',
              font: 'inherit',
              fontSize: '0.7rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 120ms',
              '&:hover': {
                color: 'text.primary',
                borderColor: alpha(theme.palette.primary.main, 0.3),
              },
            }}
          >
            {e.color && (
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: e.color,
                }}
              />
            )}
            {e.label}
            <Box
              component="span"
              sx={{
                fontSize: '0.62rem',
                color: 'text.disabled',
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {e.count}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Inline note row (one-line + expandable detail) ─────────────────────────

interface InlineNoteRowProps {
  note: Note;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  onTogglePin?: () => void;
  onToggleArchive?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  tab: NotesTab;
}

const InlineNoteRow: React.FC<InlineNoteRowProps> = ({
  note,
  isLast,
  expanded,
  onToggleExpand,
  onOpen,
  onTogglePin,
  onToggleArchive,
  onDelete,
  isSelected,
  tab,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);

  const primaryTag = useMemo(() => getPrimaryTag(note), [note]);
  const primaryColor = primaryTag ? getTagColor(primaryTag) : FALLBACK_TAG_COLOR;
  const primaryLabel = primaryTag ? getTagDisplayLabel(primaryTag) : null;

  const preview = useMemo(() => {
    const text = extractPreview(note.content);
    return text.length > 220 ? text.slice(0, 220) + '…' : text;
  }, [note.content]);

  const rowBg = expanded || isSelected
    ? alpha(isDark ? '#fff' : '#000', isDark ? 0.04 : 0.03)
    : 'transparent';

  return (
    <Box
      sx={{
        borderBottom: isLast ? 0 : `1px solid ${theme.palette.divider}`,
        bgcolor: rowBg,
        transition: 'background 120ms',
      }}
    >
      {/* One-line summary row — click to expand */}
      <Box
        component="button"
        onClick={onToggleExpand}
        sx={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.1,
          bgcolor: 'transparent',
          border: 0,
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          '&:hover': {
            bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.02),
          },
        }}
      >
        <TagDot tag={primaryTag} size={7} />
        <Typography
          sx={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'text.primary',
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.005em',
          }}
        >
          {note.title || 'Untitled'}
        </Typography>
        {note.is_pinned && (
          <PinIcon
            sx={{ fontSize: '0.72rem', color: 'primary.light', flexShrink: 0 }}
          />
        )}
        {note.by_assistant && (
          <AIIcon
            sx={{
              fontSize: '0.72rem',
              color: 'primary.light',
              opacity: 0.7,
              flexShrink: 0,
            }}
          />
        )}
        {primaryLabel && (
          <Typography
            component="span"
            sx={{
              fontSize: '0.66rem',
              color: primaryColor,
              fontWeight: 600,
              flexShrink: 0,
              textTransform: 'lowercase',
            }}
          >
            {primaryLabel}
          </Typography>
        )}
        <Typography
          component="span"
          sx={{
            fontSize: '0.66rem',
            color: 'text.disabled',
            flexShrink: 0,
            minWidth: 34,
            textAlign: 'right',
            fontFeatureSettings: "'tnum' on, 'lnum' on",
          }}
        >
          {format(new Date(note.updated_at), 'MMM d')}
        </Typography>
      </Box>

      {/* Expanded detail */}
      {expanded && (
        <Box sx={{ px: 1.5, pl: 3.25, pb: 1.5 }}>
          {preview && (
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: 'text.secondary',
                lineHeight: 1.55,
                pb: 1,
                borderLeft: `2px solid ${alpha(primaryColor, 0.4)}`,
                pl: 1.25,
                ml: -0.5,
              }}
            >
              {preview}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ActionButton primary onClick={onOpen} icon={<ArrowForwardIcon sx={{ fontSize: '0.72rem' }} />}>
              Open
            </ActionButton>
            {onTogglePin && (
              <ActionButton
                onClick={onTogglePin}
                icon={
                  note.is_pinned
                    ? <PinIcon sx={{ fontSize: '0.72rem' }} />
                    : <PinOutlineIcon sx={{ fontSize: '0.72rem' }} />
                }
              >
                {note.is_pinned ? 'Unpin' : 'Pin'}
              </ActionButton>
            )}
            {onToggleArchive && (
              <ActionButton
                onClick={onToggleArchive}
                icon={
                  tab === 'archived'
                    ? <UnarchiveIcon sx={{ fontSize: '0.72rem' }} />
                    : <ArchiveIcon sx={{ fontSize: '0.72rem' }} />
                }
              >
                {tab === 'archived' ? 'Restore' : 'Archive'}
              </ActionButton>
            )}
            {onDelete && (
              <ActionButton
                onClick={onDelete}
                danger
                icon={<DeleteIcon sx={{ fontSize: '0.72rem' }} />}
              >
                Delete
              </ActionButton>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

interface ActionButtonProps {
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ primary, danger, onClick, icon, children }) => {
  const theme = useTheme();
  const idleColor = danger ? theme.palette.error.main : theme.palette.text.secondary;
  const hoverBg = danger
    ? alpha(theme.palette.error.main, 0.08)
    : alpha(theme.palette.text.primary, 0.04);
  const hoverColor = danger ? theme.palette.error.main : theme.palette.text.primary;
  const idleBorder = danger
    ? alpha(theme.palette.error.main, 0.35)
    : theme.palette.divider;
  return (
    <Box
      component="button"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        height: 26,
        px: 1.125,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: primary ? 'primary.main' : 'transparent',
        border: primary ? 0 : `1px solid ${idleBorder}`,
        borderRadius: '6px',
        color: primary ? 'primary.contrastText' : idleColor,
        font: 'inherit',
        fontSize: '0.7rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms',
        '&:hover': {
          bgcolor: primary ? 'primary.dark' : hoverBg,
          color: primary ? 'primary.contrastText' : hoverColor,
        },
      }}
    >
      {icon}
      {children}
    </Box>
  );
};

// ─── Main panel ─────────────────────────────────────────────────────────────

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
  onTogglePin,
  onToggleArchive,
  onDelete,
  onAskOrion,
  tab,
  onTabChange,
  pill,
  onPillChange,
  total,
  tabCounts,
  showHeader = true,
  expandedId: expandedIdProp,
  onExpandedIdChange,
  disableExpand = false,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);

  const [expandedIdInternal, setExpandedIdInternal] = useState<string | null>(null);
  const isControlled = expandedIdProp !== undefined && onExpandedIdChange !== undefined;
  const expandedId = isControlled ? expandedIdProp ?? null : expandedIdInternal;
  const setExpandedId = isControlled ? onExpandedIdChange! : setExpandedIdInternal;
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tag → count across the current note set
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return counts;
  }, [notes]);

  // Tag pill filters locally; tab scoped via useNotes
  const filteredNotes = useMemo(() => {
    if (pill === 'all') return notes;
    return notes.filter((n) => n.tags?.includes(pill));
  }, [notes, pill]);

  const handleRowToggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const handleOpen = useCallback((note: Note) => {
    onNoteClick(note);
  }, [onNoteClick]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !onDelete) return;
    try {
      setDeleting(true);
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDelete]);

  const activeFilterLabel = pill === 'all' ? 'All tags' : getTagDisplayLabel(pill);

  return (
    <Box
      sx={{
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header — only when not embedded inside a labeled drawer/panel */}
      {showHeader && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.75,
            pt: 1.75,
            pb: 1.25,
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '8px',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.light',
            }}
          >
            <NotesIcon sx={{ fontSize: '1rem' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Notes
            </Typography>
            <Typography
              sx={{
                fontSize: '0.66rem',
                color: 'text.disabled',
                fontFeatureSettings: "'tnum' on",
                mt: '1px',
              }}
            >
              {total} {total === 1 ? 'note' : 'notes'}
            </Typography>
          </Box>
          {onNewNote && (
            <Tooltip
              title={canCreateNote ? 'New note' : 'Pick a specific calendar first'}
              placement="left"
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon sx={{ fontSize: '0.85rem' }} />}
                  disabled={!canCreateNote}
                  onClick={onNewNote}
                  sx={{
                    height: 30,
                    px: 1.25,
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: `0 2px 6px ${alpha(theme.palette.primary.main, 0.35)}`,
                  }}
                >
                  New
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ px: 1.75, pt: showHeader ? 0 : 1.5, pb: 1 }}>
        <TabsCompact
          tab={tab}
          onTabChange={onTabChange}
          counts={
            tabCounts ?? {
              // Fallback when the caller didn't supply per-tab counts: show
              // the active tab's total, leave the other two at 0.
              all: tab === 'all' ? total : 0,
              pinned: tab === 'pinned' ? total : 0,
              archived: tab === 'archived' ? total : 0,
            }
          }
        />
      </Box>

      {/* Search + filter dropdown */}
      <Box sx={{ px: 1.75, pb: 1, display: 'flex', gap: 0.75 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search notes…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '0.95rem', color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
                  <ClearIcon sx={{ fontSize: '0.85rem' }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
            sx: {
              borderRadius: '8px',
              fontSize: '0.8rem',
              bgcolor: alpha(isDark ? '#fff' : '#000', 0.03),
              '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            },
          }}
        />
        <Box
          component="button"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{
            height: 34,
            px: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 0.625,
            bgcolor: alpha(isDark ? '#fff' : '#000', 0.03),
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '8px',
            color: pill === 'all' ? 'text.secondary' : 'text.primary',
            font: 'inherit',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 120ms',
            '&:hover': {
              borderColor: alpha(theme.palette.primary.main, 0.4),
            },
          }}
        >
          <FilterListIcon sx={{ fontSize: '0.85rem' }} />
          {activeFilterLabel}
          <ArrowDownIcon sx={{ fontSize: '0.85rem' }} />
        </Box>
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
          slotProps={{
            paper: {
              sx: { minWidth: 180, borderRadius: '10px', mt: 0.5 },
            },
          }}
        >
          <MenuItem
            selected={pill === 'all'}
            onClick={() => { onPillChange('all'); setFilterAnchor(null); }}
            sx={{ fontSize: '0.82rem' }}
          >
            All tags
            <Box
              component="span"
              sx={{
                ml: 'auto',
                fontSize: '0.7rem',
                color: 'text.disabled',
                fontFeatureSettings: "'tnum' on",
              }}
            >
              {notes.length}
            </Box>
          </MenuItem>
          {Array.from(tagCounts.entries())
            .sort(([a], [b]) => getTagDisplayLabel(a).localeCompare(getTagDisplayLabel(b)))
            .map(([t, count]) => (
              <MenuItem
                key={t}
                selected={pill === t}
                onClick={() => { onPillChange(t); setFilterAnchor(null); }}
                sx={{ fontSize: '0.82rem', gap: 1 }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: getTagColor(t),
                    flexShrink: 0,
                  }}
                />
                {getTagDisplayLabel(t)}
                <Box
                  component="span"
                  sx={{
                    ml: 'auto',
                    fontSize: '0.7rem',
                    color: 'text.disabled',
                    fontFeatureSettings: "'tnum' on",
                  }}
                >
                  {count}
                </Box>
              </MenuItem>
            ))}
        </Menu>
      </Box>

      {/* Tag filter strip */}
      {tagCounts.size > 0 && (
        <Box sx={{ px: 1.75, pb: 1.25 }}>
          <TagFilterStrip
            pill={pill}
            onPillChange={onPillChange}
            tagCounts={tagCounts}
            totalCount={notes.length}
          />
        </Box>
      )}

      {/* List — container card */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 1.25, ...scrollbarStyles(theme) }}>
        {loading ? (
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '10px',
              boxShadow: getShadow(theme, 'md'),
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  px: 1.5,
                  py: 1.1,
                  borderBottom: i === 5 ? 0 : `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.text.primary, 0.08),
                  }}
                />
                <Box
                  sx={{
                    height: 11,
                    flex: 1,
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                    borderRadius: 1,
                  }}
                />
                <Box
                  sx={{
                    height: 10,
                    width: 36,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                    borderRadius: 1,
                  }}
                />
              </Box>
            ))}
          </Box>
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
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '10px',
                boxShadow: getShadow(theme, 'md'),
                overflow: 'hidden',
              }}
            >
              {filteredNotes.map((note, i) => (
                <InlineNoteRow
                  key={note.id}
                  note={note}
                  isLast={i === filteredNotes.length - 1}
                  expanded={!disableExpand && expandedId === note.id}
                  // In disable-expand mode, the row's primary click goes
                  // straight to `onOpen` (e.g. /notes opens the editor).
                  // Otherwise the click toggles the inline preview, and
                  // an Open button inside the preview fires `onOpen`.
                  onToggleExpand={
                    disableExpand
                      ? () => handleOpen(note)
                      : () => handleRowToggle(note.id)
                  }
                  onOpen={() => handleOpen(note)}
                  onTogglePin={onTogglePin ? () => onTogglePin(note) : undefined}
                  onToggleArchive={onToggleArchive ? () => onToggleArchive(note) : undefined}
                  onDelete={onDelete ? () => setDeleteTarget(note) : undefined}
                  isSelected={note.id === selectedNoteId}
                  tab={tab}
                />
              ))}
            </Box>
            {hasMore && (
              <Box sx={{ pt: 1.25, display: 'flex', justifyContent: 'center' }}>
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

      {/* Footer — only rendered when a distinct footer action exists.
          The header already carries the New-note CTA, so don't duplicate
          it here. */}
      {onAskOrion && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.75,
            py: 1.25,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.disabled',
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {total} {total === 1 ? 'note' : 'notes'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<SparkleIcon sx={{ fontSize: '0.78rem', color: 'primary.light' }} />}
            onClick={onAskOrion}
            sx={{
              height: 30,
              px: 1.25,
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: theme.palette.divider,
              color: 'text.secondary',
              bgcolor: alpha(isDark ? '#fff' : '#000', 0.02),
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            Ask Orion
          </Button>
        </Box>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Note"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete "${deleteTarget.title || 'Untitled'}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isSubmitting={deleting}
      />
    </Box>
  );
};

export default NoteListPanel;
