/**
 * manage_tag — look up or save user-defined trading tag meanings
 * (e.g. "Confluence:3x Displacement"). Two actions: "get" / "save".
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../../_shared/supabase.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

export const manageTagTool: GeminiFunctionDeclaration = {
  name: "manage_tag",
  description:
    `Look up or save the user's definition for a custom trading tag (e.g. "Confluence:3x Displacement", "Setup:ICT OTE"). Pick ONE \`action\`:

- action="get" — fetch the user's explanation of what \`tag_name\` means, or null if undefined. Call this when you hit a tag you don't understand.
- action="save" — store/overwrite a definition. Needs \`tag_name\` + \`definition\`. ⚠️ ONLY after the user gives explicit permission — suggest a definition, wait for confirmation, then save.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "save"],
        description: "Look up or save a tag definition.",
      },
      tag_name: { type: "string", description: "Exact tag name." },
      definition: {
        type: "string",
        description: "Meaning of the tag (action=save only).",
      },
    },
    required: ["action", "tag_name"],
  },
};

async function getTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
): Promise<string> {
  try {
    log(`Looking up definition for tag: ${tagName}`, "info");

    const { data: exactMatch, error: exactError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .eq("tag_name", tagName)
      .single();

    if (exactError && exactError.code !== "PGRST116") {
      log(`Error fetching tag definition: ${exactError.message}`, "error");
      return `Error looking up tag definition: ${exactError.message}`;
    }

    if (exactMatch) {
      log(`Found exact definition for tag: ${tagName}`, "info");
      return `Tag "${tagName}" definition: ${exactMatch.definition}`;
    }

    // Partial match: "3x Displacement" → "Confluence:3x Displacement"
    const { data: partialMatches, error: partialError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .ilike("tag_name", `%:${tagName}`);

    if (partialError) {
      log(
        `Error fetching partial tag definition: ${partialError.message}`,
        "error",
      );
      return `Error looking up tag definition: ${partialError.message}`;
    }

    if (partialMatches && partialMatches.length > 0) {
      const match = partialMatches[0];
      log(
        `Found partial match for tag "${tagName}": ${match.tag_name}`,
        "info",
      );
      return `Tag "${match.tag_name}" definition: ${match.definition}`;
    }

    return `No definition found for tag "${tagName}". You may suggest a definition and ask the user if they'd like to save it.`;
  } catch (error) {
    return `Error looking up tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

async function saveTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
  definition: string,
): Promise<string> {
  try {
    log(`Saving definition for tag: ${tagName}`, "info");

    const { error } = await supabase.from("tag_definitions").upsert(
      {
        user_id: userId,
        tag_name: tagName,
        definition,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tag_name" },
    );

    if (error) {
      log(`Error saving tag definition: ${error.message}`, "error");
      return `Error saving tag definition: ${error.message}`;
    }

    log(`Saved definition for tag: ${tagName}`, "info");
    return `Successfully saved definition for tag "${tagName}".`;
  } catch (error) {
    return `Error saving tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeManageTag(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for tag operations";
  const userId = context.userId || "";
  const action = typeof args.action === "string" ? args.action : "";
  const tagName = typeof args.tag_name === "string" ? args.tag_name : "";

  if (action === "get") {
    return await getTagDefinition(supabase, userId, tagName);
  }
  if (action === "save") {
    const definition = typeof args.definition === "string"
      ? args.definition
      : "";
    return await saveTagDefinition(supabase, userId, tagName, definition);
  }
  return JSON.stringify({
    success: false,
    error: `manage_tag: unknown action "${action}". Use get|save.`,
  });
}
