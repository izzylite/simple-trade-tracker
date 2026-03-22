# Shareable Note Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public note sharing via edge function and internal note-to-note linking via `/note` picker in the rich text editor.

**Architecture:** Extends the existing trade/calendar sharing pattern (share columns on the notes table, edge function for public access, ShareRepository + sharingService layer). Adds a new `NOTE_LINK` entity type to Draft.js alongside the existing `TRADE_TAG` entity, with a `/note` trigger and searchable dropdown. Navigation between linked notes uses an in-dialog back stack.

**Tech Stack:** React, TypeScript, Draft.js, Material-UI, Supabase (PostgreSQL + Edge Functions/Deno)

**Spec:** `docs/superpowers/specs/2026-03-22-shareable-note-links-design.md`

---

## File Structure

### Files to Create
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260322000000_add_sharing_to_notes.sql` | Add share columns to notes table |
| `supabase/functions/get-shared-note/index.ts` | Edge function for public note access |
| `src/components/common/RichTextEditor/utils/noteEntityUtils.ts` | `/note` trigger detection, entity insertion |
| `src/components/common/RichTextEditor/components/NoteLinkComponent.tsx` | Inline note link chip rendered by decorator |
| `src/components/notes/NoteShareButton.tsx` | Share/unshare button with copy-to-clipboard |
| `src/hooks/useNoteNavigation.ts` | Back-stack navigation for NoteEditorDialog |
| `src/pages/SharedNotePage.tsx` | Public shared note page |

### Files to Modify
| File | Changes |
|------|---------|
| `src/types/note.ts` | Add share fields to Note, CreateNoteInput, UpdateNoteInput |
| `src/services/repository/repositories/ShareRepository.ts` | Add note share/unshare/get methods |
| `src/services/sharingService.ts` | Add note sharing service functions + SharedNoteData type |
| `src/components/common/RichTextEditor/utils/decoratorUtils.ts` | Add NOTE_LINK decorator strategy |
| `src/components/common/RichTextEditor.tsx` | Add `/note` trigger handling alongside `@` mention |
| `src/components/notes/NoteEditorDialog.tsx` | Integrate NoteShareButton, useNoteNavigation, back button |
| `src/components/notes/NoteViewerDialog.tsx` | Handle NOTE_LINK clicks in read-only mode |
| `src/App.tsx` | Add `/shared-note/:shareId` route |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260322000000_add_sharing_to_notes.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add sharing columns to notes table
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_link TEXT,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

-- Index for public lookups by share_id
CREATE INDEX IF NOT EXISTS idx_notes_share_id ON notes (share_id) WHERE share_id IS NOT NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` to apply the migration.

- [ ] **Step 3: Verify columns exist**

Run: `mcp__supabase__execute_sql` with `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notes' AND column_name IN ('share_id', 'share_link', 'is_shared', 'shared_at');`

Expected: 4 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322000000_add_sharing_to_notes.sql
git commit -m "feat: add sharing columns to notes table"
```

---

## Task 2: Type Updates

**Files:**
- Modify: `src/types/note.ts`

- [ ] **Step 1: Add share fields to Note interface**

In `src/types/note.ts`, add these fields to the `Note` interface after `week_key`:

```typescript
  // Sharing
  share_id?: string | null;
  share_link?: string | null;
  is_shared?: boolean;
  shared_at?: Date | null;
```

- [ ] **Step 2: Add share fields to UpdateNoteInput**

In the `UpdateNoteInput` interface, add:

```typescript
  // Sharing
  share_id?: string | null;
  share_link?: string | null;
  is_shared?: boolean;
  shared_at?: Date | null;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/note.ts
git commit -m "feat: add sharing types to Note interfaces"
```

---

## Task 3: Edge Function — `get-shared-note`

**Files:**
- Create: `supabase/functions/get-shared-note/index.ts`

- [ ] **Step 1: Create edge function**

Follows the exact pattern from `supabase/functions/get-shared-trade/index.ts`:

```typescript
/**
 * Get Shared Note Edge Function
 * Queries notes table using share_id field, returns safe fields only
 */
