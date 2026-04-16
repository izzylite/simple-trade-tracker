import React, {
  useState, useRef, useEffect, useMemo,
  forwardRef, useImperativeHandle, useCallback
} from 'react';
import {
  Box,
  Typography,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Editor, EditorState, convertToRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

// Import utilities, constants, and hooks
import { createEditorStateFromValue } from './RichTextEditor/utils/draftUtils';
import { TEXT_COLORS, BACKGROUND_COLORS } from './RichTextEditor/constants/colors';
import { useFloatingToolbar } from './RichTextEditor/hooks/useFloatingToolbar';

// Import new utility functions
import {
  getCurrentLink,
  createLinkEntity,
  removeLinkEntity
} from './RichTextEditor/utils/linkUtils';
import {
  insertTagEntity,
  getAtMentionTrigger,
  replaceAtMentionWithTag
} from './RichTextEditor/utils/tagEntityUtils';
import {
  getNoteTrigger,
  replaceNoteTriggerWithLink,
} from './RichTextEditor/utils/noteEntityUtils';
import {
  getEventTrigger,
  replaceEventTriggerWithLink,
} from './RichTextEditor/utils/eventEntityUtils';
import type {
  ImpactLevel,
  Currency,
} from '../../types/economicCalendar';
import {
  toggleInlineStyle,
  toggleBlockType,
  applyTextColor,
  applyBackgroundColor,
  applyHeading,
  clearFormatting,
  blockStyleFn,
  restoreScrollAndFocus
} from './RichTextEditor/utils/editorActions';
import { keyBindingFn, handleKeyCommand } from './RichTextEditor/utils/keyboardUtils';
import { createStyleMap } from './RichTextEditor/utils/styleUtils';
import {
  handleLinkDialogOpen,
  handleLinkDialogClose
} from './RichTextEditor/utils/linkDialogUtils';
import { createDecorator } from './RichTextEditor/utils/decoratorUtils';
import { insertImage, removeImageBlock } from './RichTextEditor/utils/imageUtils';
import ImageBlock from './RichTextEditor/components/ImageBlock';
import ImageUploadDialog from './RichTextEditor/components/ImageUploadDialog';
import EditorToolbar from './RichTextEditor/components/EditorToolbar';

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  disabled?: boolean;
  hideCharacterCount?: boolean;
  maxLength?: number;
  // Toolbar variant: 'floating' (default), 'sticky', or 'none'
  toolbarVariant?: 'floating' | 'sticky' | 'none';
  // Sticky toolbar position: 'top' (default) or 'bottom'
  stickyPosition?: 'top' | 'bottom';
  // Optional props for trade link navigation
  calendarId?: string;
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Available trade tags for @ mention insertion
  availableTradeTags?: string[];
  // Callback when mention state changes (for parent to re-render)
  onMentionStateChange?: (active: boolean) => void;
  // Note linking - available notes for /note picker
  availableNotes?: Array<{
    id: string;
    title: string;
    color?: string;
    calendar_name?: string;
  }>;
  onNoteLinkStateChange?: (active: boolean) => void;
  onNoteLinkSearch?: (query: string) => void;
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void;
  // Event linking - pinned events for /event picker
  availableEvents?: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
  onEventLinkStateChange?: (active: boolean) => void;
  onEventLinkClick?: (
    eventId: string,
    eventName: string,
    currency: Currency,
    impact: ImpactLevel
  ) => void;
  // Callback for shared trade link clicks (inline preview)
  onSharedTradeClick?: (shareId: string, tradeId: string) => void;
}

// Ref handle for external toolbar control
export interface RichTextEditorHandle {
  editorState: EditorState;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  toggleInlineStyle: (style: string) => void;
  toggleBlockType: (blockType: string) => void;
  applyTextColor: (color: string) => void;
  applyBackgroundColor: (color: string) => void;
  applyHeading: (headingStyle: string) => void;
  clearFormatting: () => void;
  handleLinkClick: () => void;
  handleImageClick: () => void;
  setIsMenuOpen: (isOpen: boolean) => void;
  insertTag: (tagName: string) => void;
  // @ mention state for external rendering
  mentionActive: boolean;
  mentionFilteredTags: string[];
  mentionSelectedIndex: number;
  handleMentionSelect: (tag: string) => void;
  noteLinkActive: boolean;
  noteLinkFilteredNotes: Array<{
    id: string;
    title: string;
    color?: string;
    calendar_name?: string;
  }>;
  noteLinkSelectedIndex: number;
  handleNoteLinkSelect: (
    noteId: string,
    noteTitle: string
  ) => void;
  eventLinkActive: boolean;
  eventLinkFilteredEvents: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
  eventLinkSelectedIndex: number;
  handleEventLinkSelect: (
    eventId: string,
    eventName: string,
    currency: Currency,
    impact: ImpactLevel
  ) => void;
}






