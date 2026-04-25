import React, { useMemo, useState } from 'react';
import { Box, Collapse, Typography, IconButton } from '@mui/material';
import { ExpandLess, ExpandMore, LabelOutlined } from '@mui/icons-material';

import NoteListItem from './NoteListItem';
import {
  getTagDisplayLabel,
  getTagSubtitle,
  getTagIcon,
} from './NoteEditorDialog';
import { Note } from '../../types/note';
import { Calendar } from '../../types/calendar';

const UNTAGGED = '__untagged';
const UNTAGGED_LABEL = 'Untagged';

interface NotesTagViewProps {
  notes: Note[];
  calendars: Calendar[];
  showCalendarBadge: boolean;
  isReadOnly: boolean;
  onNoteClick: (note: Note) => void;
  onPin?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onUnarchive?: (note: Note) => void;
  onConvertToUserNote?: (note: Note) => void;
}

export const NotesTagView: React.FC<NotesTagViewProps> = ({
  notes,
  calendars,
  showCalendarBadge,
  isReadOnly,
  onNoteClick,
  onPin,
  onArchive,
  onUnarchive,
  onConvertToUserNote,
}) => {
  const groups = useMemo(() => {
    const byTag = new Map<string, Note[]>();
    for (const note of notes) {
      const tags = note.tags && note.tags.length > 0 ? note.tags : [UNTAGGED];
      for (const tag of tags) {
        const arr = byTag.get(tag) ?? [];
        arr.push(note);
        byTag.set(tag, arr);
      }
    }
    const keys = Array.from(byTag.keys())
      .filter(k => k !== UNTAGGED)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (byTag.has(UNTAGGED)) keys.push(UNTAGGED);
    return keys.map(k => ({
      key: k,
      label: k === UNTAGGED ? UNTAGGED_LABEL : getTagDisplayLabel(k),
      subtitle: k === UNTAGGED ? '' : getTagSubtitle(k),
      Icon: k === UNTAGGED ? undefined : getTagIcon(k),
      items: byTag.get(k)!,
    }));
  }, [notes]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const defaultExpanded = groups.length <= 3;

  const isOpen = (key: string) =>
    expanded[key] === undefined ? defaultExpanded : expanded[key];
  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !isOpen(key) }));

  const getCalendarForNote = (note: Note) =>
    calendars.find(c => c.id === note.calendar_id);

  if (groups.length === 0) return null;

  return (
    <Box>
      {groups.map(group => {
        const HeaderIcon = group.Icon ?? LabelOutlined;
        return (
        <Box key={group.key} sx={{ mb: 1 }}>
          <Box
            onClick={() => toggle(group.key)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              py: 0.75,
              px: 1,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <HeaderIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
              {group.label}
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                {group.items.length}
              </Typography>
            </Typography>
            <IconButton size="small" edge="end" aria-label={isOpen(group.key) ? 'Collapse' : 'Expand'}>
              {isOpen(group.key) ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Box>

          <Collapse in={isOpen(group.key)} timeout="auto" unmountOnExit>
            {group.subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  px: 1,
                  pb: 1,
                  pt: 1,
                  fontStyle: 'italic',
                }}
              >
                {group.subtitle}
              </Typography>
            )}
            {group.items.map(note => (
              <NoteListItem
                key={`${group.key}-${note.id}`}
                note={note}
                onClick={onNoteClick}
                onPin={isReadOnly ? undefined : onPin}
                onArchive={isReadOnly ? undefined : onArchive}
                onUnarchive={isReadOnly ? undefined : onUnarchive}
                onConvertToUserNote={isReadOnly ? undefined : onConvertToUserNote}
                calendar={getCalendarForNote(note)}
                showCalendarBadge={showCalendarBadge}
              />
            ))}
          </Collapse>
        </Box>
        );
      })}
    </Box>
  );
};

export default NotesTagView;
