import React, { useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import {
  TextField,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Box,
  Typography,
  useTheme,
  alpha,
  Popper,
  ClickAwayListener
} from '@mui/material';
import { Tag as TagIcon } from '@mui/icons-material';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup
} from '../../utils/tagColors';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface TagMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  allTags: string[];
  // Optional: external control of selected mention tags as chips
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  multiline?: boolean;
  maxRows?: number;
  variant?: 'standard' | 'outlined' | 'filled';
  InputProps?: any;
  sx?: any;
}

interface MentionState {
  isOpen: boolean;
  searchTerm: string;
  cursorPosition: number;
  mentionStartPosition: number;
}

const TagMentionInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TagMentionInputProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  allTags,
  tags,
  onTagsChange,
  multiline = false,
  maxRows = 4,
  variant = 'standard',
  InputProps,
  sx
}, forwardedRef) => {
  const theme = useTheme();
  const internalRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  // Forward the ref to the parent
  const inputRef = internalRef;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [mentionState, setMentionState] = useState<MentionState>({
    isOpen: false,
    searchTerm: '',
    cursorPosition: 0,
    mentionStartPosition: 0
  });

  // Chip (mention tags) state: use external control if provided, otherwise internal state
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const selectedTags = (typeof tags !== 'undefined') ? tags : internalTags;
  const setSelectedTags = (onTagsChange ?? setInternalTags);
  const removeTag = (tag: string) => setSelectedTags(selectedTags.filter(t => t !== tag));

  useEffect(() => {
    if (typeof forwardedRef === 'function') {
      forwardedRef(internalRef.current);
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>).current = internalRef.current;
    }
  });

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && mentionState.isOpen) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex, mentionState.isOpen]);

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!mentionState.searchTerm) return allTags;

    const searchLower = mentionState.searchTerm.toLowerCase();
    return allTags.filter(tag =>
      tag.toLowerCase().includes(searchLower) ||
      formatTagForDisplay(tag).toLowerCase().includes(searchLower) ||
      (isGroupedTag(tag) && getTagGroup(tag).toLowerCase().includes(searchLower))
    );
  }, [allTags, mentionState.searchTerm]);

  // Handle input change and detect @ mentions
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    const cursorPos = event.target.selectionStart || 0;

    onChange(newValue);

    // Check for @ mention trigger
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || lastAtIndex === 0) {
        const searchTerm = textBeforeCursor.substring(lastAtIndex + 1);

        // Only show mentions if search term doesn't contain spaces (incomplete mention)
        if (!searchTerm.includes(' ') && allTags.length > 0) {
          setMentionState({
            isOpen: true,
            searchTerm,
            cursorPosition: cursorPos,
            mentionStartPosition: lastAtIndex
          });
          setSelectedIndex(0);
          setAnchorEl(inputRef.current);
          return;
        }
      }
    }

    // Close mentions if not in mention mode
    if (mentionState.isOpen) {
      setMentionState(prev => ({ ...prev, isOpen: false }));
      setAnchorEl(null);
    }
  };

  // Handle key navigation in mention dropdown
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (mentionState.isOpen && filteredTags.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredTags.length);
          return; // Don't call parent handler
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredTags.length) % filteredTags.length);
          return; // Don't call parent handler
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          insertTag(filteredTags[selectedIndex]);
          return; // Don't call parent handler - prevents form submission
        case 'Escape':
          event.preventDefault();
          closeMentions();
          return; // Don't call parent handler
        default:
          // Let other keys pass through to trigger input change
          break;
      }
    }

    // Call parent onKeyDown only if we didn't handle it above
    onKeyDown?.(event);
  };

  // Insert selected tag as a chip (remove the typed @mention text including the @ symbol)
  const insertTag = (tag: string) => {
    // Find the end of the mention text by looking for the next space or end of string
    // Start from position after the @ symbol
    const textAfterAt = value.substring(mentionState.mentionStartPosition + 1);
    const spaceIndex = textAfterAt.indexOf(' ');

    // Calculate where the mention ends (either at space or end of string)
    const mentionEndPosition = spaceIndex === -1
      ? value.length
      : mentionState.mentionStartPosition + 1 + spaceIndex;

    // Get text before the @ and after the mention
    const beforeMention = value.substring(0, mentionState.mentionStartPosition);
    const afterMention = value.substring(mentionEndPosition);

    // Combine and clean up extra spaces
    const newValue = (beforeMention + afterMention).replace(/\s{2,}/g, ' ').trim();
    onChange(newValue);

    // Add to selected tag chips
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }

    // Restore caret position
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);

    closeMentions();
  };

  // Close mention dropdown
  const closeMentions = () => {
    setMentionState(prev => ({ ...prev, isOpen: false }));
    setAnchorEl(null);
    setSelectedIndex(0);
  };

  // Handle clicking away from mentions
  const handleClickAway = () => {
    if (mentionState.isOpen) {
      closeMentions();
    }
  };

  // Handle tag click
  const handleTagClick = (tag: string) => {
    insertTag(tag);
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box
          onClick={() => inputRef.current?.focus()}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.paper',
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: `${alpha(theme.palette.primary.main, 0.12)} 0 0 0 2px`
            }
          }}
        >
          {selectedTags.map(tag => (
            <Chip
              key={tag}
              label={formatTagForDisplay(tag, true)}
              size="small"
              onDelete={() => removeTag(tag)}
              sx={{ ...getTagChipStyles(tag, theme), height: 22, fontSize: '0.75rem' }}
            />
          ))}
          <TextField
            inputRef={inputRef}
            multiline={multiline}
            maxRows={maxRows}
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            variant={variant}
            InputProps={InputProps}
            sx={{
              flex: 1,
              minWidth: 120,
              width: 'auto',
              m: 0,
              '& .MuiInputBase-root': { p: 0, width: 'auto' },
              '& .MuiInputBase-input': { py: 0.5 },
              ...sx
            }}
          />
        </Box>

        {/* Mention Dropdown */}
        <Popper
          open={mentionState.isOpen}
          anchorEl={anchorEl}
          placement="top-start"
          disablePortal={true}
          sx={{ zIndex: 1500 }}
          modifiers={[
            {
              name: 'offset',
              options: {
                offset: [0, 8],
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['bottom-start', 'top-end', 'bottom-end'],
              },
            },
          ]}
        >
          <Paper
            elevation={8}
            sx={{
              maxHeight: 200,
              minWidth: 250,
              maxWidth: 400,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.04) }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}>
                <TagIcon sx={{ fontSize: 14 }} />
                Select a tag to mention ({filteredTags.length} available)
              </Typography>
            </Box>

            <List
              sx={{
                maxHeight: 160,
                overflow: 'auto',
                p: 0,
                ...scrollbarStyles(theme)
              }}
            >
              {filteredTags.length === 0 ? (
                <ListItem>
                  <Box sx={{ p: 2, textAlign: 'center', width: '100%' }}>
                    <Typography variant="body2" color="text.secondary">
                      No tags found matching "{mentionState.searchTerm}"
                    </Typography>
                  </Box>
                </ListItem>
              ) : (
                filteredTags.map((tag, index) => (
                  <ListItem
                    key={tag}
                    disablePadding
                    ref={index === selectedIndex ? selectedItemRef : null}
                  >
                    <ListItemButton
                      selected={index === selectedIndex}
                      onClick={() => handleTagClick(tag)}
                      sx={{
                        py: 1,
                        px: 2,
                        '&.Mui-selected': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.12),
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.16)
                          }
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Chip
                          label={formatTagForDisplay(tag, true)}
                          size="small"
                          sx={{
                            ...getTagChipStyles(tag, theme),
                            height: 20,
                            fontSize: '0.7rem'
                          }}
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
    </ClickAwayListener>
  );
});

TagMentionInput.displayName = 'TagMentionInput';

export default TagMentionInput;
