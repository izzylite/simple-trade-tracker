/**
 * manage_note — CRUD on user trading-calendar notes. Actions:
 *   - "search"  — filter by tags / search_query / archived flag
 *   - "create"  — title + content (+ optional tags + reminder)
 *   - "update"  — full or incremental edit, AI-created + SLASH_COMMAND scope
 *   - "delete"  — same scope as update
 *
 * AGENT_MEMORY notes are intentionally NOT writable here — use update_memory.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../../_shared/supabase.ts";
import {
  AGENT_MEMORY_TAG,
  SLASH_COMMAND_TAG,
} from "../../_shared/noteTags.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

export const manageNoteTool: GeminiFunctionDeclaration = {
  name: "manage_note",
  description:
    `CRUD on user's trading-calendar notes. action="search" (search_query and/or tags; at session start search tags:["${AGENT_MEMORY_TAG}"] to load memory), "create" (title + content plain-text; optional tags + reminder), "update" (note_id; incremental via content_mode or full via content; AI-created notes + ${SLASH_COMMAND_TAG} notes only), "delete" (note_id; same scope as update). ⚠️ ${AGENT_MEMORY_TAG} notes are NOT writeable here — use update_memory. See TIER 4 SCHEMA_REFERENCE for the available tag list.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "create", "update", "delete"],
        description: "Which note operation to perform.",
      },
      note_id: {
        type: "string",
        description: "Target note id (update/delete).",
      },
      title: {
        type: "string",
        description: "Note title (create; optional on update).",
      },
      content: {
        type: "string",
        description:
          "Plain-text note body, no HTML. On create: required. On update: FULL replacement (destructive) — prefer content_mode for partial edits.",
      },
      content_mode: {
        type: "string",
        enum: ["append", "replace", "remove"],
        description:
          "Incremental update mode. Mutually exclusive with `content`. Not allowed on rich-text (Draft.js) notes.",
      },
      content_text: {
        type: "string",
        description: "New text for content_mode append/replace.",
      },
      content_old_text: {
        type: "string",
        description:
          "Exact unique substring to find, for content_mode replace/remove.",
      },
      replace_full_content: {
        type: "boolean",
        description:
          "Confirmation flag required to overwrite a SLASH_COMMAND note via `content`.",
      },
      search_query: {
        type: "string",
        description: "Text filter for action=search.",
      },
      include_archived: {
        type: "boolean",
        description: "Include archived notes in search (default false).",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Tags to filter by (search) or set (create/update). Notes must have ALL given tags when searching.",
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description:
          '"none" / "once" (uses reminder_date) / "weekly" (uses reminder_days). Use "none" on update to clear.',
      },
      reminder_date: {
        type: "string",
        description: 'ISO date (YYYY-MM-DD) for reminder_type="once".',
      },
      reminder_days: {
        type: "array",
        items: {
          type: "string",
          enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        description:
          'Day abbreviations for reminder_type="weekly", e.g. ["Mon","Wed","Fri"].',
      },
    },
    required: ["action"],
  },
};

const ASSISTANT_COLORS = [
  "red", "pink", "purple", "deepPurple", "indigo", "blue", "lightBlue",
  "cyan", "teal", "green", "lightGreen", "lime", "yellow", "amber",
  "orange", "deepOrange", "brown", "grey", "blueGrey",
];

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function extractImagesFromContent(content: string): string[] {
  try {
    const rawContent = JSON.parse(content);
    const images: string[] = [];
    if (rawContent.entityMap) {
      for (const key in rawContent.entityMap) {
        const entity = rawContent.entityMap[key];
        if (entity.type === "IMAGE" && entity.data?.src) {
          const src = entity.data.src;
          const isStockImage = src.includes("unsplash.com") ||
            src.includes("pexels.com") ||
            src.includes("pixabay.com") ||
            src.includes("stock") ||
            src.includes("placeholder");
          if (!isStockImage) images.push(src);
        }
      }
    }
    return images;
  } catch {
    return [];
  }
}

async function createNote(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  title: string,
  content: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[],
  color?: string,
): Promise<string> {
  try {
    log(`Creating note: ${title}`, "info");

    // Block AGENT_MEMORY here — update_memory is the right path (it auto-creates
    // the memory note if needed and merges properly).
    if (tags && tags.includes(AGENT_MEMORY_TAG)) {
      return `Cannot create ${AGENT_MEMORY_TAG} notes with create_note. Use the update_memory tool instead - it automatically creates the memory note if needed and properly merges new insights with existing memory.`;
    }

    // SlashCommand notes are user automations — they appear in the chat's "/"
    // popup. The calendar.notes JSONB trigger excludes by_assistant=true notes
    // from the mirror, so we flip the flag for these even though Orion creates
    // them — they belong to the user.
    const isSlashCommand = !!tags && tags.includes(SLASH_COMMAND_TAG);

    const noteData: Record<string, unknown> = {
      user_id: userId,
      calendar_id: calendarId,
      title,
      content,
      by_assistant: !isSlashCommand,
      is_archived: false,
      is_pinned: false,
      cover_image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: tags || [],
      color: color ||
        ASSISTANT_COLORS[Math.floor(Math.random() * ASSISTANT_COLORS.length)],
    };

    if (reminderType && reminderType !== "none") {
      noteData.reminder_type = reminderType;
      noteData.is_reminder_active = true;
      if (reminderType === "once" && reminderDate) {
        noteData.reminder_date = reminderDate;
      } else if (
        reminderType === "weekly" && reminderDays && reminderDays.length > 0
      ) {
        noteData.reminder_days = reminderDays;
      }
    } else {
      noteData.reminder_type = "none";
      noteData.is_reminder_active = false;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert(noteData)
      .select()
      .single();

    if (error) {
      log(`Error creating note: ${error.message}`, "error");
      return `Failed to create note: ${error.message}`;
    }

    log(`Note created successfully: ${data.id}`, "info");
    return `Note "${title}" created successfully! [NOTE_CREATED:${data.id}]`;
  } catch (error) {
    return `Note creation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

async function updateNote(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
  title?: string,
  content?: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[],
  contentMode?: "append" | "replace" | "remove",
  contentText?: string,
  contentOldText?: string,
  replaceFullContent?: boolean,
): Promise<string> {
  try {
    log(`Updating note: ${noteId}`, "info");

    // Scope by user_id so service-role queries can't be tricked into
    // touching another user's note via a leaked id.
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title, tags, content")
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (fetchError) return `Failed to find note: ${fetchError.message}`;
    if (!existingNote) return `Note not found with ID: ${noteId}`;

    const noteTags = existingNote.tags || [];
    if (noteTags.includes(AGENT_MEMORY_TAG)) {
      return `Cannot update ${AGENT_MEMORY_TAG} notes with update_note. Use the update_memory tool instead - it properly merges new insights with existing memory without losing information.`;
    }

    // SlashCommand notes are user automations (by_assistant=false so they
    // appear in the "/" popup) but Orion may update them on user request.
    const isSlashCommand = noteTags.includes(SLASH_COMMAND_TAG);

    if (!existingNote.by_assistant && !isSlashCommand) {
      return `Permission denied: You can only update AI-created notes. This note was created by the user.`;
    }

    // Mutually exclusive: full content overwrite vs incremental content_mode.
    const hasMode = contentMode !== undefined;
    const hasFullContent = content !== undefined;
    let newContent: string | undefined;

    if (hasMode && hasFullContent) {
      return `Cannot use both 'content' (full overwrite) and 'content_mode' (incremental edit) in the same call. Choose one.`;
    }

    if (hasMode) {
      const current = existingNote.content || "";

      // Incremental text ops are unsafe on rich-text JSON blobs (could produce
      // invalid Draft.js). Force full overwrite for those.
      let isDraftJs = false;
      try {
        const parsed = JSON.parse(current);
        if (parsed && (Array.isArray(parsed.blocks) || parsed.entityMap)) {
          isDraftJs = true;
        }
      } catch { /* not JSON — plain text, fine */ }

      if (isDraftJs) {
        return `Cannot use content_mode on this note: it is stored in rich-text (Draft.js) format. Use the 'content' param to fully replace it instead.`;
      }

      if (contentMode === "append") {
        if (contentText === undefined || contentText === "") {
          return `content_mode='append' requires non-empty content_text.`;
        }
        newContent = current ? `${current}\n${contentText}` : contentText;
      } else if (contentMode === "replace") {
        if (!contentOldText) {
          return `content_mode='replace' requires content_old_text.`;
        }
        if (contentText === undefined) {
          return `content_mode='replace' requires content_text.`;
        }
        const matches = countOccurrences(current, contentOldText);
        if (matches === 0) {
          return `content_old_text not found in note "${existingNote.title}". Re-read the note and provide an exact substring (whitespace-sensitive). Current content:\n---\n${current}\n---`;
        }
        if (matches > 1) {
          return `content_old_text appears ${matches} times in note "${existingNote.title}" — must be unique. Add more surrounding context to the substring. Current content:\n---\n${current}\n---`;
        }
        newContent = current.replace(contentOldText, contentText);
      } else if (contentMode === "remove") {
        if (!contentOldText) {
          return `content_mode='remove' requires content_old_text.`;
        }
        const matches = countOccurrences(current, contentOldText);
        if (matches === 0) {
          return `content_old_text not found in note "${existingNote.title}". Current content:\n---\n${current}\n---`;
        }
        if (matches > 1) {
          return `content_old_text appears ${matches} times in note "${existingNote.title}" — must be unique. Current content:\n---\n${current}\n---`;
        }
        newContent = current.replace(contentOldText, "");
      } else {
        return `Unknown content_mode "${contentMode}". Use "append", "replace", or "remove".`;
      }
    } else if (hasFullContent) {
      // SLASH_COMMAND notes are user automations. Refuse full overwrites
      // unless explicitly confirmed — prevents the silent rewrite bug where
      // "also add X" caused the entire command to be regenerated.
      if (isSlashCommand && !replaceFullContent) {
        return `Refusing to overwrite ${SLASH_COMMAND_TAG} note "${existingNote.title}" with full 'content' — this would wipe existing logic. Either: (A) use content_mode='append'/'replace'/'remove' for incremental edits, or (B) if the user explicitly asked to rewrite from scratch, set replace_full_content=true. Current content:\n---\n${existingNote.content || ""}\n---`;
      }
      newContent = content;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updateData.title = title;
    if (newContent !== undefined) updateData.content = newContent;
    if (tags !== undefined) updateData.tags = tags;

    if (reminderType !== undefined) {
      updateData.reminder_type = reminderType;
      if (reminderType === "none") {
        updateData.is_reminder_active = false;
        updateData.reminder_date = null;
        updateData.reminder_days = [];
      } else {
        updateData.is_reminder_active = true;
        if (reminderType === "once" && reminderDate) {
          updateData.reminder_date = reminderDate;
          updateData.reminder_days = [];
        } else if (
          reminderType === "weekly" && reminderDays && reminderDays.length > 0
        ) {
          updateData.reminder_days = reminderDays;
          updateData.reminder_date = null;
        }
      }
    }

    // by_assistant=true safety filter applies only to non-SlashCommand notes.
    // user_id is always enforced.
    let updateQuery = supabase
      .from("notes")
      .update(updateData)
      .eq("id", noteId)
      .eq("user_id", userId);
    if (!isSlashCommand) updateQuery = updateQuery.eq("by_assistant", true);
    const { error: updateError } = await updateQuery;

    if (updateError) {
      log(`Error updating note: ${updateError.message}`, "error");
      return `Failed to update note: ${updateError.message}`;
    }

    log(`Note updated successfully: ${noteId}`, "info");
    return `Note "${existingNote.title}" updated successfully!`;
  } catch (error) {
    return `Note update error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

async function deleteNote(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
): Promise<string> {
  try {
    log(`Deleting note: ${noteId}`, "info");

    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title, tags")
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (fetchError) return `Failed to find note: ${fetchError.message}`;
    if (!existingNote) return `Note not found with ID: ${noteId}`;

    // SlashCommand notes deletable by Orion symmetric with create + update.
    const isSlashCommand = (existingNote.tags || []).includes(SLASH_COMMAND_TAG);

    if (!existingNote.by_assistant && !isSlashCommand) {
      return `Permission denied: You can only delete AI-created notes. This note was created by the user.`;
    }

    let deleteQuery = supabase
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);
    if (!isSlashCommand) deleteQuery = deleteQuery.eq("by_assistant", true);
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      log(`Error deleting note: ${deleteError.message}`, "error");
      return `Failed to delete note: ${deleteError.message}`;
    }

    log(`Note deleted successfully: ${noteId}`, "info");
    return `Note "${existingNote.title}" deleted successfully!`;
  } catch (error) {
    return `Note deletion error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

async function searchNotes(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  searchQuery?: string,
  includeArchived: boolean = false,
  tags?: string[],
): Promise<string> {
  try {
    log(
      `Searching ${
        tags?.length ? `tags: ${tags.join(", ")}` : "all"
      } notes for user ${userId} in calendar ${calendarId}`,
      "info",
    );

    // Include both calendar-specific and global notes (calendar_id=null).
    // Single .or() for the calendar filter to avoid conflicts with later filters.
    let query = supabase
      .from("notes")
      .select(
        "id, title, content, by_assistant, is_pinned, is_archived, created_at, updated_at, reminder_type, reminder_date, reminder_days, tags",
      )
      .eq("user_id", userId)
      .or(`calendar_id.eq.${calendarId},calendar_id.is.null`);

    if (!includeArchived) query = query.eq("is_archived", false);

    if (tags && tags.length > 0) {
      // Match notes containing ALL specified tags.
      for (const tag of tags) query = query.contains("tags", [tag]);
    }

    query = query.order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    const { data: rawNotes, error } = await query;

    if (error) {
      log(`Error searching notes: ${error.message}`, "error");
      return `Failed to search notes: ${error.message}`;
    }

    // Search-query filter in-memory to avoid PostgREST multi-or() conflicts.
    let notes = rawNotes || [];
    if (searchQuery && searchQuery.trim() && notes.length > 0) {
      const searchLower = searchQuery.toLowerCase().trim();
      notes = notes.filter((note) => {
        if (note.title?.toLowerCase().includes(searchLower)) return true;
        if (note.content) {
          const contentLower = note.content.toLowerCase();
          if (contentLower.includes(searchLower)) return true;
          // Try to extract plain text from Draft.js JSON for matching.
          try {
            const parsed = JSON.parse(note.content);
            if (parsed.blocks) {
              const plainText = parsed.blocks
                .map((b: { text?: string }) => b.text || "")
                .join(" ")
                .toLowerCase();
              if (plainText.includes(searchLower)) return true;
            }
          } catch { /* plain text already searched */ }
        }
        return false;
      });
      log(
        `After search filter: ${notes.length} notes match "${searchQuery}"`,
        "info",
      );
    }

    if (!notes || notes.length === 0) {
      return searchQuery
        ? `No notes found matching "${searchQuery}".`
        : tags && tags.length > 0
        ? `No notes found with tags: ${tags.join(", ")}.`
        : "No notes found in this calendar.";
    }

    log(`Found ${notes.length} notes`, "info");

    let result = `Found ${notes.length} note${
      notes.length === 1 ? "" : "s"
    }:\n\n`;

    for (const note of notes) {
      result += `<note-ref id="${note.id}"/>`;
      result += `\n**${note.title || "Untitled Note"}**`;

      if (note.content) {
        let plainContent = "";
        try {
          const parsed = JSON.parse(note.content);
          if (parsed.blocks && Array.isArray(parsed.blocks)) {
            plainContent = parsed.blocks
              .map((block: { text?: string }) => block.text || "")
              .join("\n")
              .trim();
          }
        } catch {
          plainContent = note.content.trim();
        }
        if (plainContent) result += `\n${plainContent}`;
      }

      const contentImages = extractImagesFromContent(note.content);
      if (contentImages.length > 0) {
        result += `\n[Embedded images: ${contentImages.join(", ")}]`;
        result +=
          `\n[Tip: Use analyze_image tool with analysis_focus="general" for note images, or "overview"/"patterns"/"levels" if it's a chart]`;
      }

      if (note.tags && note.tags.length > 0) {
        result += `\n[Tags: ${note.tags.join(", ")}]`;
      }

      result += "\n\n";
    }

    return result;
  } catch (error) {
    return `Note search error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeManageNote(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for note operations";
  const userId = context.userId || "";
  const calendarId = context.calendarId || "";
  const action = typeof args.action === "string" ? args.action : "";

  if (action === "search") {
    const searchQuery = typeof args.search_query === "string"
      ? args.search_query
      : undefined;
    const includeArchived = typeof args.include_archived === "boolean"
      ? args.include_archived
      : false;
    const tags = Array.isArray(args.tags) ? args.tags as string[] : undefined;
    return await searchNotes(
      supabase,
      userId,
      calendarId,
      searchQuery,
      includeArchived,
      tags,
    );
  }

  if (action === "create") {
    const title = typeof args.title === "string" ? args.title : "";
    const content = typeof args.content === "string" ? args.content : "";
    const reminderType = typeof args.reminder_type === "string"
      ? args.reminder_type
      : undefined;
    const reminderDate = typeof args.reminder_date === "string"
      ? args.reminder_date
      : undefined;
    const reminderDays = Array.isArray(args.reminder_days)
      ? args.reminder_days as string[]
      : undefined;
    const tags = Array.isArray(args.tags) ? args.tags as string[] : undefined;
    return await createNote(
      supabase,
      userId,
      calendarId,
      title,
      content,
      reminderType,
      reminderDate,
      reminderDays,
      tags,
    );
  }

  if (action === "update") {
    if (!userId) return "User context required for note update";
    const noteId = typeof args.note_id === "string" ? args.note_id : "";
    const title = typeof args.title === "string" ? args.title : undefined;
    const content = typeof args.content === "string" ? args.content : undefined;
    const reminderType = typeof args.reminder_type === "string"
      ? args.reminder_type
      : undefined;
    const reminderDate = typeof args.reminder_date === "string"
      ? args.reminder_date
      : undefined;
    const reminderDays = Array.isArray(args.reminder_days)
      ? args.reminder_days as string[]
      : undefined;
    const tags = Array.isArray(args.tags) ? args.tags as string[] : undefined;
    const contentMode = args.content_mode === "append" ||
        args.content_mode === "replace" ||
        args.content_mode === "remove"
      ? args.content_mode
      : undefined;
    const contentText = typeof args.content_text === "string"
      ? args.content_text
      : undefined;
    const contentOldText = typeof args.content_old_text === "string"
      ? args.content_old_text
      : undefined;
    const replaceFullContent = typeof args.replace_full_content === "boolean"
      ? args.replace_full_content
      : undefined;
    return await updateNote(
      supabase,
      userId,
      noteId,
      title,
      content,
      reminderType,
      reminderDate,
      reminderDays,
      tags,
      contentMode,
      contentText,
      contentOldText,
      replaceFullContent,
    );
  }

  if (action === "delete") {
    if (!userId) return "User context required for note deletion";
    const noteId = typeof args.note_id === "string" ? args.note_id : "";
    return await deleteNote(supabase, userId, noteId);
  }

  return JSON.stringify({
    success: false,
    error: `manage_note: unknown action "${action}". Use search|create|update|delete.`,
  });
}
