import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Editor, EditorState, ContentState, CompositeDecorator, Modifier, SelectionState } from 'draft-js';
import { Box, Chip, Popper, Paper, List, ListItem, ListItemButton, Typography, useTheme, alpha } from '@mui/material';
import { Tag as TagIcon } from '@mui/icons-material';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../../utils/tagColors';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

export interface AIChatMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  allTags: string[];
  maxRows?: number;
  sx?: any;
}

const createTagMentionComponent = () => {
  const TagMentionEntity = ({ contentState, entityKey }: any) => {
    const theme = useTheme();
    const { tag } = contentState.getEntity(entityKey).getData() as { tag: string };

    // Simple: render a Chip instead of the underlying text. We intentionally
    // do NOT render children here so the raw text is not shown.
    return (
      <Chip
        size="small"
        label={formatTagForDisplay(tag, true)}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        sx={{
          ...getTagChipStyles(tag, theme),
          height: 22,
          fontSize: '0.75rem',
          userSelect: 'none',
          verticalAlign: 'middle',
          display: 'inline-flex'
        }}
      />
    );
  };
  (TagMentionEntity as any).displayName = 'TagMentionEntity';
  return TagMentionEntity;
};

const AtSymbolHidden = ({ children }: any) => (
  <span style={{ opacity: 0 }}>{children}</span>
);

const createMentionDecorator = () =>
  new CompositeDecorator([
    {
      // Render tag mentions as chips
      strategy: (block, callback, contentState) => {
        block.findEntityRanges(
          ch => {
            const k = ch.getEntity();
            return !!k && contentState.getEntity(k).getType() === 'TAG_MENTION';
          },
          (start, end) => callback(start, end)
        );
      },
      component: createTagMentionComponent()
    },
    {
      // Hide stray '@' characters that are not followed by mention text
      // (i.e. '@' at the end of a word or followed by whitespace). This
      // keeps '@' visible while typing (e.g. '@0.79'), but hides bugs where
      // an extra '@ ' is left between chips.
      strategy: (block, callback) => {
        const text = block.getText();
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] === '@') {
            const next = text[i + 1];
            if (!next || /\s/.test(next)) {
              callback(i, i + 1);
            }
          }
        }
      },
      component: AtSymbolHidden
    }
  ]);