import {
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log('Get shared note request received');

    const payload = await parseJsonBody<{ shareId: string }>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }

    const { shareId } = payload;
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400);
    }

    const supabase = createServiceClient();

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select(
        'title, content, cover_image, color, tags, created_at, shared_at'
      )
      .eq('share_id', shareId)
      .eq('is_shared', true)
      .single();

    if (noteError || !note) {
      return errorResponse('Shared note not found', 404);
    }

    log(`Shared note ${shareId} viewed`);

    return successResponse({
      title: note.title,
      content: note.content,
      cover_image: note.cover_image,
      color: note.color,
      tags: note.tags || [],
      created_at: note.created_at,
      shared_at: note.shared_at,
    });
  } catch (error) {
    log('Error getting shared note', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
```

- [ ] **Step 2: Deploy edge function**

Use `mcp__supabase__deploy_edge_function` with name `get-shared-note`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/get-shared-note/index.ts
git commit -m "feat: add get-shared-note edge function"
```

---

## Task 4: ShareRepository — Note Sharing Methods

**Files:**
- Modify: `src/services/repository/repositories/ShareRepository.ts`

- [ ] **Step 1: Add generateNoteShareLink method**

Add after the existing `generateCalendarShareLink` method. Pattern matches `generateTradeShareLink` but uses `notes.user_id` directly for ownership:

```typescript
async generateNoteShareLink(
  noteId: string,
  userId: string
): Promise<RepositoryResult<ShareLinkResult>> {
  try {
    logger.log(`Generating share link for note ${noteId}`);

    // Verify note ownership directly via user_id
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id, by_assistant')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      throw new Error('Note not found');
    }

    if (note.user_id !== userId) {
      throw new Error('Unauthorized access to note');
    }

    if (note.by_assistant) {
      throw new Error('AI-created notes cannot be shared');
    }

    const shareId = `note_share_${noteId}`;
    const shareLink = `${this.BASE_URL}/shared-note/${shareId}`;

    const { error: updateError } = await supabase
      .from('notes')
      .update({
        share_id: shareId,
        share_link: shareLink,
        is_shared: true,
        shared_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (updateError) {
      throw updateError;
    }

    logger.log(
      `Generated share link for note ${noteId}: ${shareLink}`
    );

    return {
      success: true,
      data: { shareLink, shareId, directLink: shareLink },
      timestamp: new Date(),
    };
  } catch (error: any) {
    const supabaseError = handleSupabaseError(
      error,
      `Generating share link for note ${noteId}`,
      'generateNoteShareLink'
    );
    logger.error(
      'Failed to generate note share link:',
      supabaseError
    );
    return {
      success: false,
      error: supabaseError,
      operation: 'generateNoteShareLink',
      timestamp: new Date(),
    };
  }
}
```

- [ ] **Step 2: Add deactivateNoteShareLink method**

Add after the existing `deactivateCalendarShareLink` method:

```typescript
async deactivateNoteShareLink(
  shareId: string,
  userId: string
): Promise<RepositoryResult<boolean>> {
  try {
    logger.log(`Deactivating note share link ${shareId}`);

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('share_id', shareId)
      .single();

    if (noteError || !note) {
      throw new Error('Shared note not found');
    }

    if (note.user_id !== userId) {
      throw new Error(
        'You do not have permission to modify this shared note'
      );
    }

    const { error: updateError } = await supabase
      .from('notes')
      .update({
        share_id: null,
        share_link: null,
        is_shared: false,
        shared_at: null,
      })
      .eq('share_id', shareId);

    if (updateError) {
      throw updateError;
    }

    logger.log(`Deactivated note share link ${shareId}`);

    return {
      success: true,
      data: true,
      timestamp: new Date(),
    };
  } catch (error: any) {
    const supabaseError = handleSupabaseError(
      error,
      `Deactivating note share link ${shareId}`,
      'deactivateNoteShareLink'
    );
    logger.error(
      'Failed to deactivate note share link:',
      supabaseError
    );
    return {
      success: false,
      error: supabaseError,
      operation: 'deactivateNoteShareLink',
      timestamp: new Date(),
    };
  }
}
```

- [ ] **Step 3: Add getSharedNote method**

Add after the existing `getSharedCalendar` method:

```typescript
async getSharedNote(
  shareId: string
): Promise<RepositoryResult<SharedNoteData | null>> {
  try {
    logger.log(`Fetching shared note ${shareId}`);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/get-shared-note`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          data: null,
          timestamp: new Date(),
        };
      }
      throw new Error(`Edge function error: ${response.status}`);
    }

    const result = await response.json();
    const data = result.data || result;

    return {
      success: true,
      data: {
        title: data.title,
        content: data.content,
        cover_image: data.cover_image,
        color: data.color,
        tags: data.tags || [],
        created_at: new Date(data.created_at),
        shared_at: new Date(data.shared_at),
      },
      timestamp: new Date(),
    };
  } catch (error: any) {
    const supabaseError = handleSupabaseError(
      error,
      `Fetching shared note ${shareId}`,
      'getSharedNote'
    );
    logger.error('Failed to get shared note:', supabaseError);
    return {
      success: false,
      error: supabaseError,
      operation: 'getSharedNote',
      timestamp: new Date(),
    };
  }
}
```

- [ ] **Step 4: Add SharedNoteData type**

Add the `SharedNoteData` interface alongside the existing `SharedTradeData` and `SharedCalendarData` types at the top of `ShareRepository.ts`:

```typescript
export interface SharedNoteData {
  title: string;
  content: string;
  cover_image: string | null;
  color: string | null;
  tags: string[];
  created_at: Date;
  shared_at: Date;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/services/repository/repositories/ShareRepository.ts
git commit -m "feat: add note sharing methods to ShareRepository"
```

---

## Task 5: Sharing Service — Note Functions

**Files:**
- Modify: `src/services/sharingService.ts`

- [ ] **Step 1: Add SharedNoteData to exports**

Update the existing type export line:
```typescript
export type { SharedTradeData, SharedCalendarData, ShareLinkResult, SharedNoteData };
```

Import `SharedNoteData` from the note types file.

- [ ] **Step 2: Add generateNoteShareLink function**

Add after `generateCalendarShareLink`:

```typescript
export const generateNoteShareLink = async (
  noteId: string
): Promise<ShareLinkResult> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.generateNoteShareLink(
      noteId,
      user.id
    );

