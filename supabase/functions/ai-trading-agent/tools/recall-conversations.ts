/**
 * recall_conversations — keyword search past chats + fetch full transcripts.
 * Actions: "search" (returns metadata) | "get" (returns transcript).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../../_shared/supabase.ts";
import { AGENT_MEMORY_TAG } from "../../_shared/noteTags.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

export const recallConversationsTool: GeminiFunctionDeclaration = {
  name: "recall_conversations",
  description:
    `Search past chat conversations with this user, or fetch one's full transcript. Pick ONE \`action\`:

- action="search" — keyword search over conversation titles + message content. Needs \`query\`. Optional \`since_days\` (default 30), \`limit\` (default 5, max 10). Returns lightweight metadata: [{ id, title, message_count, created_at, updated_at, snippet }] — NOT full bodies.
- action="get" — fetch the full transcript of one conversation. Needs \`conversation_id\` (from a prior search — do NOT guess ids). Capped at 50 messages; formatted as "user:" / "orion:" turns with timestamps.

ONLY use when the user explicitly references a past chat ("last time", "yesterday we discussed", "you told me before", "show me what we said about X"). For structured "what happened / when did" questions, prefer manage_event(action="recall") — faster and more precise. ${AGENT_MEMORY_TAG} notes (manage_note search) remain the primary long-term memory.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "get"],
        description: "Search conversations or fetch one transcript.",
      },
      query: {
        type: "string",
        description:
          "Search term against titles + message content (action=search).",
      },
      since_days: {
        type: "number",
        description:
          "Only conversations updated in the last N days (action=search, default 30).",
      },
      limit: {
        type: "number",
        description:
          "Max conversations to return (action=search, default 5, max 10).",
      },
      conversation_id: {
        type: "string",
        description: "Conversation id from a search result (action=get).",
      },
    },
    required: ["action"],
  },
};

interface ConversationMessage {
  role?: string;
  content?: string;
  timestamp?: string;
}

async function searchConversations(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  sinceDays: number = 30,
  limit: number = 5,
): Promise<string> {
  try {
    const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
    const sinceIso = new Date(Date.now() - sinceDays * 86400 * 1000)
      .toISOString();
    const q = (query || "").trim();
    if (!q) return "Query is required for search_conversations.";

    // Fetch-then-filter: messages is JSONB, PostgREST can't full-text-search it
    // from the client lib. Per-window count is small, so this is cheap.
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, message_count, created_at, updated_at, messages")
      .eq("user_id", userId)
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      log(`Error searching conversations: ${error.message}`, "error");
      return `Failed to search conversations: ${error.message}`;
    }

    const needle = q.toLowerCase();
    const rows = (data ?? []).filter((r) => {
      const titleMatch = (r.title ?? "").toLowerCase().includes(needle);
      if (titleMatch) return true;
      const messages = (r.messages as ConversationMessage[] | null) ?? [];
      return messages.some((m) =>
        (m?.content ?? "").toLowerCase().includes(needle)
      );
    }).slice(0, boundedLimit);

    if (rows.length === 0) {
      return `No past conversations matched "${q}" in the last ${sinceDays} days.`;
    }

    const lines = rows.map((r, i) => {
      const messages = (r.messages as ConversationMessage[] | null) ?? [];
      const last = messages[messages.length - 1];
      const snippet = (last?.content ?? "").substring(0, 200).replace(
        /\s+/g,
        " ",
      );
      return (
        `[${i + 1}] id=${r.id}\n` +
        `    Title: ${r.title ?? "(untitled)"}\n` +
        `    ${r.message_count} messages | updated ${r.updated_at}\n` +
        `    Last message: ${snippet}${snippet.length >= 200 ? "..." : ""}`
      );
    });

    return `Found ${rows.length} conversation${
      rows.length === 1 ? "" : "s"
    } matching "${q}":\n\n${
      lines.join("\n\n")
    }\n\nUse get_conversation(id) to read the full transcript of any relevant result.`;
  } catch (error) {
    return `Failed to search conversations: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

async function getConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<string> {
  try {
    if (!conversationId) return "conversation_id is required.";

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, message_count, created_at, updated_at, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log(`Error fetching conversation: ${error.message}`, "error");
      return `Failed to fetch conversation: ${error.message}`;
    }
    if (!data) {
      return `Conversation ${conversationId} not found (or not owned by this user).`;
    }

    const messages = (data.messages as ConversationMessage[] | null) ?? [];
    if (messages.length === 0) {
      return `Conversation "${data.title ?? "(untitled)"}" has no messages.`;
    }

    const transcript = messages.map((m) => {
      const role = m?.role === "assistant" ? "orion" : m?.role ?? "user";
      const ts = m?.timestamp ?? "";
      const content = (m?.content ?? "").trim();
      return `[${ts}] ${role}: ${content}`;
    }).join("\n\n");

    return (
      `Conversation "${
        data.title ?? "(untitled)"
      }" — ${messages.length} messages, ` +
      `created ${data.created_at}, last updated ${data.updated_at}:\n\n${transcript}`
    );
  } catch (error) {
    return `Failed to fetch conversation: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeRecallConversations(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for conversation lookup";
  const userId = context.userId || "";
  if (!userId) return "User ID not available in context";

  const action = typeof args.action === "string" ? args.action : "";

  if (action === "search") {
    const query = typeof args.query === "string" ? args.query : "";
    const sinceDays = typeof args.since_days === "number"
      ? args.since_days
      : 30;
    const limit = typeof args.limit === "number" ? args.limit : 5;
    return await searchConversations(supabase, userId, query, sinceDays, limit);
  }
  if (action === "get") {
    const conversationId = typeof args.conversation_id === "string"
      ? args.conversation_id
      : "";
    return await getConversation(supabase, userId, conversationId);
  }
  return JSON.stringify({
    success: false,
    error: `recall_conversations: unknown action "${action}". Use search|get.`,
  });
}