const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
  value,
  onChange,
  placeholder = 'Enter text here...',
  label,
  helperText,
  minHeight = 150,
  maxHeight = 'none',
  disabled = false,
  hideCharacterCount = false,
  maxLength,
  toolbarVariant = 'floating',
  stickyPosition = 'top',
  calendarId,
  trades,
  onOpenGalleryMode,
  availableTradeTags = [],
  onMentionStateChange,
  availableNotes,
  onNoteLinkStateChange,
  onNoteLinkSearch,
  onNoteLinkClick,
  availableEvents,
  onEventLinkStateChange,
  onEventLinkClick,
  onSharedTradeClick,
}, ref) => {
  const theme = useTheme();
  const Z_INDEX = 2000;

  // Refs must be declared before any useEffect that uses them
  const editorRef = useRef<Editor>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef<string | undefined>(value);
  const savedScrollPositionRef = useRef<number>(0);

  // Create decorator with props
  const decorator = useMemo(
    () => createDecorator(
      calendarId, trades, onOpenGalleryMode,
      onNoteLinkClick, onEventLinkClick, onSharedTradeClick
    ),
    [calendarId, trades, onOpenGalleryMode,
      onNoteLinkClick, onEventLinkClick, onSharedTradeClick]
  );

  const [editorState, setEditorState] = useState(() => {
    const initialState = createEditorStateFromValue(value);
    return EditorState.set(initialState, { decorator });
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // @ mention tag dropdown state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionTriggerOffset, setMentionTriggerOffset] = useState(0);
  const [mentionBlockKey, setMentionBlockKey] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionAnchorRef = useRef<HTMLSpanElement | null>(null);

  // /note link dropdown state
  const [noteLinkActive, setNoteLinkActive] = useState(false);
  const [noteLinkSearch, setNoteLinkSearch] = useState('');
  const [noteLinkTriggerOffset, setNoteLinkTriggerOffset]
    = useState(0);
  const [noteLinkBlockKey, setNoteLinkBlockKey] = useState('');
  const [noteLinkSelectedIndex, setNoteLinkSelectedIndex]
    = useState(0);

  // /event link dropdown state
  const [eventLinkActive, setEventLinkActive] = useState(false);
  const [eventLinkSearch, setEventLinkSearch] = useState('');
  const [eventLinkTriggerOffset, setEventLinkTriggerOffset]
    = useState(0);
  const [eventLinkBlockKey, setEventLinkBlockKey] = useState('');
  const [eventLinkSelectedIndex, setEventLinkSelectedIndex]
    = useState(0);

  // Update editor state when value prop changes (for controlled component behavior)
  useEffect(() => {
    if (value !== previousValueRef.current) {
      previousValueRef.current = value;

      if (value !== undefined) {
        const newEditorState = createEditorStateFromValue(value);
        const newEditorStateWithDecorator = EditorState.set(newEditorState, { decorator });
        // Only update if the content is actually different to avoid infinite loops
        const currentContent = convertToRaw(editorState.getCurrentContent());
        const newContent = convertToRaw(newEditorStateWithDecorator.getCurrentContent());

        if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
          setEditorState(newEditorStateWithDecorator);
        }
      }
    }
  }, [value, editorState, decorator]);

  // Effect to restore scroll position when link dialog closes
  useEffect(() => {
    if (!linkDialogOpen && savedScrollPositionRef.current > 0) {
      const editorElement = editorWrapperRef.current;
      if (editorElement) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          editorElement.scrollTop = savedScrollPositionRef.current;
          // Reset the saved position
          savedScrollPositionRef.current = 0;
          // Restore focus to editor
          // setTimeout(() => {
          //   if (editorRef.current) {
          //     editorRef.current.focus();
          //   }
          // }, 50);
        });
      }
    }
  }, [linkDialogOpen]);

  // Use custom hooks for better organization
  const {
    showFloatingToolbar,
    floatingToolbarPosition
  } = useFloatingToolbar({
    disabled,
    editorWrapperRef,
    toolbarRef,
    isMenuOpen,
    linkDialogOpen,
  });

  // Focus the editor when clicked
  const focusEditor = () => {
    if (editorRef.current && !disabled) {
      editorRef.current.focus();
    }
  };



  // Filtered tags for @ mention dropdown
  const mentionFilteredTags = useMemo(() => {
    if (!mentionActive || availableTradeTags.length === 0) return [];
    const q = mentionSearch.toLowerCase();
    return availableTradeTags.filter((t) => t.toLowerCase().includes(q));
  }, [mentionActive, mentionSearch, availableTradeTags]);

  // Handle @ mention tag selection
  const handleMentionSelect = useCallback((tag: string) => {
    const newState = replaceAtMentionWithTag(
      editorState, tag, mentionTriggerOffset, mentionBlockKey
    );
    setMentionActive(false);
    setMentionSearch('');
    setMentionSelectedIndex(0);
    setEditorState(newState);
    onMentionStateChange?.(false);

    // Fire onChange
    if (onChange) {
      const newRaw = convertToRaw(newState.getCurrentContent());
      onChange(JSON.stringify(newRaw));
    }

    setTimeout(() => editorRef.current?.focus(), 50);
  }, [editorState, mentionTriggerOffset, mentionBlockKey, onChange]);

  // Handle /note link selection
  const handleNoteLinkSelect = useCallback(
    (noteId: string, noteTitle: string) => {
      const newState = replaceNoteTriggerWithLink(
        editorState,
        noteId,
        noteTitle,
        noteLinkTriggerOffset,
        noteLinkBlockKey
      );
      setNoteLinkActive(false);
      setNoteLinkSearch('');
      setNoteLinkSelectedIndex(0);
      setEditorState(newState);
      onNoteLinkStateChange?.(false);

      if (onChange) {
        const newRaw = convertToRaw(
          newState.getCurrentContent()
        );
        onChange(JSON.stringify(newRaw));
      }

      setTimeout(() => editorRef.current?.focus(), 50);
    },
    [
      editorState,
      noteLinkTriggerOffset,
      noteLinkBlockKey,
      onChange,
      onNoteLinkStateChange,
    ]
  );

  // Handle /event link selection
  const handleEventLinkSelect = useCallback(
    (
      eventId: string,
      eventName: string,
      currency: Currency,
      impact: ImpactLevel
    ) => {
      const newState = replaceEventTriggerWithLink(
        editorState,
        eventId,
        eventName,
        currency,
        impact,
        eventLinkTriggerOffset,
        eventLinkBlockKey
      );
      setEventLinkActive(false);
      setEventLinkSearch('');
      setEventLinkSelectedIndex(0);
      setEditorState(newState);
      onEventLinkStateChange?.(false);

      if (onChange) {
        const newRaw = convertToRaw(
          newState.getCurrentContent()
        );
        onChange(JSON.stringify(newRaw));
      }

      setTimeout(() => editorRef.current?.focus(), 50);
    },
    [
      editorState,
      eventLinkTriggerOffset,
      eventLinkBlockKey,
      onChange,
      onEventLinkStateChange,
    ]
  );

  // Handle editor state changes
  const handleEditorChange = (state: EditorState) => {
    const prevContentState = editorState.getCurrentContent();
    const newContentState = state.getCurrentContent();

    // Check character limit if maxLength is specified
    if (maxLength && newContentState.getPlainText().length > maxLength) {
      return;
    }

    setEditorState(state);

    // Check for /tag trigger (mutually exclusive with /note, /event)
    if (availableTradeTags.length > 0 && !noteLinkActive
        && !eventLinkActive) {
      const trigger = getAtMentionTrigger(state);
      if (trigger) {
        setMentionActive(true);
        setMentionSearch(trigger.searchText);
        setMentionTriggerOffset(trigger.triggerOffset);
        setMentionBlockKey(trigger.blockKey);
        setMentionSelectedIndex(0);
        onMentionStateChange?.(true);
      } else {
        if (mentionActive) {
          setMentionActive(false);
          setMentionSearch('');
          onMentionStateChange?.(false);
        }
      }
    }

    // Check for /note trigger (mutually exclusive with /tag, /event)
    if (!mentionActive && !eventLinkActive && availableNotes) {
      const noteTrigger = getNoteTrigger(state);
      if (noteTrigger) {
        setNoteLinkActive(true);
        setNoteLinkSearch(noteTrigger.searchText);
        setNoteLinkTriggerOffset(noteTrigger.triggerOffset);
        setNoteLinkBlockKey(noteTrigger.blockKey);
        setNoteLinkSelectedIndex(0);
        onNoteLinkStateChange?.(true);
        onNoteLinkSearch?.(noteTrigger.searchText);
      } else if (noteLinkActive) {
        setNoteLinkActive(false);
        setNoteLinkSearch('');
        onNoteLinkStateChange?.(false);
      }
    }

    // Check for /event trigger (mutually exclusive with /tag, /note)
    if (!mentionActive && !noteLinkActive && availableEvents) {
      const eventTrigger = getEventTrigger(state);
      if (eventTrigger) {
        setEventLinkActive(true);
        setEventLinkSearch(eventTrigger.searchText);
        setEventLinkTriggerOffset(eventTrigger.triggerOffset);
        setEventLinkBlockKey(eventTrigger.blockKey);
        setEventLinkSelectedIndex(0);
        onEventLinkStateChange?.(true);
      } else if (eventLinkActive) {
        setEventLinkActive(false);
        setEventLinkSearch('');
        onEventLinkStateChange?.(false);
      }
    }

    if (onChange) {
      const prevRaw = convertToRaw(prevContentState);
      const newRaw = convertToRaw(newContentState);

      if (JSON.stringify(prevRaw) !== JSON.stringify(newRaw)) {
        onChange(JSON.stringify(newRaw));
      }
    }
  };

  // Create action handlers using utilities
  const handleToggleInlineStyle = (style: string) => {
    const newState = toggleInlineStyle(editorState, style, editorRef);
    handleEditorChange(newState);
  };

  const handleToggleBlockType = (blockType: string) => {
    const newState = toggleBlockType(editorState, blockType, editorRef);
    handleEditorChange(newState);
  };

  // Apply text color using utility
  const handleApplyTextColor = (color: string) => {
    const { newState, scrollTop } = applyTextColor(
      editorState,
      color,
      editorRef,
      () => {}, // Recent colors are managed in EditorToolbar
      TEXT_COLORS
    );

    handleEditorChange(newState);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Apply background color using utility
  const handleApplyBackgroundColor = (color: string) => {
    const { newState, scrollTop } = applyBackgroundColor(
      editorState,
      color,
      editorRef,
      () => {}, // Recent colors are managed in EditorToolbar
      BACKGROUND_COLORS
    );

    handleEditorChange(newState);
    restoreScrollAndFocus(editorRef, scrollTop, 0);
  };

  // Apply heading using utility
  const handleApplyHeading = (headingStyle: string) => {
    const { newState } = applyHeading(editorState, headingStyle, editorRef);
    handleEditorChange(newState);
  };

  // Clear formatting using utility
  const handleClearFormatting = () => {
    const newState = clearFormatting(editorState, editorRef);
    if (newState) {
      handleEditorChange(newState);
    }
  };

  // Link handlers using utilities
  const handleLinkClick = () => {
    handleLinkDialogOpen(
      editorState,
      editorWrapperRef,
      savedScrollPositionRef,
      setLinkText,
      setLinkUrl,
      setLinkDialogOpen
    );
  };

  const insertLink = () => {
    if (!linkUrl.trim()) return;

    const newState = createLinkEntity(editorState, linkUrl, linkText);
    handleEditorChange(newState);

    handleLinkDialogClose(setLinkDialogOpen, setLinkText, setLinkUrl);

    // Restore focus
    // setTimeout(() => {
    //   if (editorRef.current) {
    //     editorRef.current.focus();
    //   }
    // }, 100);
  };

  const removeLink = () => {
    const newState = removeLinkEntity(editorState);
    handleEditorChange(newState);

    // Restore focus
    // setTimeout(() => {
    //   if (editorRef.current) {
    //     editorRef.current.focus();
    //   }
    // }, 0);
  };

  // Tag entity handler
  const handleInsertTag = (tagName: string) => {
    const newState = insertTagEntity(editorState, tagName);
    handleEditorChange(newState);
    setTimeout(() => editorRef.current?.focus(), 100);
  };

  // Mention keyboard handlers
  const eventLinkFilteredEvents = useMemo(
    () => availableEvents?.filter((ev) =>
      ev.event.toLowerCase().includes(
        eventLinkSearch.toLowerCase()
      )
    ) || [],
    [availableEvents, eventLinkSearch]
  );

  const handleReturn = useCallback(
    (e: React.KeyboardEvent): 'handled' | 'not-handled' => {
      if (eventLinkActive && eventLinkFilteredEvents.length > 0) {
        e.preventDefault();
        const selected =
          eventLinkFilteredEvents[eventLinkSelectedIndex];
        if (selected) {
          handleEventLinkSelect(
            selected.event_id,
            selected.event,
            (selected.currency || 'USD') as Currency,
            (selected.impact || 'Medium') as ImpactLevel
          );
        }
        return 'handled';
      }
      if (noteLinkActive) {
        const filtered = availableNotes?.filter((n) =>
          n.title.toLowerCase().includes(
            noteLinkSearch.toLowerCase()
          )
        ) || [];
        if (filtered.length > 0) {
          e.preventDefault();
          const selected = filtered[noteLinkSelectedIndex];
          if (selected) {
            handleNoteLinkSelect(
              selected.id, selected.title
            );
          }
          return 'handled';
        }
      }
      if (mentionActive && mentionFilteredTags.length > 0) {
        e.preventDefault();
        handleMentionSelect(
          mentionFilteredTags[mentionSelectedIndex]
        );
        return 'handled';
      }
      return 'not-handled';
    },
    [
      mentionActive, mentionFilteredTags,
      mentionSelectedIndex, handleMentionSelect,
      noteLinkActive, availableNotes, noteLinkSearch,
      noteLinkSelectedIndex, handleNoteLinkSelect,
      eventLinkActive, eventLinkFilteredEvents,
      eventLinkSelectedIndex, handleEventLinkSelect,
    ]
  );

  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!mentionActive || mentionFilteredTags.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => {
          const next = (prev + 1) % mentionFilteredTags.length;
          // Defer callback so parent reads the updated index
          requestAnimationFrame(() => onMentionStateChange?.(true));
          return next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => {
          const next = (prev - 1 + mentionFilteredTags.length) %
            mentionFilteredTags.length;
          requestAnimationFrame(() => onMentionStateChange?.(true));
          return next;
        });
      } else if (e.key === 'Escape') {
        setMentionActive(false);
        setMentionSearch('');
        onMentionStateChange?.(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(mentionFilteredTags[mentionSelectedIndex]);
      }
    },
    [mentionActive, mentionFilteredTags, mentionSelectedIndex,
     handleMentionSelect, onMentionStateChange]
  );

  const handleNoteLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const filtered = availableNotes?.filter((n) =>
        n.title
          .toLowerCase()
          .includes(noteLinkSearch.toLowerCase())
      ) || [];
      if (!noteLinkActive || filtered.length === 0) return;

      if (
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        setNoteLinkSelectedIndex((prev) => {
          const next = (prev + 1) % filtered.length;
          requestAnimationFrame(
            () => onNoteLinkStateChange?.(true)
          );
          return next;
        });
      } else if (
        e.key === 'ArrowLeft' || e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        setNoteLinkSelectedIndex((prev) => {
          const next =
            (prev - 1 + filtered.length) % filtered.length;
          requestAnimationFrame(
            () => onNoteLinkStateChange?.(true)
          );
          return next;
        });
      } else if (e.key === 'Escape') {
        setNoteLinkActive(false);
        setNoteLinkSearch('');
        onNoteLinkStateChange?.(false);
      } else if (
        e.key === 'Tab' || e.key === 'Enter'
      ) {
        e.preventDefault();
        const selected = filtered[noteLinkSelectedIndex];
        if (selected) {
          handleNoteLinkSelect(
            selected.id, selected.title
          );
        }
      }
    },
    [
      noteLinkActive,
      availableNotes,
      noteLinkSearch,
      noteLinkSelectedIndex,
      handleNoteLinkSelect,
      onNoteLinkStateChange,
    ]
  );

  const handleEventLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!eventLinkActive || eventLinkFilteredEvents.length === 0)
        return;

      if (
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        setEventLinkSelectedIndex((prev) => {
          const next =
            (prev + 1) % eventLinkFilteredEvents.length;
          requestAnimationFrame(
            () => onEventLinkStateChange?.(true)
          );
          return next;
        });
      } else if (
        e.key === 'ArrowLeft' || e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        setEventLinkSelectedIndex((prev) => {
          const next =
            (prev - 1 + eventLinkFilteredEvents.length) %
            eventLinkFilteredEvents.length;
          requestAnimationFrame(
            () => onEventLinkStateChange?.(true)
          );
          return next;
        });
      } else if (e.key === 'Escape') {
        setEventLinkActive(false);
        setEventLinkSearch('');
        onEventLinkStateChange?.(false);
      } else if (
        e.key === 'Tab' || e.key === 'Enter'
      ) {
        e.preventDefault();
        const selected =
          eventLinkFilteredEvents[eventLinkSelectedIndex];
        if (selected) {
          handleEventLinkSelect(
            selected.event_id,
            selected.event,
            (selected.currency || 'USD') as Currency,
            (selected.impact || 'Medium') as ImpactLevel
          );
        }
      }
    },
    [
      eventLinkActive,
      eventLinkFilteredEvents,
      eventLinkSelectedIndex,
      handleEventLinkSelect,
      onEventLinkStateChange,
    ]
  );

  // Image handlers
  const handleImageClick = () => {
    setImageDialogOpen(true);
  };

  // Expose methods to parent via ref for external toolbar control
  useImperativeHandle(ref, () => ({
    editorState,
    toolbarRef,
    toggleInlineStyle: handleToggleInlineStyle,
    toggleBlockType: handleToggleBlockType,
    applyTextColor: handleApplyTextColor,
    applyBackgroundColor: handleApplyBackgroundColor,
    applyHeading: handleApplyHeading,
    clearFormatting: handleClearFormatting,
    handleLinkClick,
    handleImageClick,
    setIsMenuOpen,
    insertTag: handleInsertTag,
    mentionActive,
    mentionFilteredTags,
    mentionSelectedIndex,
    handleMentionSelect,
    noteLinkActive,
    noteLinkFilteredNotes: availableNotes?.filter((n) =>
      n.title.toLowerCase().includes(
        noteLinkSearch.toLowerCase()
      )
    ) || [],
    noteLinkSelectedIndex,
    handleNoteLinkSelect,
    eventLinkActive,
    eventLinkFilteredEvents,
    eventLinkSelectedIndex,
    handleEventLinkSelect,
  }), [editorState, handleToggleInlineStyle,
      handleToggleBlockType, handleApplyTextColor,
      handleApplyBackgroundColor, handleApplyHeading,
      handleClearFormatting, handleLinkClick,
      handleImageClick, handleInsertTag,
      mentionActive, mentionFilteredTags,
      mentionSelectedIndex, handleMentionSelect,
      noteLinkActive, availableNotes, noteLinkSearch,
      noteLinkSelectedIndex, handleNoteLinkSelect,
      eventLinkActive, eventLinkFilteredEvents,
      eventLinkSelectedIndex, handleEventLinkSelect]);

  const handleImageInsert = (src: string, alt?: string) => {
    const newState = insertImage(editorState, src, alt);
    handleEditorChange(newState);
    setImageDialogOpen(false);
    setTimeout(() => editorRef.current?.focus(), 100);
  };

  const handleImageRemove = (blockKey: string) => {
    const newState = removeImageBlock(editorState, blockKey);
    handleEditorChange(newState);
  };

  // Block renderer for atomic blocks (images)
  const blockRendererFn = (contentBlock: any) => {
    if (contentBlock.getType() === 'atomic') {
      const contentState = editorState.getCurrentContent();
      const entityKey = contentBlock.getEntityAt(0);
      if (entityKey) {
        const entity = contentState.getEntity(entityKey);
        if (entity.getType() === 'IMAGE') {
          return {
            component: ImageBlock,
            editable: false,
            props: {
              onRemove: handleImageRemove,
              readOnly: disabled,
            },
          };
        }
      }
    }
    return null;
  };

  // Create style map using utility
  const styleMap = createStyleMap(theme, TEXT_COLORS, BACKGROUND_COLORS);

  // Create keyboard command handler using utility
  const handleKeyCommandWrapper = (command: string, state: EditorState): 'handled' | 'not-handled' => {
    if (command === 'note-link-nav' || command === 'mention-nav') {
      return 'handled';
    }
    return handleKeyCommand(command, state, {
      clearFormatting: handleClearFormatting,
      handleLinkClick,
      removeLink,
      getCurrentLink: () => getCurrentLink(editorState),
      handleEditorChange
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {label && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
          {label}
        </Typography>
      )}

      {/* Main Editor Wrapper */}
      <Box
        sx={{
          position: 'relative', // Crucial for absolute positioning of toolbar
          overflow: 'hidden', // Clip potential overflows (like toolbar if not positioned carefully)
          transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        }}
      >
        {/* Sticky Toolbar at top when variant is 'sticky' and stickyPosition is 'top' */}
        {toolbarVariant === 'sticky' && stickyPosition === 'top' && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="sticky"
            stickyPosition="top"
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

        {/* Editor Scrollable Area */}
        <Box
          ref={editorWrapperRef}
          onClick={focusEditor}
          sx={{
            padding: theme.spacing(1.2, 1.8),
            minHeight,
            maxHeight,
            overflow: 'auto',
            cursor: 'text',
            position: 'relative',
            ...scrollbarStyles(theme),
            '& .public-DraftEditorPlaceholder-root': {
                color: theme.palette.text.disabled,
                position: 'absolute',
                top: theme.spacing(1.2),
                left: theme.spacing(1.8),
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.8,
                fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
                fontWeight: 500,
                fontSize: '0.9rem', // Reduced placeholder font size
            },
            '& .public-DraftEditor-content': {
              minHeight: typeof minHeight === 'number' ? `calc(${minHeight}px - ${theme.spacing(3)})` : `calc(${minHeight} - ${theme.spacing(3)})`,
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontSize: '0.9rem', // Reduced text size
              lineHeight: 2.1,
              fontWeight: 500,
              color: theme.palette.text.primary,
              position: 'relative',
              zIndex: 1,
              '& *::selection': {
                 backgroundColor: alpha(theme.palette.primary.main, 0.3),
              },
            },
            // Custom Block Styles
            '& .RichEditor-h1': {
              fontSize: '1.1rem', fontWeight: 'bold', margin: '0.8rem 0 0.4rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h2': {
              fontSize: '1rem', fontWeight: 'bold', margin: '0.6rem 0 0.3rem',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-h3': {
              fontSize: '0.95rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem', fontStyle: 'italic',
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
            },
            '& .RichEditor-ul, & .RichEditor-ol': {
              marginLeft: '1.5rem', // Reduced indentation for lists
              marginBlockStart: '0.4em',
              marginBlockEnd: '0.4em',
              paddingInlineStart: '0', // Reset browser default padding
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontWeight: 500, // Medium weight for thicker text
            },
            '& .RichEditor-ul li, & .RichEditor-ol li': {
              margin: '0.2rem 0',
              paddingLeft: '0.4rem', // Reduced space between bullet/number and text
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif",
              fontWeight: 500, // Medium weight for thicker text
            },
             '& .RichEditor-ul li::marker': { // Style bullets if needed
                 // content: '"• "';
                 // color: theme.palette.text.secondary;
             },
             '& .RichEditor-ol': { // Ensure ol counters work
                 // listStyleType: 'decimal';
             },
             // Link styles - enhanced visual feedback
             '& .rich-editor-link': {
               color: `${theme.palette.primary.main} !important`,
               textDecoration: 'underline !important',
               cursor: 'pointer !important',
               backgroundColor: `${alpha(theme.palette.primary.main, 0.08)} !important`,
               padding: '0px 4px !important',
               borderRadius: '4px !important',
               border: `1px solid ${alpha(theme.palette.primary.main, 0.2)} !important`,
               display: 'inline-block !important',
               transition: 'all 0.2s ease-in-out !important',
               margin: '0 1px !important',
               fontWeight: '500 !important',
               '&:hover': {
                 color: `${theme.palette.primary.dark} !important`,
                 backgroundColor: `${alpha(theme.palette.primary.main, 0.15)} !important`,
                 borderColor: `${alpha(theme.palette.primary.main, 0.4)} !important`,
               },
               '&:active': {
                 transform: 'translateY(0px) !important',
                 backgroundColor: `${alpha(theme.palette.primary.main, 0.2)} !important`,
                 boxShadow: `0 1px 4px ${alpha(theme.palette.primary.main, 0.3)} !important`,
               }
             }
          }}
        >
          <Editor
            ref={editorRef}
            editorState={editorState}
            onChange={handleEditorChange}
            placeholder={placeholder}
            customStyleMap={styleMap}
            blockStyleFn={blockStyleFn}
            blockRendererFn={blockRendererFn}
            handleKeyCommand={handleKeyCommandWrapper}
            handleReturn={handleReturn}
            keyBindingFn={(e: any) => {
              if (mentionActive
                && mentionFilteredTags.length > 0) {
                if (['ArrowDown', 'ArrowUp', 'ArrowLeft',
                  'ArrowRight', 'Escape', 'Tab',
                ].includes(e.key)) {
                  handleMentionKeyDown(e);
                  return 'mention-nav';
                }
              }
              if (noteLinkActive) {
                if (['ArrowDown', 'ArrowUp', 'ArrowLeft',
                  'ArrowRight', 'Escape', 'Tab', 'Enter',
                ].includes(e.key)) {
                  handleNoteLinkKeyDown(e);
                  return 'note-link-nav';
                }
              }
              if (eventLinkActive) {
                if (['ArrowDown', 'ArrowUp', 'ArrowLeft',
                  'ArrowRight', 'Escape', 'Tab', 'Enter',
                ].includes(e.key)) {
                  handleEventLinkKeyDown(e);
                  return 'event-link-nav';
                }
              }
              return keyBindingFn(e);
            }}
            readOnly={disabled}
            spellCheck={true}
          />
        </Box>

        {/* Render the floating toolbar absolutely positioned relative to the main wrapper */}
        {toolbarVariant === 'floating' && showFloatingToolbar && floatingToolbarPosition && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="floating"
            position={floatingToolbarPosition}
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

        {/* Sticky Toolbar at bottom when variant is 'sticky' and stickyPosition is 'bottom' */}
        {toolbarVariant === 'sticky' && stickyPosition === 'bottom' && (
          <EditorToolbar
            editorState={editorState}
            disabled={disabled}
            variant="sticky"
            stickyPosition="bottom"
            toolbarRef={toolbarRef}
            onToggleInlineStyle={handleToggleInlineStyle}
            onToggleBlockType={handleToggleBlockType}
            onApplyTextColor={handleApplyTextColor}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyHeading={handleApplyHeading}
            onClearFormatting={handleClearFormatting}
            onLinkClick={handleLinkClick}
            onImageClick={handleImageClick}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

      </Box>

      {/* Link Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={false}
        disableRestoreFocus={true}
        sx={{ zIndex: Z_INDEX }}
      >
        <DialogTitle>{getCurrentLink(editorState) ? 'Edit Link' : 'Insert Link'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Link Text"
            fullWidth
            variant="outlined"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            sx={{ mb: 2 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkUrl.trim()) {
                e.preventDefault();
                insertLink();
              }
            }}
          />
          <TextField
            margin="dense"
            label="URL"
            fullWidth
            variant="outlined"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkUrl.trim()) {
                e.preventDefault();
                insertLink();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>
            Cancel
          </Button>
          {getCurrentLink(editorState) && (
            <Button
              onClick={() => {
                removeLink();
                setLinkDialogOpen(false);
                setLinkText('');
                setLinkUrl('');
              }}
              color="error"
              variant="outlined"
            >
              Remove Link
            </Button>
          )}
          <Button
            onClick={insertLink}
            variant="contained"
            disabled={!linkUrl.trim()}
          >
            {getCurrentLink(editorState) ? 'Update Link' : 'Insert Link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Upload Dialog */}
      <ImageUploadDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onImageInsert={handleImageInsert}
      />

      {/* Helper text and character count */}
      {(helperText || !hideCharacterCount) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
          {helperText && (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          )}
          {!hideCharacterCount && (() => {
            const currentLength = editorState.getCurrentContent().getPlainText().length;
            const isNearLimit = maxLength && currentLength > maxLength * 0.8;
            const isAtLimit = maxLength && currentLength >= maxLength;

            return (
              <Typography
                variant="caption"
                sx={{
                  ml: 'auto',
                  color: isAtLimit ? 'error.main' : isNearLimit ? 'warning.main' : 'text.secondary'
                }}
              >
                {currentLength}{maxLength ? ` / ${maxLength}` : ''} characters
              </Typography>
            );
          })()}
        </Box>
      )}
    </Box>
  );
});

// Add display name for debugging
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;