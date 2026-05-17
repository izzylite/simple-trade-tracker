/**
 * NoteEditorBody
 *
 * Reusable note-editor body. Owns title/content/cover/reminder/color/tags/global
 * state plus save / pin / archive / delete / share lifecycle. Used in two contexts:
 *   - <NoteEditorDialog>  → wraps the body inside a MUI <Dialog>
 *   - <NotesPage>         → renders the body inline as the center column
 *
 * Parents drive close/done buttons via the `trailingAction` prop. Imperative
 * handle exposes `saveIfDirty()` / `hasChanges()` so the dialog can flush before
 * closing.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  ReactNode,
} from 'react';
import {
  TextField,
  IconButton,
  Box,
  useTheme,
  alpha,
  Typography,
  Alert,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Divider,
  Collapse,
  Popover,
  Switch,
  FormControlLabel,
  Tooltip,
  Snackbar,
  MenuList,
  MenuItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  pink,
  purple,
  deepPurple,
  indigo,
  lightBlue,
  cyan,
  teal,
  lightGreen,
  lime,
  yellow,
  amber,
  deepOrange,
  brown,
  grey,
  blueGrey,
} from '@mui/material/colors';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  NotificationsActive as ReminderIcon,
  NotificationsNone as NoReminderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalOffer as TagIcon,
  Add as AddIcon,
  Public as GlobalIcon,
  Lock as PrivateIcon,
  ArrowBack as ArrowBackIcon,
  StickyNote2Outlined as NoteIcon,
  LocalOfferOutlined as TagIcon2,
  EventOutlined as EventIcon,
  CallMadeOutlined as TradeLinkIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { formatDistanceToNow } from 'date-fns';

import { EditorState } from 'draft-js';
import RichTextEditor, {
  RichTextEditorHandle,
} from '../common/RichTextEditor';
import type { TradeChipData } from '../common/RichTextEditor/utils/tradeEntityUtils';
import { isInternalTradeLink } from '../common/RichTextEditor/utils/linkUtils';
import { Z_INDEX } from '../../styles/zIndex';
import EditorToolbar from '../common/RichTextEditor/components/EditorToolbar';
import ImagePickerDialog from '../heroImage/ImagePickerDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { useAuthState } from '../../contexts/AuthStateContext';
import * as notesService from '../../services/notesService';
import {
  Note,
  ReminderType,
  DayAbbreviation,
  GUIDELINE_TAG,
  GAME_PLAN_TAG,
} from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import { isGroupedTag, getTagName, getTagGroup } from '../../utils/tagColors';
import NoteShareButton from './NoteShareButton';
import { useNoteNavigation } from '../../hooks/useNoteNavigation';
import { getContentAsJson } from '../common/RichTextEditor/utils/draftUtils';
import { getSharedTrade } from '../../services/sharingService';
import { Trade } from '../../types/dualWrite';
import TradeGalleryDialog from '../TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';
import { IMPACT_COLORS, CURRENCY_FLAGS } from '../../types/economicCalendar';
import type { ImpactLevel, Currency } from '../../types/economicCalendar';
import {
  DEFAULT_NOTE_TAGS_MAP,
  getTagDisplayLabel,
  getTagSubtitle,
} from './NoteEditorDialogTags';

// Full day names for game plan titles
const DAY_FULL_NAMES: Record<DayAbbreviation, string> = {
  Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
};

// Curated cover images for game plan notes
const GAME_PLAN_COVERS = [
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1504607798333-52571ff7fba3?w=800&h=400&fit=crop',
];

export interface NoteEditorBodyProps {
  /** Whether the body is mounted/visible. Triggers data init on transition false→true. */
  isActive: boolean;
  /** Existing note (edit mode). Omit for new note. */
  note?: Note;
  /** Calendar id for new notes. */
  calendarId: string;
  /** Persisted save callback. */
  onSave?: (note: Note, isCreated?: boolean) => void;
  /** Delete callback. */
  onDelete?: (noteId: string) => void;
  /** Parent close request — fired on archive (if archiving), back-nav exhaustion, etc. */
  onCloseRequest?: () => void;
  /** Week note flag (forces calendar-bound, locks Global toggle). */
  weekKey?: string;
  /** Game plan creation template seed. */
  gamePlanDay?: DayAbbreviation;
  /** Pre-fill tags on a new note. */
  initialTags?: string[];
  /** Trade tags from calendar for inline @ insertion. */
  availableTradeTags?: string[];
  /** Notes from calendar for /note linking. */
  calendarNotes?: Array<{ id: string; title: string }>;
  /** Pinned events for /event linking. */
  pinnedEvents?: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
  /** Trailing slot rendered in the top status row (e.g. dialog X close, page Done button). */
  trailingAction?: ReactNode;
  /** Hides the internal "Edit Note / New Note" title text in the status row when true. */
  hideTitleLabel?: boolean;
}

export interface NoteEditorBodyHandle {
  /** Returns true if state diverges from the persisted note. */
  hasChanges: () => boolean;
  /** Saves only if dirty. Resolves after save completes. */
  saveIfDirty: () => Promise<void>;
}