const AIChatMentionInput = forwardRef<any, AIChatMentionInputProps>(({
  value, onChange, onKeyDown, placeholder, disabled, allTags, maxRows = 4, sx
}, ref) => {
  const theme = useTheme();
  const editorRef = useRef<Editor>(null as any);
  const [editorState, setEditorState] = useState(() => EditorState.createWithContent(ContentState.createFromText(value || ''), createMentionDecorator()));
  const editorStateRef = useRef(editorState);
  const [mention, setMention] = useState<{ open: boolean; term: string; start: number; blockKey: string } | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => editorRef.current && (editorRef.current as any).focus?.() }));

  useEffect(() => {
    // keep external value in sync if it changes from outside
    const currentText = editorState.getCurrentContent().getPlainText();
    console.log('useEffect - value prop:', value, 'current text:', currentText);
    if (value !== currentText) {
      console.log('useEffect - recreating editor state from value:', value);
      setEditorState(
        EditorState.createWithContent(
          ContentState.createFromText(value || ''),
          createMentionDecorator()
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  const tags = useMemo(() => allTags.sort(), [allTags]);
  const filtered = useMemo(() => (mention?.term ? tags.filter(t => t.toLowerCase().includes(mention.term.toLowerCase())) : tags).slice(0, 50), [tags, mention]);

  function updateMentionState(state: EditorState) {
    const sel = state.getSelection();
    if (!sel.isCollapsed()) return setMention(null);
    const content = state.getCurrentContent();
    const blockKey = sel.getStartKey();
    const block = content.getBlockForKey(blockKey);
    const offset = sel.getStartOffset();
    const text = block.getText().slice(0, offset);
    const at = text.lastIndexOf('@');
    if (at === -1) return setMention(null);
    if (at > 0 && /[^\s]/.test(text[at - 1])) return setMention(null);
    const term = text.slice(at + 1);
    if (/[^A-Za-z0-9:_.-]/.test(term)) return setMention(null);
    setMention({ open: true, term, start: at, blockKey });
    setAnchorEl(containerRef.current);
    setSelectedIndex(0);
  }

  function handleChange(state: EditorState) {
    const plainText = state.getCurrentContent().getPlainText();
    console.log('handleChange - plain text:', plainText);
    setEditorState(state);
    onChange(plainText);
    updateMentionState(state);
  }

  function handleKeyDownLocal(e: React.KeyboardEvent) {
    if (mention?.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIndex]) insertTag(filtered[selectedIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return; }
    }

    // Prevent @ from being inserted - we'll handle it in handleChange via updateMentionState
    if (e.key === '@' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't prevent default - let Draft.js insert the @ so updateMentionState can detect it
      // The @ will be replaced when a tag is selected
    }

    const sel = editorState.getSelection();
    if (sel.isCollapsed()) {
      const content = editorState.getCurrentContent();
      const block = content.getBlockForKey(sel.getStartKey());
      const offset = sel.getStartOffset();
      if (e.key === 'Backspace' && offset > 0) {
        const text = block.getText();
        if (text[offset - 1] === ' ' && offset > 1) {
          const ekBeforeSpace = block.getEntityAt(offset - 2);
          if (ekBeforeSpace && content.getEntity(ekBeforeSpace).getType() === 'TAG_MENTION') { e.preventDefault(); handleRemoveEntity(ekBeforeSpace, true); return; }
        }

        const ek = block.getEntityAt(offset - 1);
        if (ek && content.getEntity(ek).getType() === 'TAG_MENTION') { e.preventDefault(); handleRemoveEntity(ek); return; }
      }
    }
    onKeyDown?.(e);
  }

  function insertTag(tag: string) {
    // Always operate on the latest editor state
    const state = editorStateRef.current || editorState;
    const selection = state.getSelection();

    // We only handle collapsed selection (caret position)
    if (!selection.isCollapsed()) {
      setMention(null);
      return;
    }

    const content = state.getCurrentContent();
    const blockKey = selection.getStartKey();
    const block = content.getBlockForKey(blockKey);
    const text = block.getText();
    const offset = selection.getStartOffset();

    // Find the '@' that starts this mention by scanning backwards from the cursor
    let atIndex = -1;
    for (let i = offset - 1; i >= 0; i -= 1) {
      const ch = text[i];
      if (ch === '@') {
        // Require start-of-line or whitespace before '@' so we don't match emails, etc.
        if (i === 0 || /\s/.test(text[i - 1])) {
          atIndex = i;
        }
        break;
      }
      if (/\s/.test(ch)) {
        // Hit whitespace before finding an '@' – no valid mention here
        break;
      }
    }

    if (atIndex === -1) {
      setMention(null);
      return;
    }

    const mentionText = tag; // raw tag, without '@'

    // Selection from '@' up to current caret position
    const replaceSel = SelectionState.createEmpty(blockKey).merge({
      anchorOffset: atIndex,
      focusOffset: offset
    }) as SelectionState;

    // Step 1: replace the @mention text with the tag text
    let newContent = Modifier.replaceText(content, replaceSel, mentionText);

    // Step 2: create an entity for this tag and apply it over the inserted text
    newContent = newContent.createEntity('TAG_MENTION', 'IMMUTABLE', { tag });
    const entityKey = newContent.getLastCreatedEntityKey();

    const entityRange = SelectionState.createEmpty(blockKey).merge({
      anchorOffset: atIndex,
      focusOffset: atIndex + mentionText.length
    }) as SelectionState;
    newContent = Modifier.applyEntity(newContent, entityRange, entityKey);

    // Step 3: insert a trailing space after the chip
    const afterMention = SelectionState.createEmpty(blockKey).merge({
      anchorOffset: atIndex + mentionText.length,
      focusOffset: atIndex + mentionText.length
    }) as SelectionState;
    newContent = Modifier.insertText(newContent, afterMention, ' ');

    // Push updated content into editor state and move cursor after the space
    let newState = EditorState.push(state, newContent, 'insert-characters');
    const cursorPosition = SelectionState.createEmpty(blockKey).merge({
      anchorOffset: atIndex + mentionText.length + 1,
      focusOffset: atIndex + mentionText.length + 1
    }) as SelectionState;
    newState = EditorState.forceSelection(newState, cursorPosition);

    console.log('Final text:', newState.getCurrentContent().getBlockForKey(blockKey).getText());
    console.log('=== END INSERT TAG DEBUG ===');

    setMention(null);
    handleChange(newState);

    // Refocus editor
    setTimeout(() => {
      try {
        (editorRef.current as any)?.focus?.();
      } catch (_) {}
    }, 0);
  }

  function handleRemoveEntity(entityKey: string, includeFollowingSpace = false) {
    const state = editorStateRef.current || editorState;
    const content = state.getCurrentContent();
    const blocks = content.getBlocksAsArray();
    for (const b of blocks) {
      let s = -1, e = -1;
      b.findEntityRanges(ch => ch.getEntity() === entityKey, (start, end) => { s = start; e = end; });
      if (s >= 0) {
        let focusOffset = e;
        if (includeFollowingSpace) {
          const txt = b.getText();
          if (txt[e] === ' ') focusOffset = e + 1;
        }
        const sel = SelectionState.createEmpty(b.getKey()).merge({ anchorOffset: s, focusOffset }) as SelectionState;
        const c2 = Modifier.removeRange(content, sel, 'backward');
        const st = EditorState.push(state, c2, 'remove-range');
        handleChange(st);
        return;
      }
    }
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <Box
        onClick={() => editorRef.current && (editorRef.current as any).focus?.()}
        onKeyDown={handleKeyDownLocal}
        sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.5, border: 'none', backgroundColor: 'transparent', cursor: 'text',
          width: '100%', maxWidth: '100%', minWidth: 0,
          '& .DraftEditor-root': { width: '100%' },
          '& .public-DraftEditor-content': {
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxHeight: `${maxRows * 1.6}em`,
            overflowY: 'auto',
            ...scrollbarStyles(theme)
          },
          '& .public-DraftEditorPlaceholder-root': { whiteSpace: 'pre-wrap' },
          ...sx
        }}
      >
        <Editor
          ref={editorRef as any}
          editorState={editorState}
          onChange={handleChange}
          readOnly={!!disabled}
          placeholder={placeholder}
        />
      </Box>

      <Popper
        open={!!mention?.open}
        anchorEl={anchorEl}
        placement="top-start"
        disablePortal
        sx={{ zIndex: 1500 }}
      >
        <Paper
          elevation={8}
          sx={{
            maxHeight: 220,
            minWidth: 250,
            maxWidth: 400,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.primary.main, 0.04)
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}
            >
              <TagIcon sx={{ fontSize: 14 }} /> Select a tag to mention ({filtered.length} available)
            </Typography>
          </Box>
          <List sx={{ maxHeight: 170, overflow: 'auto', p: 0, ...scrollbarStyles(theme) }}>
            {filtered.length === 0 ? (
              <ListItem>
                <Box sx={{ p: 2, textAlign: 'center', width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    {allTags.length === 0
                      ? 'No tags available. Add tags to your calendar to mention them here.'
                      : `No tags found matching "${mention?.term || ''}"`}
                  </Typography>
                </Box>
              </ListItem>
            ) : (
              filtered.map((tag, idx) => (
                <ListItem key={tag} disablePadding>
                  <ListItemButton
                    selected={idx === selectedIndex}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent editor from losing focus
                      insertTag(tag);
                    }}
                    onClick={(e) => {
                      // Fallback for environments where onMouseDown does not fire (e.g. some touch devices)
                      e.preventDefault();
                      insertTag(tag);
                    }}
                    sx={{ py: 1, px: 2 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Chip
                        label={formatTagForDisplay(tag, true)}
                        size="small"
                        sx={{ ...getTagChipStyles(tag, theme), height: 20, fontSize: '0.7rem' }}
                      />
                      {isGroupedTag(tag) && (
                        <Typography variant="caption" color="text.secondary">
                          {getTagGroup(tag)}
                        </Typography>
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
});

AIChatMentionInput.displayName = 'AIChatMentionInput';
export default AIChatMentionInput;

