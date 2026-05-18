import React, {
  useState, useRef, useEffect, useMemo,
  forwardRef, useImperativeHandle, useCallback
} from 'react';
import {
  Box,
  Typography,
  useTheme,
  Dialog,
  Button,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  LinkOff as LinkOffIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { useDialogTokens } from '../../styles/dialogTokens';
import { Editor, EditorState, Modifier, convertToRaw } from 'draft-js';
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
import {
  insertTradeLinkEntity,
  type TradeChipData,
} from './RichTextEditor/utils/tradeEntityUtils';
import type {
  ImpactLevel,
  Currency,
} from 'features/events/types/economicCalendar';
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
import {
  handleCalloutReturn,
  toggleCalloutBlock,
  type CalloutVariant,
} from './RichTextEditor/utils/calloutUtils';
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
  // Trade-link insert. When supplied, the toolbar shows the trade button;
  // clicking it invokes this callback, which is expected to gather the
  // share URL (e.g. via a dialog) and then call insertTradeLink(data) on
  // the editor's imperative handle.
  onInsertTradeLink?: () => void;
  // Callback for shared trade link clicks (inline preview). Used for both
  // raw LINK entities pointing at /shared/... AND TRADE_LINK chip entities.
  onSharedTradeClick?: (shareId: string, tradeId: string) => void;
  // Fires whenever internal editorState changes. Parents that render a
  // sticky toolbar outside this component MUST mirror this state — reading
  // it from the imperative ref is stale (the ref is captured at render
  // time and won't reflect typing-driven content updates).
  onEditorStateChange?: (state: EditorState) => void;
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
  toggleCallout: (variant: CalloutVariant) => void;
  /**
   * Programmatically insert a TRADE_LINK chip at the current cursor.
   * Host calls this after resolving share-link → trade data.
   */
  insertTradeLink: (data: TradeChipData) => void;
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
  onInsertTradeLink,
  onSharedTradeClick,
  onEditorStateChange,
}, ref) => {
  const theme = useTheme();
  const linkDialogTokens = useDialogTokens();
  const Z_INDEX = 2000;

  // Refs must be declared before any useEffect that uses them
  const editorRef = useRef<Editor>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef<string | undefined>(value);
  const savedScrollPositionRef = useRef<number>(0);
  // Tracks the JSON we most recently emitted via onChange. The parent
  // typically echoes this back into `value`, and we must NOT re-init the
  // editor from our own echo — doing so would JSON-roundtrip on every
  // keystroke and wipe undo history + selection.
  const lastEmittedValueRef = useRef<string | undefined>(value);

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

  // Update editor state when `value` prop changes from an EXTERNAL source.
  // We skip:
  //   - Our own echo (parent re-passing what we emitted via onChange)
  //   - No-op repeats (same value as last seen)
  // Previously this effect ran convertToRaw + JSON.stringify on every
  // keystroke (editorState was in deps); now it only fires when `value`
  // identity changes and the value differs from what we emitted.
  //
  // NOTE: decorator-identity changes do NOT propagate to the live
  // editorState (matches original behavior). Eagerly syncing the
  // decorator would cause an extra setEditorState per keystroke whenever
  // a parent passes a non-memoized handler — see audit notes for B1.
  useEffect(() => {
    if (value === previousValueRef.current) return;
    previousValueRef.current = value;
    if (value === undefined) return;
    if (value === lastEmittedValueRef.current) return;

    const newEditorState = createEditorStateFromValue(value);
    setEditorState(EditorState.set(newEditorState, { decorator }));
  // decorator is read inside the effect to ensure new editor states pick
  // it up; we intentionally do NOT depend on it (see note above).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  // Emit the editor state through both the value channel (onChange JSON)
  // and the live state channel (onEditorStateChange). Used by entity
  // inserts that bypass Draft's user-input onChange path.
  const emitState = useCallback((newState: EditorState) => {
    onEditorStateChange?.(newState);
    if (onChange) {
      const json = JSON.stringify(convertToRaw(newState.getCurrentContent()));
      lastEmittedValueRef.current = json;
      onChange(json);
    }
  }, [onChange, onEditorStateChange]);

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
    emitState(newState);

    setTimeout(() => editorRef.current?.focus(), 50);
  }, [editorState, mentionTriggerOffset, mentionBlockKey, emitState, onMentionStateChange]);

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
      emitState(newState);

      setTimeout(() => editorRef.current?.focus(), 50);
    },
    [
      editorState,
      noteLinkTriggerOffset,
      noteLinkBlockKey,
      emitState,
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
      emitState(newState);

      setTimeout(() => editorRef.current?.focus(), 50);
    },
    [
      editorState,
      eventLinkTriggerOffset,
      eventLinkBlockKey,
      emitState,
      onEventLinkStateChange,
    ]
  );

  // Programmatic chip insert. Caller (host dialog) supplies resolved data
  // — the editor never fetches; it just renders.
  const handleInsertTradeLink = useCallback(
    (data: TradeChipData) => {
      const newState = insertTradeLinkEntity(editorState, data);
      setEditorState(newState);
      emitState(newState);
      setTimeout(() => editorRef.current?.focus(), 50);
    },
    [editorState, emitState]
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

    // Notify external listeners (e.g. parent rendering a sticky toolbar)
    // BEFORE serializing — they only care about EditorState identity.
    onEditorStateChange?.(state);

    if (onChange) {
      // Skip the double-serialize equality check from the old impl.
      // Draft preserves ContentState reference equality across selection-
      // only changes, so a single reference compare gates the expensive
      // convertToRaw + JSON.stringify path.
      if (prevContentState !== newContentState) {
        const json = JSON.stringify(convertToRaw(newContentState));
        lastEmittedValueRef.current = json;
        onChange(json);
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

  // Toggle a callout block. Uses calloutUtils' swap-aware helper so that
  // tapping the same variant twice clears it and tapping a different
  // variant on an existing callout swaps in place.
  const handleToggleCallout = (variant: CalloutVariant) => {
    const newState = toggleCalloutBlock(editorState, variant);
    handleEditorChange(newState);
    setTimeout(() => editorRef.current?.focus(), 0);
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
      // Empty-line Enter inside a callout exits the callout. The pickers
      // are checked first if active so their selection-on-Enter wins;
      // when no picker is open we fall through to the callout check.
      if (!mentionActive && !noteLinkActive && !eventLinkActive) {
        const exitState = handleCalloutReturn(editorState);
        if (exitState) {
          e.preventDefault();
          handleEditorChange(exitState);
          return 'handled';
        }
      }
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
      editorState,
      mentionActive, mentionFilteredTags,
      mentionSelectedIndex, handleMentionSelect,
      noteLinkActive, availableNotes, noteLinkSearch,
      noteLinkSelectedIndex, handleNoteLinkSelect,
      eventLinkActive, eventLinkFilteredEvents,
      eventLinkSelectedIndex, handleEventLinkSelect,
      // handleEditorChange is intentionally omitted — it is a stable inline
      // function in this component, recreated on every render anyway.
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
    toggleCallout: handleToggleCallout,
    insertTradeLink: handleInsertTradeLink,
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
      handleToggleCallout,
      handleInsertTradeLink,
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

  // ─── maxLength enforcement at input source ─────────────────────────────
  // The onChange cap (handleEditorChange) is a backstop; Draft.js's
  // controlled-component model can still let the DOM briefly show overflow
  // when the user types or pastes fast. handleBeforeInput / handlePastedText
  // intercept BEFORE Draft.js applies the change, so we never overshoot the
  // limit and pastes get truncated to fit.
  const handleBeforeInput = (
    chars: string,
    state: EditorState,
  ): 'handled' | 'not-handled' => {
    if (!maxLength) return 'not-handled';
    const currentLength = state.getCurrentContent().getPlainText().length;
    // Account for any text the user has selected — selected chars will be
    // replaced, so they shouldn't count against the limit.
    const selection = state.getSelection();
    const selectedLength = selection.isCollapsed()
      ? 0
      : Math.abs(selection.getEndOffset() - selection.getStartOffset());
    if (currentLength - selectedLength + chars.length > maxLength) {
      return 'handled';
    }
    return 'not-handled';
  };

  const handlePastedText = (
    text: string,
    _html: string | undefined,
    state: EditorState,
  ): 'handled' | 'not-handled' => {
    if (!maxLength) return 'not-handled';
    const content = state.getCurrentContent();
    const selection = state.getSelection();
    const selectedLength = selection.isCollapsed()
      ? 0
      : Math.abs(selection.getEndOffset() - selection.getStartOffset());
    const room = maxLength - (content.getPlainText().length - selectedLength);
    if (room <= 0) return 'handled'; // No room — drop the paste entirely.
    if (text.length <= room) return 'not-handled'; // Default paste path.

    // Truncate the paste to what fits. replaceText handles the selection
    // (collapsed or ranged) the same way Draft.js's default paste would.
    const truncated = text.slice(0, room);
    const newContent = Modifier.replaceText(content, selection, truncated);
    handleEditorChange(
      EditorState.push(state, newContent, 'insert-characters'),
    );
    return 'handled';
  };

  // Create keyboard command handler using utility
  const handleKeyCommandWrapper = (command: string, state: EditorState): 'handled' | 'not-handled' => {
    if (
      command === 'note-link-nav' ||
      command === 'mention-nav' ||
      command === 'event-link-nav'
    ) {
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
        <Typography
          variant="body2"
          color="text.secondary"
          // px matches the editor wrapper's horizontal padding (theme.spacing(1.8))
          // so the label aligns with the placeholder/content baseline.
          sx={{ mb: 0.5, px: 3.5, fontWeight: 500 }}
        >
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
            onToggleCallout={handleToggleCallout}
            onInsertTradeLink={onInsertTradeLink}
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
                fontFamily: theme.typography.fontFamily,
                fontWeight: 500,
                fontSize: '0.9rem', // Reduced placeholder font size
            },
            '& .public-DraftEditor-content': {
              minHeight: typeof minHeight === 'number' ? `calc(${minHeight}px - ${theme.spacing(3)})` : `calc(${minHeight} - ${theme.spacing(3)})`,
              fontFamily: theme.typography.fontFamily,
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
              fontFamily: theme.typography.fontFamily,
            },
            '& .RichEditor-h2': {
              fontSize: '1rem', fontWeight: 'bold', margin: '0.6rem 0 0.3rem',
              fontFamily: theme.typography.fontFamily,
            },
            '& .RichEditor-h3': {
              fontSize: '0.95rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem', fontStyle: 'italic',
              fontFamily: theme.typography.fontFamily,
            },
            '& .RichEditor-ul, & .RichEditor-ol': {
              marginLeft: '1.5rem', // Reduced indentation for lists
              marginBlockStart: '0.4em',
              marginBlockEnd: '0.4em',
              paddingInlineStart: '0', // Reset browser default padding
              fontFamily: theme.typography.fontFamily,
              fontWeight: 500, // Medium weight for thicker text
            },
            '& .RichEditor-ul li, & .RichEditor-ol li': {
              margin: '0.2rem 0',
              paddingLeft: '0.4rem', // Reduced space between bullet/number and text
              fontFamily: theme.typography.fontFamily,
              fontWeight: 500, // Medium weight for thicker text
            },
             '& .RichEditor-ul li::marker': { // Style bullets if needed
                 // content: '"• "';
                 // color: theme.palette.text.secondary;
             },
             '& .RichEditor-ol': { // Ensure ol counters work
                 // listStyleType: 'decimal';
             },
             // Callout block styles — colored left rail + tinted background.
             // Adjacent callouts of the same variant fuse into a single visual
             // box by zeroing the inter-block padding, mirroring how a quote
             // banner reads in design specimens.
             '& .RichEditor-callout': {
               borderLeftStyle: 'solid',
               borderLeftWidth: '3px',
               padding: '8px 14px',
               margin: '4px 0',
               borderRadius: '4px',
               fontSize: '0.9rem',
               lineHeight: 1.6,
             },
             // Fuse adjacent callouts of the SAME variant only. Using the
             // base class here would zero the gap between e.g. a warning
             // followed by a danger callout, producing a half-yellow /
             // half-red block with no visual separation.
             '& .RichEditor-callout-warning + .RichEditor-callout-warning, & .RichEditor-callout-info + .RichEditor-callout-info, & .RichEditor-callout-success + .RichEditor-callout-success, & .RichEditor-callout-danger + .RichEditor-callout-danger': {
               marginTop: 0,
               paddingTop: 0,
               borderTopLeftRadius: 0,
               borderTopRightRadius: 0,
             },
             '& .RichEditor-callout-warning:has(+ .RichEditor-callout-warning), & .RichEditor-callout-info:has(+ .RichEditor-callout-info), & .RichEditor-callout-success:has(+ .RichEditor-callout-success), & .RichEditor-callout-danger:has(+ .RichEditor-callout-danger)': {
               paddingBottom: 0,
               marginBottom: 0,
               borderBottomLeftRadius: 0,
               borderBottomRightRadius: 0,
             },
             '& .RichEditor-callout-warning': {
               borderLeftColor: theme.palette.warning.main,
               backgroundColor: alpha(theme.palette.warning.main, 0.08),
               color: theme.palette.warning.main,
             },
             '& .RichEditor-callout-info': {
               borderLeftColor: theme.palette.primary.main,
               backgroundColor: alpha(theme.palette.primary.main, 0.08),
               color: theme.palette.primary.light,
             },
             '& .RichEditor-callout-success': {
               borderLeftColor: theme.palette.success.main,
               backgroundColor: alpha(theme.palette.success.main, 0.08),
               color: theme.palette.success.main,
             },
             '& .RichEditor-callout-danger': {
               borderLeftColor: theme.palette.error.main,
               backgroundColor: alpha(theme.palette.error.main, 0.08),
               color: theme.palette.error.main,
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
            blockStyleFn={(block: any) => {
              const base = blockStyleFn(block);
              const type = block.getType();
              if (type === 'header-one' || type === 'header-two' || type === 'header-three') {
                return `${base} note-anchor-${block.getKey()}`.trim();
              }
              return base;
            }}
            blockRendererFn={blockRendererFn}
            handleKeyCommand={handleKeyCommandWrapper}
            handleReturn={handleReturn}
            handleBeforeInput={handleBeforeInput}
            handlePastedText={handlePastedText}
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
            onToggleCallout={handleToggleCallout}
            onInsertTradeLink={onInsertTradeLink}
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
            onToggleCallout={handleToggleCallout}
            onInsertTradeLink={onInsertTradeLink}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}

      </Box>

      {/* Link Dialog */}
      {(() => {
        const {
          paperSx,
          headerSx,
          iconAvatarSx,
          footerSx,
          monoLabelSx,
          optionalSx,
          inputSx,
          primaryButtonSx,
          ghostButtonSx,
          destructiveButtonSx,
        } = linkDialogTokens;
        const hasExistingLink = !!getCurrentLink(editorState);
        const handleClose = () => setLinkDialogOpen(false);
        return (
          <Dialog
            open={linkDialogOpen}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            disableScrollLock
            disableRestoreFocus
            {...dialogProps}
            sx={{ zIndex: Z_INDEX }}
            slotProps={{ paper: { sx: paperSx } }}
          >
            {/* Header */}
            <Box sx={headerSx}>
              <Box sx={iconAvatarSx}>
                {hasExistingLink ? (
                  <EditIcon sx={{ fontSize: 18 }} />
                ) : (
                  <LinkIcon sx={{ fontSize: 18 }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                  {hasExistingLink ? 'Edit link' : 'Insert link'}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}
                >
                  Connect a snippet of text to a URL
                </Typography>
              </Box>
              <IconButton
                onClick={handleClose}
                size="small"
                sx={{ color: theme.palette.text.secondary }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Body */}
            <Box
              sx={{
                px: 2.5,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.75,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>
                  Link text
                  <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>· Optional</Box>
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text — leave blank to use the URL"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && linkUrl.trim()) {
                      e.preventDefault();
                      insertLink();
                    }
                  }}
                  sx={inputSx}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>
                  URL
                  <Box
                    component="span"
                    sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
                  >
                    *
                  </Box>
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && linkUrl.trim()) {
                      e.preventDefault();
                      insertLink();
                    }
                  }}
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Footer */}
            <Box sx={{ ...footerSx, justifyContent: 'space-between' }}>
              {hasExistingLink ? (
                <Button
                  onClick={() => {
                    removeLink();
                    setLinkDialogOpen(false);
                    setLinkText('');
                    setLinkUrl('');
                  }}
                  startIcon={<LinkOffIcon sx={{ fontSize: 16 }} />}
                  sx={destructiveButtonSx}
                >
                  Remove link
                </Button>
              ) : (
                <Box />
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button onClick={handleClose} sx={ghostButtonSx}>
                  Cancel
                </Button>
                <Button
                  onClick={insertLink}
                  disabled={!linkUrl.trim()}
                  variant="contained"
                  endIcon={!hasExistingLink ? <ArrowIcon sx={{ fontSize: 14 }} /> : undefined}
                  sx={primaryButtonSx}
                >
                  {hasExistingLink ? 'Update link' : 'Insert link'}
                </Button>
              </Box>
            </Box>
          </Dialog>
        );
      })()}

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