    if (!result.success) {
      throw new Error(
        result.error?.message || 'Failed to generate share link'
      );
    }

    logger.log('Note share link generated successfully');
    return result.data!;
  } catch (error) {
    logger.error('Error generating note share link:', error);
    throw error;
  }
};
```

- [ ] **Step 3: Add deactivateNoteShareLink function**

Add after `deactivateCalendarShareLink`:

```typescript
export const deactivateNoteShareLink = async (
  shareId: string
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.deactivateNoteShareLink(
      shareId,
      user.id
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ||
          'Failed to deactivate note share'
      );
    }

    logger.log('Note share deactivated successfully');
  } catch (error) {
    logger.error('Error deactivating note share:', error);
    throw error;
  }
};
```

- [ ] **Step 4: Add getSharedNote function**

Add after `getSharedCalendar`:

```typescript
export const getSharedNote = async (
  shareId: string
): Promise<SharedNoteData | null> => {
  try {
    const result = await shareRepository.getSharedNote(shareId);

    if (!result.success) {
      throw new Error(
        result.error?.message || 'Failed to load shared note'
      );
    }

    return result.data || null;
  } catch (error) {
    logger.error('Error getting shared note:', error);
    throw error;
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add src/services/sharingService.ts
git commit -m "feat: add note sharing functions to sharingService"
```

---

## Task 6: NoteLinkComponent — Inline Chip

**Files:**
- Create: `src/components/common/RichTextEditor/components/NoteLinkComponent.tsx`

- [ ] **Step 1: Create the component**

Follows the pattern of `TagChipComponent.tsx` but styled as a clickable link. Receives `onNoteLinkClick` callback via the decorator (same pattern as how `LinkComponent` receives `calendarId`, `trades`, `onOpenGalleryMode`):

```tsx
import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentState } from 'draft-js';

interface NoteLinkProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
  onNoteLinkClick?: (
    noteId: string,
    noteTitle: string
  ) => void;
}

const NoteLinkComponent: React.FC<NoteLinkProps> = ({
  contentState,
  entityKey,
  children,
  onNoteLinkClick,
}) => {
  const theme = useTheme();
  const { noteId, noteTitle } = contentState
    .getEntity(entityKey)
    .getData();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNoteLinkClick?.(noteId, noteTitle);
  };

  return (
    <span
      contentEditable={false}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: alpha(
          theme.palette.primary.main,
          0.1
        ),
        color: theme.palette.primary.main,
        border: `1px solid ${alpha(
          theme.palette.primary.main,
          0.25
        )}`,
        borderRadius: 12,
        padding: '1px 8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.6,
        verticalAlign: 'baseline',
        userSelect: 'none',
        cursor: onNoteLinkClick ? 'pointer' : 'default',
        letterSpacing: '0.02em',
        textDecoration: 'none',
        opacity: onNoteLinkClick ? 1 : 0.6,
      }}
      title={
        onNoteLinkClick
          ? `Go to: ${noteTitle || 'Linked note'}`
          : noteTitle || 'Linked note'
      }
    >
      {children}
    </span>
  );
};

export default NoteLinkComponent;
```

Note: When `onNoteLinkClick` is not provided (read-only/shared contexts), the chip renders as non-interactive with muted opacity. This handles the "broken link" style from the spec.

- [ ] **Step 2: Commit**

```bash
git add src/components/common/RichTextEditor/components/NoteLinkComponent.tsx
git commit -m "feat: add NoteLinkComponent for inline note links"
```

---

## Task 7: Note Entity Utils — `/note` Trigger

**Files:**
- Create: `src/components/common/RichTextEditor/utils/noteEntityUtils.ts`

- [ ] **Step 1: Create the utility file**

Follows the pattern of `tagEntityUtils.ts` but with `/note ` trigger:

```typescript
import {
  EditorState,
  Modifier,
  ContentState,
  SelectionState,
} from 'draft-js';

/**
 * Find NOTE_LINK entities in a content block for the decorator
 */
export const findNoteLinkEntities = (
  contentBlock: any,
  callback: any,
  contentState: ContentState
) => {
  contentBlock.findEntityRanges(
    (character: any) => {
      const entityKey = character.getEntity();
      return (
        entityKey !== null &&
        contentState.getEntity(entityKey).getType() ===
          'NOTE_LINK'
      );
    },
    callback
  );
};

/**
 * Detect /note trigger from cursor position.
 * Returns search text after "/note " and trigger offset,
 * or null if no active trigger.
 *
 * Rules:
 * - "/note" must follow whitespace or be at start of block
 * - Activates after "/note " (with trailing space)
 */