const NoteEditorBody = forwardRef<NoteEditorBodyHandle, NoteEditorBodyProps>(({
  isActive,
  note: initialNote,
  calendarId,
  onSave,
  onDelete,
  onCloseRequest,
  weekKey,
  gamePlanDay,
  initialTags,
  availableTradeTags = [],
  calendarNotes,
  pinnedEvents,
  trailingAction,
  hideTitleLabel = false,
}, ref) => {
  const theme = useTheme();
  const { user } = useAuthState();
  const noteNav = useNoteNavigation();

  const editorRef = useRef<RichTextEditorHandle>(null);
  const [, setIsToolbarMenuOpen] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  // Mirror the RTE's internal editorState so the external sticky toolbar
  // reflects active inline styles + block type on every keystroke. The
  // imperative ref returns a stale value here because typing doesn't
  // re-render this parent unless we explicitly track the state.
  const [liveEditorState, setLiveEditorState] = useState<EditorState | null>(null);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setEditorMounted(true), 50);
      return () => clearTimeout(timer);
    } else {
      setEditorMounted(false);
      setLiveEditorState(null);
    }
  }, [isActive]);

  // Initialize state from initialNote synchronously on first render. The
  // alternative (init via useEffect) leaves a window where note state and
  // noteRef are null while saveNote could fire — that window caused the
  // editor to take the CREATE branch on existing notes and duplicate them.
  const [note, setNote] = useState<Note | null>(initialNote ?? null);
  const [title, setTitle] = useState<string>(initialNote?.title ?? (weekKey ? `Week of ${weekKey}` : ''));
  const [content, setContent] = useState<string>(initialNote?.content ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initialNote?.cover_image ?? null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(
    initialNote ? new Date(initialNote.updated_at) : null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reminder states
  const [reminderType, setReminderType] = useState<ReminderType>(initialNote?.reminder_type || 'none');
  const [reminderDate, setReminderDate] = useState<Date | null>(initialNote?.reminder_date ?? null);
  const [reminderDays, setReminderDays] = useState<DayAbbreviation[]>(initialNote?.reminder_days ?? []);
  const [isReminderActive, setIsReminderActive] = useState(initialNote?.is_reminder_active ?? false);
  const [isReminderExpanded, setIsReminderExpanded] = useState(!initialNote);
  // Color
  const [noteColor, setNoteColor] = useState(initialNote?.color);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);

  // Tags
  const [tags, setTags] = useState<string[]>(initialNote?.tags ?? initialTags ?? []);
  const [newTagInput, setNewTagInput] = useState('');
  const [hasExistingGuideline, setHasExistingGuideline] = useState(false);
  const [tagPopoverAnchor, setTagPopoverAnchor] = useState<HTMLElement | null>(null);

  // Global note (null calendar_id = visible in all calendars)
  const [isGlobal, setIsGlobal] = useState(initialNote?.calendar_id === null);

  // Mention re-render counter
  const [, setMentionVersion] = useState(0);

  // Share snackbar
  const [shareSnackbar, setShareSnackbar] = useState<string | null>(null);

  // Trade preview (TradeGalleryDialog)
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [tradePreviewOpen, setTradePreviewOpen] = useState(false);
  const [tradePreviewLoading, setTradePreviewLoading] = useState(false);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  // Available notes for /note picker (exclude current)
  const availableNotes = (calendarNotes ?? [])
    .filter(n => n.id !== initialNote?.id)
    .map(n => ({ id: n.id, title: n.title }));

  const allDays: DayAbbreviation[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const defaultTags = Object.keys(DEFAULT_NOTE_TAGS_MAP);

  // Check existing guideline note (max 1 per user)
  useEffect(() => {
    const checkGuideline = async () => {
      if (isActive && user?.id) {
        try {
          const guidelineNotes = await notesService.getNotesByTag(user.id, GUIDELINE_TAG);
          const existing = guidelineNotes.find(n => n.id !== initialNote?.id);
          setHasExistingGuideline(!!existing);
        } catch (err) {
          logger.error('Error checking guideline tag', err);
        }
      }
    };
    void checkGuideline();
  }, [isActive, user?.id, initialNote?.id]);

  // Initialize state when becoming active or note changes
  useEffect(() => {
    if (!isActive) return;
    if (initialNote) {
      setNote(initialNote);
      setTitle(initialNote.title);
      setContent(initialNote.content);
      setCoverImage(initialNote.cover_image);
      setReminderType(initialNote.reminder_type || 'none');
      setReminderDate(initialNote.reminder_date || null);
      setReminderDays(initialNote.reminder_days || []);
      setIsReminderActive(initialNote.is_reminder_active || false);
      setIsReminderExpanded(false);
      setNoteColor(initialNote.color);
      setTags(initialNote.tags || []);
      setIsGlobal(initialNote.calendar_id === null);
      setSavedAt(new Date(initialNote.updated_at));
      // Reset snapshot — fresh note loaded, no save in this session yet.
      lastSavedRef.current = null;
    } else {
      setNote(null);
      if (gamePlanDay) {
        const fullDay = DAY_FULL_NAMES[gamePlanDay];
        const randomCover = GAME_PLAN_COVERS[Math.floor(Math.random() * GAME_PLAN_COVERS.length)];
        setTitle(`${fullDay} Game Plan`);
        setContent('');
        setCoverImage(randomCover);
        setReminderType('weekly');
        setReminderDate(null);
        setReminderDays([gamePlanDay]);
        setIsReminderActive(true);
        setIsReminderExpanded(false);
        setNoteColor(undefined);
        setTags([GAME_PLAN_TAG]);
      } else {
        setTitle(weekKey ? `Week of ${weekKey}` : '');
        setContent('');
        setCoverImage(null);
        setReminderType('none');
        setReminderDate(null);
        setReminderDays([]);
        setIsReminderActive(false);
        setIsReminderExpanded(true);
        setNoteColor(undefined);
        setTags(initialTags ?? []);
      }
      setNewTagInput('');
      setIsGlobal(false);
      setSavedAt(null);
      lastSavedRef.current = null;
    }
  }, [isActive, initialNote, gamePlanDay, weekKey, initialTags]);

  // ─── Save / dirty checks ──────────────────────────────────────────────────
  // Refs mirror state used inside the unmount-flush closure. Without these,
  // setNote(created) scheduled inside saveNote can be lost when the parent
  // unmounts the body before the state commit (e.g. Done → handleExitEdit
  // batches both updates), causing the cleanup to re-create the same note.
  // Seed the ref with initialNote on first render — eliminates the gap
  // between mount and the noteRef sync effect where saveNote would
  // otherwise see noteRef.current = null and CREATE a duplicate row for
  // an existing note.
  const noteRef = useRef<Note | null>(initialNote ?? null);
  const savingRef = useRef(false);
  // mountedRef gates React state updates inside the async save path so we
  // don't call setNote/setSavedAt on an unmounted component (silent no-op
  // + dev warning) when the user navigates away mid-save.
  const mountedRef = useRef(true);
  // Snapshot of values last sent to the server. hasChanges compares the live
  // state to THIS, not to the server-coerced row (which may differ — empty
  // title becomes "Untitled"). Without it, a fresh save would always look
  // dirty afterward and the unmount-flush would issue a redundant UPDATE.
  type SavedSnapshot = {
    title: string;
    content: string;
    coverImage: string | null;
    reminderType: ReminderType;
    reminderDate: Date | null;
    reminderDays: DayAbbreviation[];
    isReminderActive: boolean;
    tags: string[];
    noteColor: string | undefined;
    isGlobal: boolean;
  };
  const lastSavedRef = useRef<SavedSnapshot | null>(null);
  useEffect(() => { noteRef.current = note; }, [note]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const saveNote = useCallback(async (): Promise<void> => {
    if (savingRef.current) return; // dedupe concurrent saves
    if (!user?.uid) return;
    // Read live content from the editor ref. Closure-captured `content`
    // may lag by one render when save fires in the same event as a
    // keystroke (e.g. picker-chip click). Falling back to state for the
    // case where the editor hasn't mounted yet.
    const liveContent = editorRef.current?.editorState
      ? getContentAsJson(editorRef.current.editorState)
      : content;
    // Persist partial drafts — title or content alone is enough. Reject only
    // if both are empty AND nothing else (cover, reminder, tags, color) has
    // been set, to avoid creating an entirely blank row.
    const hasTitle = title.trim() !== '';
    const hasContent = liveContent.trim() !== '';
    const hasOtherSignal =
      coverImage !== null ||
      tags.length > 0 ||
      noteColor !== undefined ||
      (reminderType !== 'none' && isReminderActive);
    if (!hasTitle && !hasContent && !hasOtherSignal) return;

    savingRef.current = true;
    // Snapshot the values being sent NOW. After save we'll commit this to
    // lastSavedRef so subsequent hasChanges calls compare against what we
    // actually shipped, not against the server-coerced row.
    const sentSnapshot: SavedSnapshot = {
      title, content: liveContent, coverImage, reminderType, reminderDate, reminderDays,
      isReminderActive, tags, noteColor, isGlobal,
    };
    try {
      if (mountedRef.current) setSaving(true);
      const liveNote = noteRef.current;
      if (liveNote) {
        const updates: any = {
          title,
          content: liveContent,
          cover_image: coverImage,
          reminder_type: reminderType,
          reminder_date: reminderDate,
          reminder_days: reminderDays,
          is_reminder_active: isReminderActive,
          color: noteColor ?? null,
          calendar_id: isGlobal ? null : calendarId,
        };
        if (!liveNote.by_assistant) updates.tags = tags;
        await notesService.updateNote(liveNote.id, updates);
        const fresh = await notesService.getNote(liveNote.id);
        if (fresh) {
          noteRef.current = fresh;
          lastSavedRef.current = sentSnapshot;
          if (mountedRef.current) {
            setNote(fresh);
            setSavedAt(new Date(fresh.updated_at));
          }
          // Always notify the parent — it caches the list and reconciles
          // selectedNote on its own, even after this body has unmounted.
          if (onSave) onSave(fresh, false);
        }
      } else {
        const created = await notesService.createNote({
          user_id: user.uid,
          calendar_id: isGlobal && !weekKey ? null : calendarId,
          title,
          content: liveContent,
          cover_image: coverImage,
          reminder_type: reminderType,
          reminder_date: reminderDate,
          reminder_days: reminderDays,
          is_reminder_active: isReminderActive,
          color: (noteColor ?? null) as any,
          tags,
          week_key: weekKey ?? null,
        });
        // Sync refs BEFORE setNote — guarantees a follow-up saveNote sees
        // the persisted row even if the React state update gets dropped
        // (e.g. parent unmounts the body before commit). lastSavedRef
        // captures what we sent, so the unmount-flush hasChanges sees no
        // diff and skips the redundant UPDATE.
        noteRef.current = created;
        lastSavedRef.current = sentSnapshot;
        if (mountedRef.current) {
          setNote(created);
          setSavedAt(new Date(created.updated_at));
        }
        if (onSave) onSave(created, true);
      }
    } catch (err) {
      logger.error('Error saving note:', err);
    } finally {
      if (mountedRef.current) setSaving(false);
      savingRef.current = false;
    }
  }, [user?.uid, title, content, coverImage, reminderType, reminderDate, reminderDays, isReminderActive, noteColor, isGlobal, calendarId, weekKey, tags, onSave]);

  const hasChanges = useCallback((): boolean => {
    // Pull live content from the editor ref. The `content` state lags by
    // one render when a save is dispatched in the same event as a
    // keystroke (e.g. picker-chip click), and saveIfDirty()'s gate must
    // see the freshest content or it will short-circuit the save.
    const liveContent = editorRef.current?.editorState
      ? getContentAsJson(editorRef.current.editorState)
      : content;
    // Once a save has happened in this session, compare to the snapshot of
    // what we last shipped — this is the only authoritative "clean" state.
    // Comparing to noteRef.current.title would falsely flag a save's empty
    // title as dirty because the server coerces it to "Untitled".
    const snap = lastSavedRef.current;
    if (snap) {
      return (
        title !== snap.title ||
        liveContent !== snap.content ||
        coverImage !== snap.coverImage ||
        reminderType !== snap.reminderType ||
        reminderDate !== snap.reminderDate ||
        JSON.stringify(reminderDays) !== JSON.stringify(snap.reminderDays) ||
        isReminderActive !== snap.isReminderActive ||
        JSON.stringify(tags) !== JSON.stringify(snap.tags) ||
        noteColor !== snap.noteColor ||
        isGlobal !== snap.isGlobal
      );
    }

    // No snapshot yet — either a fresh existing-note edit or a new draft.
    const liveNote = noteRef.current;
    if (!liveNote) {
      const hasNonEmptyTitle = title && title.trim() !== '';
      const hasNonEmptyContent = liveContent && liveContent.trim() !== '';
      const hasCoverImage = coverImage !== null;
      const hasReminder = reminderType !== 'none' && isReminderActive;
      const hasTags = tags.length > 0;
      const hasColor = noteColor !== undefined;
      return Boolean(hasNonEmptyTitle || hasNonEmptyContent || hasCoverImage || hasReminder || hasTags || hasColor);
    }
    const titleChanged = title !== liveNote.title;
    const contentChanged = liveContent !== liveNote.content;
    const coverImageChanged = coverImage !== liveNote.cover_image;
    const reminderTypeChanged = reminderType !== (liveNote.reminder_type || 'none');
    const reminderDateChanged = reminderDate !== (liveNote.reminder_date || null);
    const reminderDaysChanged = JSON.stringify(reminderDays) !== JSON.stringify(liveNote.reminder_days || []);
    const reminderActiveChanged = isReminderActive !== (liveNote.is_reminder_active || false);
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(liveNote.tags || []);
    const colorChanged = noteColor !== liveNote.color;
    const globalChanged = isGlobal !== (liveNote.calendar_id === null);
    return titleChanged || contentChanged || coverImageChanged || reminderTypeChanged ||
      reminderDateChanged || reminderDaysChanged || reminderActiveChanged || tagsChanged || colorChanged || globalChanged;
  }, [title, content, coverImage, reminderType, reminderDate, reminderDays, isReminderActive, tags, noteColor, isGlobal]);

  const saveIfDirty = useCallback(async () => {
    if (hasChanges()) await saveNote();
  }, [hasChanges, saveNote]);

  useImperativeHandle(ref, () => ({ hasChanges, saveIfDirty }), [hasChanges, saveIfDirty]);

  // Flush save on unmount — user swapping notes mid-edit must not lose draft.
  // Capture latest saveIfDirty via ref so cleanup uses the freshest closure.
  const saveIfDirtyRef = useRef(saveIfDirty);
  useEffect(() => { saveIfDirtyRef.current = saveIfDirty; }, [saveIfDirty]);
  useEffect(() => () => { void saveIfDirtyRef.current(); }, []);

  // Auto-save on changes (debounced) — only for existing notes
  useEffect(() => {
    if (!isActive) return;
    if (!note) return;
    if (!hasChanges()) return;
    const timeout = setTimeout(() => { void saveNote(); }, 60000);
    return () => clearTimeout(timeout);
  }, [title, content, coverImage, tags, isGlobal, isActive, note, hasChanges, saveNote]);

  // Note navigation: load note on nav forward/back
  useEffect(() => {
    if (noteNav.navVersion === 0) return;
    const targetId = noteNav.currentNoteId || initialNote?.id;
    if (!targetId) return;

    const loadNote = async () => {
      try {
        const fresh = await notesService.getNote(targetId);
        if (fresh) {
          setNote(fresh);
          setTitle(fresh.title);
          setContent(fresh.content);
          setCoverImage(fresh.cover_image);
          setNoteColor(fresh.color);
          setTags(fresh.tags || []);
          setReminderType(fresh.reminder_type || 'none');
          setReminderDate(fresh.reminder_date || null);
          setReminderDays(fresh.reminder_days || []);
          setIsReminderActive(fresh.is_reminder_active || false);
          setIsGlobal(fresh.calendar_id === null);
          setSavedAt(new Date(fresh.updated_at));
        } else if (noteNav.currentNoteId) {
          noteNav.goBack();
        }
      } catch {
        if (noteNav.currentNoteId) noteNav.goBack();
      }
    };
    void loadNote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteNav.navVersion]);

  const handleNoteLinkClick = useCallback(async (noteId: string, noteTitle: string) => {
    // Route through the shared save path so savingRef + lastSavedRef stay
    // honest. hasChanges + saveNote both read live content from
    // editorRef, so we don't need to sync setContent first — the save
    // path picks up the freshest content regardless of whether the
    // setContent for the last keystroke has flushed.
    await saveIfDirty();
    noteNav.navigateTo(noteId, noteTitle);
  }, [noteNav, saveIfDirty]);

  // ─── Insert-trade-link dialog ────────────────────────────────────────────
  // Toolbar button → dialog → user pastes /shared/<shareId> URL → we resolve
  // it via getSharedTrade and ask the editor to insert a TRADE_LINK chip.
  const [tradeLinkDialogOpen, setTradeLinkDialogOpen] = useState(false);
  const [tradeLinkInputUrl, setTradeLinkInputUrl] = useState('');
  const [tradeLinkError, setTradeLinkError] = useState<string | null>(null);
  const [tradeLinkLoading, setTradeLinkLoading] = useState(false);

  const openTradeLinkDialog = useCallback(() => {
    setTradeLinkInputUrl('');
    setTradeLinkError(null);
    setTradeLinkLoading(false);
    setTradeLinkDialogOpen(true);
  }, []);

  const submitTradeLinkInsert = useCallback(async () => {
    const url = tradeLinkInputUrl.trim();
    if (!url) {
      setTradeLinkError('Paste a trade share link to continue.');
      return;
    }
    const parsed = isInternalTradeLink(url);
    if (parsed.type !== 'shared' || !parsed.id) {
      setTradeLinkError("That doesn't look like a trade share link (expected /shared/<id>).");
      return;
    }
    setTradeLinkError(null);
    setTradeLinkLoading(true);
    try {
      const result = await getSharedTrade(parsed.id);
      const trade = result?.trade;
      if (!trade) {
        setTradeLinkError('Share link not found or is no longer accessible.');
        return;
      }
      const data: TradeChipData = {
        shareId: parsed.id,
        tradeId: trade.id,
        date: new Date(trade.trade_date).toISOString(),
        // trade.amount is signed P&L; preserve sign for win/loss styling.
        pnl: trade.amount ?? 0,
      };
      editorRef.current?.insertTradeLink(data);
      setTradeLinkDialogOpen(false);
    } catch (err) {
      logger.error('Failed to resolve trade share link', err);
      setTradeLinkError('Failed to load the trade. Check the link and try again.');
    } finally {
      setTradeLinkLoading(false);
    }
  }, [tradeLinkInputUrl]);

  const handleSharedTradeClick = useCallback(async (shareId: string, _tradeId: string) => {
    setTradePreviewOpen(true);
    setTradePreviewLoading(true);
    try {
      const data = await getSharedTrade(shareId);
      if (data?.trade) setPreviewTrade(data.trade);
    } catch (err) {
      logger.error('Error loading shared trade:', err);
    } finally {
      setTradePreviewLoading(false);
    }
  }, []);

  const handleImageSelect = (imageUrl: string) => {
    setCoverImage(imageUrl);
    setImagePickerOpen(false);
  };
  const handleRemoveCover = () => setCoverImage(null);

  const handlePinNote = async () => {
    if (!note) return;
    try {
      if (note.is_pinned) await notesService.unpinNote(note.id);
      else await notesService.pinNote(note.id);
      setNote(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : null);
      if (onSave) onSave({ ...note, is_pinned: !note.is_pinned });
    } catch (err) {
      logger.error('Error toggling pin:', err);
    }
  };

  const handleArchiveNote = async () => {
    if (!note) return;
    try {
      if (note.is_archived) {
        await notesService.unarchiveNote(note.id);
        if (onSave) onSave({ ...note, is_archived: false, archived_at: null });
        setNote(prev => prev ? { ...prev, is_archived: false } : null);
      } else {
        await notesService.archiveNote(note.id);
        setNote(prev => prev ? { ...prev, is_archived: true, archived_at: new Date() } : null);
        if (onCloseRequest) onCloseRequest();
      }
    } catch (err) {
      logger.error('Error toggling archive:', err);
    }
  };

  const handleDeleteNote = () => {
    if (!note) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!note) return;
    try {
      setDeleting(true);
      await notesService.deleteNote(note.id);
      if (onDelete) onDelete(note.id);
      setDeleteConfirmOpen(false);
      if (onCloseRequest) onCloseRequest();
    } catch (err) {
      logger.error('Error deleting note:', err);
      setDeleting(false);
    }
  };

  const handleReminderTypeChange = (_e: React.MouseEvent<HTMLElement>, newType: ReminderType | null) => {
    if (newType === null) return;
    setReminderType(newType);
    setIsReminderActive(newType !== 'none');
    if (newType === 'none') { setReminderDate(null); setReminderDays([]); }
    else if (newType === 'once') setReminderDays([]);
    else if (newType === 'weekly') setReminderDate(null);
  };

  const handleToggleDay = (day: DayAbbreviation) => {
    setReminderDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleAddTag = (tagValue: string) => {
    if (tagValue && !tags.includes(tagValue)) {
      setTags(prev => [...prev, tagValue]);
      setNewTagInput('');
    }
  };
  const handleRemoveTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const isTagEditingAllowed = !note?.by_assistant;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      // minWidth: 0 + overflow: hidden so the mention picker bar's wide
      // chip strip can scroll horizontally instead of forcing the parent
      // (page) wider than the viewport.
      minWidth: 0,
      overflow: 'hidden',
      bgcolor: 'background.default',
      // Isolate stacking context — EditorToolbar uses z-index 1900 (sized for
      // dialog use), which would otherwise float above the app shell when the
      // body renders inline on NotesPage.
      isolation: 'isolate',
    }}>

      {/* Top status row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          flexShrink: 0,
        }}
      >
        {noteNav.isNavigated && (
          <IconButton size="small" onClick={noteNav.goBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}

        {!hideTitleLabel && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {note ? 'Edit Note' : 'New Note'}
          </Typography>
        )}

        <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', flex: 1 }}>
          {savedAt ? `Saved ${formatDistanceToNow(savedAt, { addSuffix: true })}` : 'Unsaved draft'}
        </Typography>

        {/* Share button (only for saved, user-created notes) */}
        {note && !note.by_assistant && (
          <NoteShareButton
            note={note}
            onNoteUpdate={(updates) => setNote(prev => prev ? { ...prev, ...updates } : prev)}
            onSnackbar={(msg) => setShareSnackbar(msg)}
          />
        )}

        {trailingAction}
      </Box>

      {/* Editor toolbar (sticky) */}
      {editorMounted && editorRef.current && (liveEditorState ?? editorRef.current.editorState) && (
        <EditorToolbar
          editorState={liveEditorState ?? editorRef.current.editorState}
          disabled={false}
          variant="sticky"
          stickyPosition="top"
          toolbarRef={editorRef.current.toolbarRef}
          onToggleInlineStyle={(s) => editorRef.current?.toggleInlineStyle(s)}
          onToggleBlockType={(b) => editorRef.current?.toggleBlockType(b)}
          onApplyTextColor={(c) => editorRef.current?.applyTextColor(c)}
          onApplyBackgroundColor={(c) => editorRef.current?.applyBackgroundColor(c)}
          onApplyHeading={(h) => editorRef.current?.applyHeading(h)}
          onClearFormatting={() => editorRef.current?.clearFormatting()}
          onLinkClick={() => editorRef.current?.handleLinkClick()}
          onImageClick={() => editorRef.current?.handleImageClick()}
          onToggleCallout={(v) => editorRef.current?.toggleCallout(v)}
          onInsertTradeLink={openTradeLinkDialog}
          onMenuOpenChange={(open) => {
            setIsToolbarMenuOpen(open);
            editorRef.current?.setIsMenuOpen(open);
          }}
        />
      )}

      {/* Picker bar — mention/note/event. minWidth: 0 + width: 100% so the
          chip strip scrolls horizontally inside the bar instead of pushing
          the bar (and the page) wider than the viewport. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.5,
          height: 36,
          minHeight: 36,
          maxHeight: 36,
          width: '100%',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          whiteSpace: 'nowrap',
          '&::-webkit-scrollbar': { height: 0, display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {editorMounted && editorRef.current?.mentionActive &&
          (editorRef.current.mentionFilteredTags?.length ?? 0) > 0 ? (
          editorRef.current.mentionFilteredTags.map((tag, idx) => {
            const isSelected = idx === editorRef.current!.mentionSelectedIndex;
            const grouped = isGroupedTag(tag);
            const groupName = grouped ? getTagGroup(tag) : '';
            const displayName = grouped ? getTagName(tag) : tag;
            return (
              <Chip
                key={tag}
                ref={(el: HTMLDivElement | null) => {
                  if (isSelected && el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }}
                icon={<TagIcon2 sx={{ fontSize: '0.7rem', color: 'inherit' }} />}
                label={grouped ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 800 }}>{groupName}</Box>
                    <span>{displayName}</span>
                  </Box>
                ) : displayName}
                size="small"
                onMouseDown={(e) => { e.preventDefault(); editorRef.current?.handleMentionSelect(tag); }}
                sx={{
                  cursor: 'pointer', flexShrink: 0,
                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.text.primary, 0.06),
                  color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                  fontWeight: 600, fontSize: '0.73rem',
                  border: isSelected
                    ? `1.5px solid ${alpha(theme.palette.primary.main, 0.25)}`
                    : `1px solid ${alpha(theme.palette.text.primary, 0.15)}`,
                  transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main },
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            );
          })
        ) : editorMounted && editorRef.current?.noteLinkActive &&
          (editorRef.current.noteLinkFilteredNotes?.length ?? 0) > 0 ? (
          editorRef.current.noteLinkFilteredNotes.map((n, idx) => {
            const isSelected = idx === editorRef.current!.noteLinkSelectedIndex;
            return (
              <Chip
                key={n.id}
                ref={(el: HTMLDivElement | null) => {
                  if (isSelected && el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }}
                icon={<NoteIcon sx={{ fontSize: '0.85rem', color: 'inherit' }} />}
                label={n.title || 'Untitled'}
                size="small"
                onMouseDown={(e) => { e.preventDefault(); editorRef.current?.handleNoteLinkSelect(n.id, n.title); }}
                sx={{
                  cursor: 'pointer', flexShrink: 0,
                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.text.primary, 0.06),
                  color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                  fontWeight: 600, fontSize: '0.73rem',
                  border: isSelected
                    ? `1.5px solid ${alpha(theme.palette.primary.main, 0.25)}`
                    : `1px solid ${alpha(theme.palette.text.primary, 0.15)}`,
                  transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main },
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            );
          })
        ) : editorMounted && editorRef.current?.eventLinkActive &&
          (editorRef.current.eventLinkFilteredEvents?.length ?? 0) > 0 ? (
          editorRef.current.eventLinkFilteredEvents.map((ev, idx) => {
            const isSelected = idx === editorRef.current!.eventLinkSelectedIndex;
            const impactColor = IMPACT_COLORS[ev.impact as ImpactLevel] || theme.palette.text.secondary;
            const _flag = CURRENCY_FLAGS[ev.currency as Currency] || '';
            return (
              <Chip
                key={ev.event_id}
                ref={(el: HTMLDivElement | null) => {
                  if (isSelected && el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }}
                icon={<EventIcon sx={{ fontSize: '0.85rem', color: 'inherit' }} />}
                label={
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    {ev.currency && (
                      <Box component="span" sx={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.03em' }}>{ev.currency}</Box>
                    )}
                    <span>{ev.event}</span>
                  </Box>
                }
                size="small"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editorRef.current?.handleEventLinkSelect(
                    ev.event_id, ev.event,
                    (ev.currency || 'USD') as Currency,
                    (ev.impact || 'Medium') as ImpactLevel
                  );
                }}
                sx={{
                  cursor: 'pointer', flexShrink: 0,
                  bgcolor: isSelected ? alpha(impactColor, 0.1) : alpha(theme.palette.text.primary, 0.06),
                  color: isSelected ? impactColor : theme.palette.text.secondary,
                  fontWeight: 600, fontSize: '0.73rem',
                  border: isSelected
                    ? `1.5px solid ${alpha(impactColor, 0.25)}`
                    : `1px solid ${alpha(theme.palette.text.primary, 0.15)}`,
                  transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': { bgcolor: alpha(impactColor, 0.1), color: impactColor },
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            );
          })
        ) : (
          <Typography
            variant="caption"
            sx={{
              color: alpha(theme.palette.text.secondary, 0.4),
              fontStyle: 'italic',
              fontSize: '0.75rem',
              userSelect: 'none',
            }}
          >
            Type /tag, /note, or /event (followed by a space) to embed — or use the toolbar to insert a trade share link
          </Typography>
        )}
      </Box>

      {/* Scroll content */}
      <Box sx={{ flex: 1, overflowY: 'auto', ...(scrollbarStyles(theme) as any) }}>

        {/* Cover */}
        {coverImage && (
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 260,
              backgroundImage: `url(${coverImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              '&:hover .cover-actions': { opacity: 1 },
            }}
          >
            <Box
              className="cover-actions"
              sx={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.2s' }}
            >
              <IconButton onClick={() => setImagePickerOpen(true)} sx={{ bgcolor: theme.palette.background.paper, '&:hover': { bgcolor: theme.palette.background.paper } }}>
                <ImageIcon />
              </IconButton>
              <IconButton onClick={handleRemoveCover} sx={{ bgcolor: theme.palette.background.paper, '&:hover': { bgcolor: theme.palette.background.paper } }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        )}

        {/* Settings sub-header — neutral, less colored chrome */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 0.75,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Box
            onClick={() => setIsReminderExpanded(!isReminderExpanded)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.25, '&:hover': { opacity: 0.8 } }}
          >
            {isReminderActive
              ? <ReminderIcon sx={{ color: 'info.main', fontSize: '1rem' }} />
              : <NoReminderIcon sx={{ color: 'text.disabled', fontSize: '1rem' }} />}
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Settings
            </Typography>
            {isReminderActive && reminderType !== 'none' && (
              <Typography variant="caption" color="text.disabled">
                {reminderType === 'weekly' ? `${reminderDays.length} day${reminderDays.length !== 1 ? 's' : ''}` : 'One-time'}
              </Typography>
            )}
            <IconButton size="small" sx={{ color: 'text.disabled', ml: -0.5, p: 0.25 }}>
              {isReminderExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton size="small" onClick={() => setImagePickerOpen(true)} title={coverImage ? 'Change cover' : 'Add cover image'}>
              <ImageIcon fontSize="small" />
            </IconButton>
            {note && (
              <>
                <IconButton size="small" onClick={handlePinNote} title={note.is_pinned ? 'Unpin note' : 'Pin note'} sx={{ color: note.is_pinned ? 'primary.main' : 'inherit' }}>
                  {note.is_pinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={handleArchiveNote} title={note.is_archived ? 'Unarchive note' : 'Archive note'}>
                  {note.is_archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={handleDeleteNote} title="Delete note" sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        {/* Settings collapse */}
        <Collapse in={isReminderExpanded}>
          <Box sx={{ px: 3, py: 2, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set a reminder to display this note on specific days. Perfect for game plans, daily routines, or weekly trading strategies.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <ToggleButtonGroup value={reminderType} exclusive onChange={handleReminderTypeChange} size="small">
                <ToggleButton value="none"><NoReminderIcon sx={{ mr: 1, fontSize: '1.2rem' }} />None</ToggleButton>
                <ToggleButton value="once">Once</ToggleButton>
                <ToggleButton value="weekly">Weekly</ToggleButton>
              </ToggleButtonGroup>

              {/* Color presets */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', ml: { xs: 0, sm: 2 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Color:</Typography>
                {(() => {
                  const allPresets = [
                    { value: undefined, label: 'Default', color: theme.palette.background.paper },
                    { value: 'red', label: 'Red', color: theme.palette.error.main },
                    { value: 'pink', label: 'Pink', color: pink[500] },
                    { value: 'purple', label: 'Purple', color: purple[500] },
                    { value: 'deepPurple', label: 'Deep Purple', color: deepPurple[500] },
                    { value: 'indigo', label: 'Indigo', color: indigo[500] },
                    { value: 'blue', label: 'Blue', color: theme.palette.info.main },
                    { value: 'lightBlue', label: 'Light Blue', color: lightBlue[500] },
                    { value: 'cyan', label: 'Cyan', color: cyan[500] },
                    { value: 'teal', label: 'Teal', color: teal[500] },
                    { value: 'green', label: 'Green', color: theme.palette.success.main },
                    { value: 'lightGreen', label: 'Light Green', color: lightGreen[500] },
                    { value: 'lime', label: 'Lime', color: lime[500] },
                    { value: 'yellow', label: 'Yellow', color: yellow[600] },
                    { value: 'amber', label: 'Amber', color: amber[500] },
                    { value: 'orange', label: 'Orange', color: theme.palette.warning.main },
                    { value: 'deepOrange', label: 'Deep Orange', color: deepOrange[500] },
                    { value: 'brown', label: 'Brown', color: brown[500] },
                    { value: 'grey', label: 'Grey', color: grey[500] },
                    { value: 'blueGrey', label: 'Blue Grey', color: blueGrey[500] },
                  ];
                  const visiblePresets = allPresets.slice(0, 5);
                  const hiddenPresets = allPresets.slice(5);
                  return (
                    <>
                      {visiblePresets.map((preset) => (
                        <Box
                          key={preset.label}
                          onClick={() => setNoteColor(preset.value)}
                          sx={{
                            width: 24, height: 24, borderRadius: '50%',
                            bgcolor: preset.value ? alpha(preset.color, 0.2) : alpha(theme.palette.divider, 0.1),
                            border: `2px solid ${noteColor === preset.value ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
                            cursor: 'pointer', transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.1)', border: `2px solid ${theme.palette.primary.main}` },
                          }}
                          title={preset.label}
                        />
                      ))}
                      <Box
                        onClick={(e) => setColorMenuAnchor(e.currentTarget)}
                        sx={{
                          width: 24, height: 24, borderRadius: '50%',
                          border: `1px dashed ${theme.palette.text.secondary}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                            color: theme.palette.primary.main,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                          },
                        }}
                        title="More colors"
                      >
                        <AddIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Popover
                        open={Boolean(colorMenuAnchor)}
                        anchorEl={colorMenuAnchor}
                        onClose={() => setColorMenuAnchor(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        PaperProps={{ sx: { p: 2, maxWidth: 320 } }}
                        sx={{ zIndex: Z_INDEX.DIALOG_POPUP }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, px: 0.5 }}>More Colors</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {hiddenPresets.map((preset) => (
                            <Box
                              key={preset.label}
                              onClick={() => { setNoteColor(preset.value); setColorMenuAnchor(null); }}
                              sx={{
                                width: 24, height: 24, borderRadius: '50%',
                                bgcolor: preset.value ? alpha(preset.color, 0.2) : alpha(theme.palette.divider, 0.1),
                                border: `2px solid ${noteColor === preset.value ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
                                cursor: 'pointer', transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.1)', border: `2px solid ${theme.palette.primary.main}` },
                              }}
                              title={preset.label}
                            />
                          ))}
                        </Box>
                      </Popover>
                    </>
                  );
                })()}
              </Box>
            </Box>

            {/* One-time picker */}
            {reminderType === 'once' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Reminder Date"
                  value={reminderDate}
                  onChange={(newDate) => setReminderDate(newDate)}
                  slotProps={{
                    textField: { fullWidth: true, size: 'small' },
                    popper: { sx: { zIndex: Z_INDEX.RICH_TEXT_DIALOG } },
                  }}
                />
              </LocalizationProvider>
            )}

            {/* Weekly picker */}
            {reminderType === 'weekly' && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Select days to show this reminder:</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {allDays.map((day) => (
                    <Chip
                      key={day}
                      label={day}
                      onClick={() => handleToggleDay(day)}
                      color={reminderDays.includes(day) ? 'primary' : 'default'}
                      variant={reminderDays.includes(day) ? 'filled' : 'outlined'}
                      sx={{ fontWeight: reminderDays.includes(day) ? 600 : 400, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
                {reminderDays.length === 0 && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>Please select at least one day</Typography>
                )}
              </Box>
            )}

            {/* Visibility toggle (hidden for week notes) */}
            {!weekKey && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isGlobal
                      ? <GlobalIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                      : <PrivateIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />}
                    <Typography variant="subtitle2" fontWeight={600} sx={{ color: isGlobal ? 'primary.main' : 'text.secondary' }}>
                      {isGlobal ? 'Global Note' : 'Calendar Note'}
                    </Typography>
                  </Box>
                  <Tooltip title={isGlobal ? 'This note is visible in all calendars' : 'This note is only visible in the current calendar'} placement="left">
                    <FormControlLabel
                      control={<Switch checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} size="small" color="primary" />}
                      label={<Typography variant="caption" color="text.secondary">{isGlobal ? 'All calendars' : 'This calendar only'}</Typography>}
                      labelPlacement="start"
                      sx={{ mr: 0 }}
                    />
                  </Tooltip>
                </Box>
              </>
            )}

            {/* Tag editing moved to a popover anchored to the "+ Add tag"
                pill above the title. The collapse only owns reminder /
                color / global toggle now. */}
          </Box>
        </Collapse>

        {/* Editor area */}
        <Box sx={{ maxWidth: 800, margin: '0 auto', px: { xs: 3, md: 7 }, py: 4 }}>
          {note && note.is_archived && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This note is archived.
              <Button onClick={handleArchiveNote} size="small" variant="outlined" sx={{ ml: 2 }}>Unarchive</Button>
            </Alert>
          )}

          {/* Tag chips above title */}
          {(tags.length > 0 || isTagEditingAllowed) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2, alignItems: 'center' }}>
              {tags.map(tag => (
                <Chip
                  key={tag}
                  label={getTagDisplayLabel(tag)}
                  size="small"
                  onDelete={isTagEditingAllowed ? () => handleRemoveTag(tag) : undefined}
                  sx={{
                    height: 24,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderRadius: '999px',
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: theme.palette.primary.light,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                    '& .MuiChip-label': { px: 1 },
                    '& .MuiChip-deleteIcon': {
                      color: alpha(theme.palette.primary.light, 0.7),
                      fontSize: '0.85rem',
                      '&:hover': { color: theme.palette.error.main },
                    },
                  }}
                />
              ))}
              {isTagEditingAllowed && (
                <Box
                  component="button"
                  onClick={(e) => setTagPopoverAnchor(e.currentTarget)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    background: 'transparent',
                    border: `1px dashed ${theme.palette.divider}`,
                    borderRadius: '999px',
                    px: 1.25,
                    py: 0.5,
                    color: 'text.disabled',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 150ms',
                    '&:hover': { color: 'primary.main', borderColor: alpha(theme.palette.primary.main, 0.4) },
                  }}
                >
                  <AddIcon sx={{ fontSize: '0.85rem' }} /> Add tag
                </Box>
              )}
            </Box>
          )}

          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            fullWidth
            multiline
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: { xs: '1.6rem', md: '2.2rem' },
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                '& textarea': { padding: 0 },
                '& textarea::placeholder': { color: 'text.disabled', opacity: 1 },
              },
            }}
            sx={{ mb: 3 }}
          />

          <RichTextEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            onEditorStateChange={setLiveEditorState}
            placeholder="Document your emotions, game plan, lessons learned, or trading insights... (type /tag to insert a trade tag)"
            minHeight={300}
            maxLength={5000}
            hideCharacterCount
            toolbarVariant="none"
            availableTradeTags={availableTradeTags}
            onMentionStateChange={() => setMentionVersion(v => v + 1)}
            availableNotes={availableNotes}
            onNoteLinkClick={handleNoteLinkClick}
            onNoteLinkStateChange={() => setMentionVersion(v => v + 1)}
            availableEvents={pinnedEvents}
            onEventLinkStateChange={() => setMentionVersion(v => v + 1)}
            onInsertTradeLink={openTradeLinkDialog}
            calendarId={calendarId}
            onSharedTradeClick={handleSharedTradeClick}
          />
        </Box>
      </Box>

      {/* Tag picker popover — predefined tags only. Click to add. */}
      <Popover
        open={Boolean(tagPopoverAnchor)}
        anchorEl={tagPopoverAnchor}
        onClose={() => setTagPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: 320,
              maxHeight: 360,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
        sx={{ zIndex: (t) => t.zIndex.modal + 200 }}
      >
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          Add Tag
        </Typography>
        {(() => {
          const available = defaultTags.filter(t => {
            if (tags.includes(t)) return false;
            if (t === GUIDELINE_TAG && hasExistingGuideline) return false;
            return true;
          });
          if (available.length === 0) {
            return (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  All tags applied
                </Typography>
              </Box>
            );
          }
          return (
            <MenuList
              dense
              sx={{
                flex: 1,
                overflowY: 'auto',
                py: 0.5,
                ...scrollbarStyles(theme),
              }}
            >
              {available.map(option => (
                <MenuItem
                  key={option}
                  onClick={() => {
                    handleAddTag(option);
                    setTagPopoverAnchor(null);
                  }}
                  sx={{ py: 1, px: 1.5 }}
                >
                  <ListItemText
                    primary={getTagDisplayLabel(option)}
                    secondary={getTagSubtitle(option)}
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.875rem' }}
                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                  />
                </MenuItem>
              ))}
            </MenuList>
          );
        })()}
      </Popover>

      <Snackbar
        open={!!shareSnackbar}
        autoHideDuration={3000}
        onClose={() => setShareSnackbar(null)}
        message={shareSnackbar}
      />

      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onImageSelect={handleImageSelect}
        title="Choose a cover image"
      />

      {/* Insert trade share link dialog */}
      {(() => {
        const isDarkTL = theme.palette.mode === 'dark';
        const violet = theme.palette.primary.main;
        const violetSoft = alpha(violet, isDarkTL ? 0.18 : 0.14);
        const violetBorder = alpha(violet, isDarkTL ? 0.35 : 0.28);
        const surfaceInset = isDarkTL
          ? 'rgba(255,255,255,0.03)'
          : alpha(theme.palette.text.primary, 0.03);
        const hairline = isDarkTL
          ? 'rgba(255,255,255,0.08)'
          : theme.palette.divider;
        const MONO_FONT_TL = "'JetBrains Mono', ui-monospace, monospace";
        const monoLabelSx = {
          fontFamily: MONO_FONT_TL,
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: theme.palette.text.secondary,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
        };
        const inputSx = {
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            backgroundColor: surfaceInset,
            '& fieldset': { borderColor: hairline },
            '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
            '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
          },
          '& .MuiOutlinedInput-input': {
            py: 1.1,
            fontSize: '0.88rem',
            fontWeight: 500,
            fontFamily: MONO_FONT_TL,
          },
        };
        const errorInputSx = {
          ...inputSx,
          '& .MuiOutlinedInput-root': {
            ...inputSx['& .MuiOutlinedInput-root'],
            '& fieldset': {
              borderColor: tradeLinkError
                ? alpha(theme.palette.error.main, 0.6)
                : hairline,
            },
            '&:hover fieldset': {
              borderColor: tradeLinkError
                ? theme.palette.error.main
                : alpha(violet, 0.5),
            },
            '&.Mui-focused fieldset': {
              borderColor: tradeLinkError ? theme.palette.error.main : violet,
              borderWidth: 1,
            },
          },
        };
        const handleClose = () =>
          !tradeLinkLoading && setTradeLinkDialogOpen(false);

        return (
          <Dialog
            open={tradeLinkDialogOpen}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            {...dialogProps}
            sx={{ zIndex: Z_INDEX.RICH_TEXT_DIALOG }}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: 2,
                  border: `1px solid ${hairline}`,
                  boxShadow: theme.shadows[10],
                  backgroundImage: 'none',
                  overflow: 'hidden',
                },
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 1.75,
                borderBottom: `1px solid ${hairline}`,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: violetSoft,
                  color: violet,
                  border: `1px solid ${violetBorder}`,
                  flexShrink: 0,
                }}
              >
                <TradeLinkIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}
                >
                  Insert trade share link
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.3,
                  }}
                >
                  Embed a live trade chip from any shared trade URL
                </Typography>
              </Box>
              <IconButton
                onClick={handleClose}
                disabled={tradeLinkLoading}
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1.25,
                  border: `1px solid ${hairline}`,
                  backgroundColor: surfaceInset,
                }}
              >
                <TradeLinkIcon
                  sx={{ fontSize: 14, color: violet, mt: 0.25, flexShrink: 0 }}
                />
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.5,
                  }}
                >
                  Paste a path like{' '}
                  <Box
                    component="code"
                    sx={{
                      fontFamily: MONO_FONT_TL,
                      fontSize: '0.74rem',
                      px: 0.5,
                      py: 0.125,
                      borderRadius: 0.5,
                      backgroundColor: alpha(violet, 0.1),
                      color: violet,
                    }}
                  >
                    /shared/share_…
                  </Box>{' '}
                  or the full URL. Orion will resolve it to a clickable trade chip.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>
                  Share URL
                  <Box
                    component="span"
                    sx={{
                      color: theme.palette.error.main,
                      fontFamily: 'inherit',
                    }}
                  >
                    *
                  </Box>
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  value={tradeLinkInputUrl}
                  onChange={(e) => {
                    setTradeLinkInputUrl(e.target.value);
                    if (tradeLinkError) setTradeLinkError(null);
                  }}
                  placeholder="https://app/shared/share_…"
                  error={!!tradeLinkError}
                  disabled={tradeLinkLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !tradeLinkLoading) {
                      e.preventDefault();
                      void submitTradeLinkInsert();
                    }
                  }}
                  sx={errorInputSx}
                />
                {tradeLinkError && (
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: theme.palette.error.main,
                      mt: 0.25,
                    }}
                  >
                    {tradeLinkError}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Footer */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                px: 2.5,
                py: 1.5,
                borderTop: `1px solid ${hairline}`,
                backgroundColor: isDarkTL
                  ? 'rgba(255,255,255,0.02)'
                  : alpha(theme.palette.text.primary, 0.02),
              }}
            >
              <Button
                onClick={handleClose}
                disabled={tradeLinkLoading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void submitTradeLinkInsert();
                }}
                disabled={tradeLinkLoading || !tradeLinkInputUrl.trim()}
                variant="contained"
                endIcon={
                  tradeLinkLoading ? (
                    <CircularProgress
                      size={14}
                      thickness={5}
                      sx={{ color: 'inherit' }}
                    />
                  ) : (
                    <ArrowIcon sx={{ fontSize: 14 }} />
                  )
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: violet,
                  color: '#fff',
                  borderRadius: 1.25,
                  px: 1.75,
                  py: 0.75,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                    boxShadow: 'none',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: alpha(violet, 0.35),
                    color: alpha('#fff', 0.7),
                  },
                }}
              >
                {tradeLinkLoading ? 'Resolving…' : 'Insert trade'}
              </Button>
            </Box>
          </Dialog>
        );
      })()}


      <ConfirmationDialog
        open={deleteConfirmOpen}
        title="Delete Note"
        message="Are you sure you want to permanently delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        isSubmitting={deleting}
        sx={{ zIndex: Z_INDEX.LOADING_PROGRESS }}
      />

      {tradePreviewOpen && (
        <TradeGalleryDialog
          open={tradePreviewOpen}
          onClose={() => { setTradePreviewOpen(false); setPreviewTrade(null); }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={tradePreviewLoading}
          setZoomedImage={(url, allImages, initialIndex) => {
            setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
          }}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly
          tradeOperations={{
            onZoomImage: (url, allImages, initialIndex) => {
              setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
            },
            onUpdateTradeProperty: undefined,
            calendarId: undefined,
            onOpenGalleryMode: undefined,
            economicFilter: undefined,
            onOpenAIChat: undefined,
            isTradeUpdating: undefined,
            isReadOnly: true,
          }}
        />
      )}

      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}
    </Box>
  );
});

NoteEditorBody.displayName = 'NoteEditorBody';

export default NoteEditorBody;
