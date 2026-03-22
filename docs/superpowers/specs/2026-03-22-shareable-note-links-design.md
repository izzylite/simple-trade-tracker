# Shareable Note Links — Design Spec

## Overview

Add two capabilities to the notes system:
1. **Public sharing** — generate a shareable link for any user-created note so anyone (even non-logged-in users) can view it read-only
2. **Internal note linking** — embed links to other notes within the rich text editor using a `/note` picker, with in-dialog navigation

## Constraints

- AI-created notes (`by_assistant = true`) cannot be shared publicly
- Any user-created note (global or calendar-specific) can be shared
- Follows the existing trade/calendar sharing architecture (edge function for public access)
- Note picker uses `/note` trigger in the Draft.js editor
- Internal note links navigate within the same NoteEditorDialog (replace, with back stack)
- The `share_id` format (`note_share_{noteId}`) is predictable by design, consistent with the existing trade/calendar sharing pattern. The edge function only serves notes where `is_shared = true`, so knowing the ID alone does not grant access.

---

## 1. Database Changes

### Migration: Add sharing columns to `notes` table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `share_id` | TEXT, nullable, unique | NULL | Generated as `note_share_{noteId}` |
| `share_link` | TEXT, nullable | NULL | Full public URL |
| `is_shared` | BOOLEAN | false | Whether note is currently shared |
| `shared_at` | TIMESTAMPTZ, nullable | NULL | When sharing was activated |

**Index:** `idx_notes_share_id` on `share_id` for public lookups.

RLS policies remain unchanged — the edge function uses the service role key to bypass RLS for public access.

---

## 2. Edge Function: `get-shared-note`

**Location:** `supabase/functions/get-shared-note/`

**Behavior:**
1. Accepts `shareId` as a URL parameter
2. Uses service role key to bypass RLS
3. Queries `notes` where `share_id = shareId` AND `is_shared = true`
4. Returns only safe fields: `title`, `content`, `cover_image`, `color`, `tags`, `created_at`, `shared_at`
5. Strips sensitive fields: `user_id`, `calendar_id`, reminder fields, `by_assistant`
6. Returns 404 if note not found or not shared

**Live content:** The shared view always reflects the current state of the note. There is no snapshot mechanism — edits are immediately visible to anyone with the link.

**No view count tracking** — can be added later if needed.

---

## 3. Public Shared Note Page

**Route:** `/shared-note/:shareId`
**Component:** `SharedNotePage`

**Behavior:**
1. Fetches note data via `sharingService.getSharedNote(shareId)`
2. Renders read-only view: title, cover image (if present), rich text content (Draft.js read-only mode), color accent, tags as chips
3. Loading state: shimmer skeleton (consistent with existing shared pages)
4. Error state: "Note not found" for invalid or deactivated links
5. Visual style follows existing `SharedTradePage` patterns

**Draft.js rendering:** `SharedNotePage` must initialize a Draft.js editor in read-only mode with the full decorator configuration (links, tags, and NOTE_LINK entities). The NOTE_LINK decorator in this context checks share status to determine clickability.

**Note link behavior in shared view:** If a `NOTE_LINK` entity points to another shared note, clicking opens it in a new tab at its shared URL. If the linked note is not shared, the link is displayed but not clickable.

---

## 4. Share/Unshare UI in NoteEditorDialog

**Location:** Toolbar/actions area of `NoteEditorDialog`

**Share button:**
- Only visible for user-created notes (`by_assistant !== true`)
- Click generates share link via `sharingService.generateNoteShareLink(noteId)`
- Copies link to clipboard with snackbar confirmation

**Active share state:**
- Button changes to indicate link is active
- Options to copy link again or deactivate sharing
- Deactivating clears share fields and invalidates the public link

Follows the same UX pattern as existing trade sharing.

---

## 5. Note Picker (`/note` trigger) in Rich Text Editor

### Trigger
User types `/note` in the editor to activate a searchable dropdown.

**Trigger rules:**
- `/note` must follow whitespace or be at the start of a block (prevents false triggers in words like "take/note")
- The dropdown activates after `/note ` (with trailing space) — subsequent characters are the search query
- Pressing Escape or deleting back past the `/` dismisses the dropdown
- `/note` and `@` triggers are mutually exclusive — only one dropdown can be active at a time