export const getNoteTrigger = (
  editorState: EditorState
): {
  searchText: string;
  triggerOffset: number;
  blockKey: string;
} | null => {
  const selection = editorState.getSelection();
  if (!selection.isCollapsed()) return null;

  const contentState = editorState.getCurrentContent();
  const blockKey = selection.getStartKey();
  const block = contentState.getBlockForKey(blockKey);
  const text = block.getText();
  const cursorOffset = selection.getStartOffset();

  // Look for "/note " pattern before cursor
  const textBeforeCursor = text.slice(0, cursorOffset);
  const triggerPattern = /(?:^|\s)(\/note )/;
  const match = textBeforeCursor.match(triggerPattern);

  if (!match) return null;

  // Calculate the offset where "/note " starts
  const matchStart =
    match.index! + (match[0].startsWith('/') ? 0 : 1);
  const searchStart = matchStart + '/note '.length;
  const searchText = text.slice(searchStart, cursorOffset);

  return {
    searchText,
    triggerOffset: matchStart,
    blockKey,
  };
};

/**
 * Replace the "/note searchText" with a NOTE_LINK entity
 */
export const replaceNoteTriggerWithLink = (
  editorState: EditorState,
  noteId: string,
  noteTitle: string,
  triggerOffset: number,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const cursorOffset = selection.getStartOffset();

  // Select from trigger start to cursor
  const replaceSelection = SelectionState.createEmpty(
    blockKey
  ).merge({
    anchorOffset: triggerOffset,
    focusOffset: cursorOffset,
  }) as SelectionState;

  // Create NOTE_LINK entity
  const contentStateWithEntity = contentState.createEntity(
    'NOTE_LINK',
    'IMMUTABLE',
    { noteId, noteTitle }
  );
  const entityKey =
    contentStateWithEntity.getLastCreatedEntityKey();

  // Replace trigger text with note title chip
  const displayText = ` ${noteTitle} `;
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    replaceSelection,
    displayText,
    undefined,
    entityKey
  );

  // Add trailing space outside entity
  const afterTag = newContentState.getSelectionAfter();
  newContentState = Modifier.insertText(
    newContentState,
    afterTag,
    ' ',
    undefined,
    undefined
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );

  const afterSpace = newContentState.getSelectionAfter();
  return EditorState.forceSelection(
    newEditorState,
    afterSpace
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/RichTextEditor/utils/noteEntityUtils.ts
git commit -m "feat: add /note trigger detection and entity utils"
```

---

## Task 8: Decorator Updates — Add NOTE_LINK

**Files:**
- Modify: `src/components/common/RichTextEditor/utils/decoratorUtils.ts`

- [ ] **Step 1: Add NOTE_LINK decorator to createDecorator**

Add these imports to the top of `decoratorUtils.ts`:

```typescript
import NoteLinkComponent from '../components/NoteLinkComponent';
import { findNoteLinkEntities } from './noteEntityUtils';
```

Add an `onNoteLinkClick` parameter to the `createDecorator` function signature:

```typescript
export const createDecorator = (
  calendarId?: string,
  trades?: Array<{ id: string; [key: string]: any }>,
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void,
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void
) => {
```

Append a new entry to the `CompositeDecorator` array (after the TRADE_TAG entry):

```typescript
    {
      strategy: findNoteLinkEntities,
      component: (props: any) =>
        React.createElement(NoteLinkComponent, {
          ...props,
          onNoteLinkClick,
        }),
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/RichTextEditor/utils/decoratorUtils.ts
git commit -m "feat: add NOTE_LINK decorator to rich text editor"
```

---

## Task 9: RichTextEditor — `/note` Trigger Handling

**Files:**
- Modify: `src/components/common/RichTextEditor.tsx`

- [ ] **Step 1: Add imports**

Add to the imports section:

```typescript
import {
  getNoteTrigger,
  replaceNoteTriggerWithLink,
} from './utils/noteEntityUtils';
```

- [ ] **Step 2: Add new props to RichTextEditorProps**

Add these props to the `RichTextEditorProps` interface:

```typescript
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
```

- [ ] **Step 3: Add note trigger state**

Add state variables alongside the existing mention state (near `mentionActive`, `mentionSearch`, etc.):

```typescript
const [noteLinkActive, setNoteLinkActive] = useState(false);
const [noteLinkSearch, setNoteLinkSearch] = useState('');
const [noteLinkTriggerOffset, setNoteLinkTriggerOffset] =
  useState(0);
const [noteLinkBlockKey, setNoteLinkBlockKey] = useState('');
const [noteLinkSelectedIndex, setNoteLinkSelectedIndex] =
  useState(0);
```

- [ ] **Step 4: Update handleEditorChange**

In `handleEditorChange`, after the existing `@` mention trigger check block, add the `/note` trigger check. The two triggers are mutually exclusive — also add `&& !noteLinkActive` to the existing `@` mention guard condition so they can't both be active:

```typescript
// Check for /note trigger (mutually exclusive with @ mention)
if (!mentionActive && availableNotes) {
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
```

- [ ] **Step 5: Add handleNoteLinkSelect callback**

Add alongside `handleMentionSelect`:

```typescript
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
      const newRaw = convertToRaw(newState.getCurrentContent());
      onChange(JSON.stringify(newRaw));
    }

    setTimeout(() => editorRef.current?.focus(), 50);
  },
  [
    editorState,
    noteLinkTriggerOffset,
    noteLinkBlockKey,
    onChange,
  ]
);
```

- [ ] **Step 6: Expose note link state in handle ref**

Add to the `useImperativeHandle` block:

```typescript
noteLinkActive,
noteLinkFilteredNotes: availableNotes?.filter((n) =>
  n.title.toLowerCase().includes(noteLinkSearch.toLowerCase())
) || [],
noteLinkSelectedIndex,
handleNoteLinkSelect,
```

Also add these to the `RichTextEditorHandle` interface:

```typescript
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
```

- [ ] **Step 7: Add keyboard navigation for /note picker**

Add a `handleNoteLinkKeyDown` callback mirroring the existing `handleMentionKeyDown` pattern (see lines 402-432 of RichTextEditor.tsx):

```typescript
const handleNoteLinkKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    const filtered = availableNotes?.filter((n) =>
      n.title
        .toLowerCase()
        .includes(noteLinkSearch.toLowerCase())
    ) || [];
    if (!noteLinkActive || filtered.length === 0) return;

    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowDown'
    ) {
      e.preventDefault();
      setNoteLinkSelectedIndex(
        (prev) => (prev + 1) % filtered.length
      );
    } else if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowUp'
    ) {
      e.preventDefault();
      setNoteLinkSelectedIndex(
        (prev) =>
          (prev - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === 'Escape') {
      setNoteLinkActive(false);
      setNoteLinkSearch('');
      onNoteLinkStateChange?.(false);
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[noteLinkSelectedIndex];
      if (selected) {
        handleNoteLinkSelect(selected.id, selected.title);
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
```

Call `handleNoteLinkKeyDown` alongside `handleMentionKeyDown` in the editor's `onDownArrow`/`onUpArrow`/`keyBindingFn` handlers — wrap both behind their respective active flags.

- [ ] **Step 8: Pass onNoteLinkClick to decorator**

Update the `createDecorator` call (in the `useMemo` that creates the decorator) to pass `onNoteLinkClick`:

```typescript
const decorator = useMemo(
  () =>
    createDecorator(
      calendarId,
      trades,
      onOpenGalleryMode,
      onNoteLinkClick
    ),
  [calendarId, trades, onOpenGalleryMode, onNoteLinkClick]
);
```

- [ ] **Step 9: Commit**

```bash
git add src/components/common/RichTextEditor.tsx
git commit -m "feat: add /note trigger handling to RichTextEditor"
```

---

## Task 10: useNoteNavigation Hook

**Files:**
- Create: `src/hooks/useNoteNavigation.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback } from 'react';

interface NoteNavState {
  noteId: string;
  title: string;
}

interface UseNoteNavigationResult {
  /** The currently displayed note ID (null = original) */
  currentNoteId: string | null;
  /** Whether we're viewing a linked note (not the original) */
  isNavigated: boolean;
  /** Navigate to a linked note */
  navigateTo: (noteId: string, title: string) => void;
  /** Go back to previous note in stack */
  goBack: () => void;
  /** Reset navigation (when dialog closes) */
  reset: () => void;
  /** Current stack depth (for display) */
  stackDepth: number;
}

export const useNoteNavigation = (): UseNoteNavigationResult => {
  const [navStack, setNavStack] = useState<NoteNavState[]>([]);

  const currentNoteId =
    navStack.length > 0
      ? navStack[navStack.length - 1].noteId
      : null;

  const isNavigated = navStack.length > 0;

  const navigateTo = useCallback(
    (noteId: string, title: string) => {
      setNavStack((prev) => [...prev, { noteId, title }]);
    },
    []
  );

  const goBack = useCallback(() => {
    setNavStack((prev) => prev.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setNavStack([]);
  }, []);

  return {
    currentNoteId,
    isNavigated,
    navigateTo,
    goBack,
    reset,
    stackDepth: navStack.length,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNoteNavigation.ts
git commit -m "feat: add useNoteNavigation hook for back-stack"
```

---

## Task 11: NoteShareButton Component

**Files:**
- Create: `src/components/notes/NoteShareButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Note } from '../../types/note';
import {
  generateNoteShareLink,
  deactivateNoteShareLink,
} from '../../services/sharingService';

interface NoteShareButtonProps {
  note: Note;
  onNoteUpdate: (updates: Partial<Note>) => void;
  onSnackbar: (message: string) => void;
}

const NoteShareButton: React.FC<NoteShareButtonProps> = ({
  note,
  onNoteUpdate,
  onSnackbar,
}) => {
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(
    null
  );

  const isShared = note.is_shared && note.share_link;

  const handleShare = async () => {
    setLoading(true);
    try {
      const result = await generateNoteShareLink(note.id);
      await navigator.clipboard.writeText(result.shareLink);
      onNoteUpdate({
        share_id: result.shareId,
        share_link: result.shareLink,
        is_shared: true,
        shared_at: new Date(),
      });
      onSnackbar('Share link copied to clipboard');
    } catch (error) {
      onSnackbar('Failed to generate share link');
    } finally {
      setLoading(false);
      setAnchorEl(null);
    }
  };

  const handleCopyLink = async () => {
    if (note.share_link) {
      await navigator.clipboard.writeText(note.share_link);
      onSnackbar('Share link copied to clipboard');
    }
    setAnchorEl(null);
  };

  const handleDeactivate = async () => {
    if (!note.share_id) return;
    setLoading(true);
    try {
      await deactivateNoteShareLink(note.share_id);
      onNoteUpdate({
        share_id: null,
        share_link: null,
        is_shared: false,
        shared_at: null,
      });
      onSnackbar('Share link deactivated');
    } catch (error) {
      onSnackbar('Failed to deactivate share link');
    } finally {
      setLoading(false);
      setAnchorEl(null);
    }
  };

  if (loading) {
    return (
      <IconButton size="small" disabled>
        <CircularProgress size={18} />
      </IconButton>
    );
  }

  if (!isShared) {
    return (
      <Tooltip title="Share note">
        <IconButton size="small" onClick={handleShare}>
          <ShareIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title="Sharing active">
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeactivate}>
          <ListItemIcon>
            <LinkOffIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Stop sharing</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default NoteShareButton;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/NoteShareButton.tsx
git commit -m "feat: add NoteShareButton component"
```

---

## Task 12: NoteEditorDialog — Integration

**Files:**
- Modify: `src/components/notes/NoteEditorDialog.tsx`

- [ ] **Step 1: Add imports**

```typescript
import NoteShareButton from './NoteShareButton';
import { useNoteNavigation } from '../../hooks/useNoteNavigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import * as notesService from '../../services/notesService';
```

- [ ] **Step 2: Add useNoteNavigation hook**

Inside the component, add:

```typescript
const noteNav = useNoteNavigation();
```

- [ ] **Step 3: Reset navigation on dialog close**

In the `handleClose` function (or the effect that resets state when `open` changes), add:

```typescript
noteNav.reset();
```

- [ ] **Step 4: Load navigated note**

Add an effect to load the linked note when navigating:

```typescript
useEffect(() => {
  if (!noteNav.currentNoteId) return;

  const loadLinkedNote = async () => {
    try {
      const linkedNote = await notesService.getNote(
        noteNav.currentNoteId!
      );
      if (linkedNote) {
        setNote(linkedNote);
        setTitle(linkedNote.title);
        setContent(linkedNote.content);
        setCoverImage(linkedNote.cover_image);
        setNoteColor(linkedNote.color);
        setTags(linkedNote.tags || []);
        setReminderType(linkedNote.reminder_type || 'none');
        setReminderDate(linkedNote.reminder_date || null);
        setReminderDays(linkedNote.reminder_days || []);
        setIsReminderActive(
          linkedNote.is_reminder_active || false
        );
        setIsGlobal(linkedNote.calendar_id === null);
      } else {
        // Note not found — show toast and go back
        noteNav.goBack();
      }
    } catch {
      noteNav.goBack();
    }
  };

  loadLinkedNote();
}, [noteNav.currentNoteId]);
```

- [ ] **Step 5: Create onNoteLinkClick callback**

This callback is passed through the decorator via `createDecorator` (see Task 8). Define it in the component:

```typescript
const handleNoteLinkClick = useCallback(
  (noteId: string, noteTitle: string) => {
    saveNote();
    noteNav.navigateTo(noteId, noteTitle);
  },
  [noteNav.navigateTo]
);
```

Then pass it to the `RichTextEditor` via a new `onNoteLinkClick` prop (which gets forwarded to `createDecorator`).

- [ ] **Step 6: Add back button and share button to toolbar**

In the Toolbar section (around line 533), add a back button when navigated and the share button:

```tsx
<Toolbar
  sx={{
    borderBottom: `1px solid ${alpha(
      theme.palette.divider,
      0.1
    )}`,
    gap: 1,
  }}
>
  {noteNav.isNavigated && (
    <IconButton size="small" onClick={noteNav.goBack}>
      <ArrowBackIcon />
    </IconButton>
  )}

  <Typography variant="h6" sx={{ flex: 1 }}>
    {note ? 'Edit Note' : 'New Note'}
  </Typography>

  {/* Share button — only for saved, user-created notes */}
  {note && !note.by_assistant && (
    <NoteShareButton
      note={note}
      onNoteUpdate={(updates) =>
        setNote((prev) =>
          prev ? { ...prev, ...updates } : prev
        )
      }
      onSnackbar={(msg) => setShareSnackbar(msg)}
    />
  )}

  <IconButton size="small" onClick={handleClose}>
    <CloseIcon />
  </IconButton>
</Toolbar>
```

- [ ] **Step 7: Add /note dropdown UI**

After the existing `@` mention tag bar (around line 631), add the `/note` dropdown. This follows the same horizontal chip bar pattern:

```tsx
{/* /note Link Picker — sticky below toolbar */}
{editorMounted && editorRef.current?.noteLinkActive &&
  (editorRef.current.noteLinkFilteredNotes?.length ?? 0) > 0 && (
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
      overflowX: 'auto',
      overflowY: 'hidden',
      flexShrink: 0,
      borderBottom: `1px solid ${alpha(
        theme.palette.divider,
        0.15
      )}`,
      bgcolor: alpha(
        theme.palette.background.paper,
        0.6
      ),
      whiteSpace: 'nowrap',
      '&::-webkit-scrollbar': {
        height: 0,
        display: 'none',
      },
      scrollbarWidth: 'none',
    }}
  >
    {editorRef.current.noteLinkFilteredNotes.map(
      (n, idx) => {
        const isSelected =
          idx ===
          editorRef.current!.noteLinkSelectedIndex;
        return (
          <Chip
            key={n.id}
            label={n.title || 'Untitled'}
            size="small"
            onMouseDown={(e) => {
              e.preventDefault();
              editorRef.current?.handleNoteLinkSelect(
                n.id,
                n.title
              );
            }}
            sx={{
              cursor: 'pointer',
              flexShrink: 0,
              bgcolor: isSelected
                ? alpha(
                    theme.palette.primary.main,
                    0.2
                  )
                : alpha(
                    theme.palette.primary.main,
                    0.08
                  ),
              color: theme.palette.primary.main,
              fontWeight: 600,
              fontSize: '0.73rem',
              border: isSelected
                ? `1.5px solid ${alpha(
                    theme.palette.primary.main,
                    0.5
                  )}`
                : `1px solid ${alpha(
                    theme.palette.primary.main,
                    0.2
                  )}`,
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: alpha(
                  theme.palette.primary.main,
                  0.18
                ),
              },
            }}
          />
        );
      }
    )}
  </Box>
)}
```

- [ ] **Step 8: Pass availableNotes to RichTextEditor**

Find the `<RichTextEditor>` usage in NoteEditorDialog and add the new props. You'll need to fetch notes for the picker. Add a state and effect:

```typescript
const [availableNotes, setAvailableNotes] = useState<
  Array<{
    id: string;
    title: string;
    color?: string;
    calendar_name?: string;
  }>
>([]);

useEffect(() => {
  if (!open || !user?.uid) return;

  const loadNotes = async () => {
    try {
      const result = await notesService.getUserNotes(
        user.uid
      );
      setAvailableNotes(
        result
          .filter((n) => !n.is_archived && n.id !== note?.id)
          .map((n) => ({
            id: n.id,
            title: n.title,
            color: n.color ?? undefined,
          }))
      );
    } catch {
      setAvailableNotes([]);
    }
  };

  loadNotes();
}, [open, user?.uid, note?.id]);
```

Then pass to the editor:

Also add a `shareSnackbar` state and a `Snackbar` component at the bottom of the dialog for share feedback:

```typescript
const [shareSnackbar, setShareSnackbar] = useState<
  string | null
>(null);
```

```tsx
<Snackbar
  open={!!shareSnackbar}
  autoHideDuration={3000}
  onClose={() => setShareSnackbar(null)}
  message={shareSnackbar}
/>
```

Then pass props to the editor:

```tsx
<RichTextEditor
  // ... existing props
  availableNotes={availableNotes}
  onNoteLinkClick={handleNoteLinkClick}
  onNoteLinkStateChange={(active) => {
    /* force re-render if needed */
  }}
/>
```

- [ ] **Step 9: Commit**

```bash
git add src/components/notes/NoteEditorDialog.tsx
git commit -m "feat: integrate sharing and note linking into NoteEditorDialog"
```

---

## Task 13: SharedNotePage — Public View

**Files:**
- Create: `src/pages/SharedNotePage.tsx`

- [ ] **Step 1: Create the page component**

Follows the `SharedTradePage` pattern exactly:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Toolbar,
  Alert,
  Typography,
  Chip,
  Stack,
  Skeleton,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { alpha, createTheme } from '@mui/material/styles';
import { createAppTheme } from '../theme';
import { format } from 'date-fns';
import AppHeader from '../components/common/AppHeader';
import RichTextViewer from
  '../components/common/RichTextEditor/RichTextViewer';
import { getSharedNote } from '../services/sharingService';
import { SharedNoteData } from '../types/note';

const SharedNotePage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [note, setNote] = useState<SharedNoteData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(
    () => createTheme(createAppTheme(mode)),
    [mode]
  );

  useEffect(() => {
    if (!shareId) return;

    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await getSharedNote(shareId);
        if (data) {
          setNote(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [shareId]);

  const formattedDate = note?.shared_at
    ? format(new Date(note.shared_at), 'MMM d, yyyy')
    : '';

  if (!shareId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            backgroundColor: 'custom.pageBackground',
          }}
        >
          <AppHeader
            onToggleTheme={() =>
              setMode((p) =>
                p === 'light' ? 'dark' : 'light'
              )
            }
            mode={mode}
          />
          <Toolbar />
          <Container maxWidth="md" sx={{ pt: 4 }}>
            <Alert severity="error">
              Invalid share link
            </Alert>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'custom.pageBackground',
        }}
      >
        <AppHeader
          onToggleTheme={() =>
            setMode((p) =>
              p === 'light' ? 'dark' : 'light'
            )
          }
          mode={mode}
        />
        <Toolbar sx={{ pl: 0, pr: 0 }} />

        <Container
          maxWidth="md"
          sx={{
            pt: { xs: 2, sm: 4 },
            pb: { xs: 2, sm: 4 },
            px: { xs: 1, sm: 3 },
          }}
        >
          {loading && (
            <Box>
              <Skeleton
                variant="rectangular"
                height={200}
                sx={{ borderRadius: 2, mb: 3 }}
              />
              <Skeleton width="60%" height={40} />
              <Skeleton width="30%" height={20} />
              <Skeleton height={200} sx={{ mt: 3 }} />
            </Box>
          )}

          {error && (
            <Alert severity="error">
              Note not found or sharing has been disabled
            </Alert>
          )}

          {!loading && !error && note && (
            <Box>
              {/* Cover Image */}
              {note.cover_image && (
                <Box
                  sx={{
                    width: '100%',
                    height: 220,
                    backgroundImage: `url(${note.cover_image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 2,
                    mb: 3,
                  }}
                />
              )}

              {/* Tags */}
              {note.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  flexWrap="wrap"
                  sx={{ mb: 2 }}
                >
                  {note.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: alpha(
                          theme.palette.secondary.main,
                          0.1
                        ),
                        color: 'secondary.main',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  ))}
                </Stack>
              )}

              {/* Title */}
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  mb: 2,
                  wordBreak: 'break-word',
                }}
              >
                {note.title || 'Untitled'}
              </Typography>

              {/* Date */}
              {formattedDate && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 3, display: 'block' }}
                >
                  Shared {formattedDate}
                </Typography>
              )}

              {/* Content */}
              <Box sx={{ mt: 3 }}>
                {note.content ? (
                  <RichTextViewer content={note.content} />
                ) : (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    No content
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default SharedNotePage;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SharedNotePage.tsx
git commit -m "feat: add SharedNotePage for public note viewing"
```

---

## Task 14: Route Registration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add lazy import**

Add near the existing lazy imports (around lines 32-33):

```typescript
const SharedNotePage = lazy(
  () => import('./pages/SharedNotePage')
);
```

- [ ] **Step 2: Add route**

Add after the existing shared routes (around line 303):

```tsx
<Route
  path="/shared-note/:shareId"
  element={<SharedNotePage />}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /shared-note route"
```

---

## Task 15: NoteViewerDialog — Handle NOTE_LINK Clicks

**Files:**
- Modify: `src/components/notes/NoteViewerDialog.tsx`

- [ ] **Step 1: Handle NOTE_LINK clicks in read-only mode**

The NoteViewerDialog is read-only. Per the spec, if a linked note is shared, clicking opens it in a new tab. Otherwise, the link is non-interactive (handled by `NoteLinkComponent` rendering with no `onNoteLinkClick` — muted style).

Since `NoteViewerDialog` uses `RichTextViewer` which calls `createDecorator()` with no arguments, NOTE_LINK entities will render via `NoteLinkComponent` with `onNoteLinkClick` undefined — they'll show as muted, non-clickable chips. This satisfies the spec's "link displayed but not clickable" for the read-only viewer context.

No code changes needed in NoteViewerDialog itself — the `NoteLinkComponent`'s muted/disabled styling (opacity 0.6, cursor default) already handles this case when `onNoteLinkClick` is undefined.

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/NoteViewerDialog.tsx
git commit -m "feat: handle NOTE_LINK clicks in NoteViewerDialog"
```

---

## Task 16: Verification & Testing

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual testing checklist**

Run `npm start` and verify:

1. Open NoteEditorDialog → share button visible for user-created notes
2. Click share → link copied to clipboard, button shows active state
3. Open shared link in incognito → note content displays read-only
4. Click "Stop sharing" → shared link returns 404
5. Type `/note ` in editor → dropdown of notes appears
6. Select a note → NOTE_LINK chip inserted in editor
7. Click a NOTE_LINK chip → navigates to linked note in same dialog
8. Back button appears → click returns to previous note
9. AI-created notes → no share button visible

- [ ] **Step 3: Final commit (if any uncommitted changes remain)**

Only commit if there are unstaged changes from fixing build/test issues. Use `git add` with specific file paths — do not use `git add -A`.