### Dropdown
- Shows user's non-archived notes filtered by search text typed after `/note `
- Each item displays: note title, color indicator, calendar name
- Sorted by most recently updated
- Shows a loading indicator while fetching notes
- Shows "No notes found" if the fetch returns empty or fails

### Selection
- Inserts a `NOTE_LINK` entity into Draft.js editor content
- Rendered inline as a styled chip/link showing the note title
- Entity data stores: `noteId` (for resolution) and `noteTitle` (display fallback)

### Pasted Links
- Pasting a `/shared-note/{shareId}` URL is treated as a regular Draft.js link (no special entity conversion needed)

### Implementation Approach
- New Draft.js entity type: `NOTE_LINK`
- New decorator in `decoratorUtils.ts` for rendering `NOTE_LINK` entities
- New utility file `noteEntityUtils.ts` for `/note` trigger detection, dropdown state, and entity insertion
- Trigger detection scans backward from cursor for the literal string `/note `, then captures subsequent characters as the search query (similar to `getAtMentionTrigger` but matching a longer prefix)
- Extends `RichTextEditor` props with note-fetching callback

---

## 6. Note Link Navigation

### In NoteEditorDialog (owned notes)
- Clicking a `NOTE_LINK` opens the linked note in the same dialog, replacing current content
- A **back button** appears to return to the previous note
- Navigation history maintained as a stack: A -> B -> C -> back to B -> back to A
- State managed via a `useNoteNavigation` hook (keeps NoteEditorDialog under 500 lines)

### Broken links
- If the linked note doesn't exist or is inaccessible: show a toast "Note not found"
- The link stays but renders in a muted/broken style

### In read-only contexts (SharedNotePage, NoteViewerDialog)
- If linked note is also shared: click opens its shared URL in a new tab
- If linked note is not shared: link displayed but not clickable

---

## 7. Service Layer Changes

### sharingService.ts — New functions
- `generateNoteShareLink(noteId: string): Promise<ShareLinkResult>`
- `deactivateNoteShareLink(shareId: string): Promise<void>` — resolves `userId` from auth session before calling repository (consistent with existing `deactivateTradeShareLink` pattern)
- `getSharedNote(shareId: string): Promise<SharedNoteData>`

### ShareRepository.ts — New methods
- `generateNoteShareLink(noteId, userId)` — verifies ownership via `notes.user_id = userId` (notes have a direct `user_id` field, unlike trades which require a calendar join), sets share fields, generates URL `/shared-note/note_share_{noteId}`
- `deactivateNoteShareLink(shareId, userId)` — verifies ownership via `notes.user_id`, clears share fields
- `getSharedNote(shareId)` — calls `get-shared-note` edge function

### Type updates

**Note interface** — add:
```typescript
share_id?: string | null
share_link?: string | null
is_shared?: boolean
shared_at?: Date | null
```

**New type:**
```typescript
interface SharedNoteData {
  title: string
  content: string
  cover_image: string | null
  color: string | null
  tags: string[]
  created_at: Date
  shared_at: Date
}
```

**ShareLinkResult** — already exists, reused for notes.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/XXX_add_sharing_to_notes.sql` | Database migration |
| `supabase/functions/get-shared-note/index.ts` | Edge function |
| `src/pages/SharedNotePage.tsx` | Public shared note route |
| `src/components/common/RichTextEditor/noteEntityUtils.ts` | `/note` trigger and entity logic |
| `src/hooks/useNoteNavigation.ts` | Back-stack navigation for NoteEditorDialog |
| `src/components/notes/NoteShareButton.tsx` | Share/unshare button component |

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/note.ts` | Add share fields to interfaces |
| `src/services/sharingService.ts` | Add note sharing functions |
| `src/services/repository/repositories/ShareRepository.ts` | Add note sharing methods |
| `src/components/notes/NoteEditorDialog.tsx` | Integrate NoteShareButton, useNoteNavigation hook, back button |
| `src/components/common/RichTextEditor.tsx` | `/note` trigger, NOTE_LINK entity rendering |
| `src/components/common/RichTextEditor/decoratorUtils.ts` | NOTE_LINK decorator |
| `src/components/notes/NoteViewerDialog.tsx` | Handle NOTE_LINK clicks in read-only mode |
| Router config (where `SharedTradePage`/`SharedCalendarPage` routes are registered) | Add `/shared-note/:shareId` as a public (no auth required) route |
