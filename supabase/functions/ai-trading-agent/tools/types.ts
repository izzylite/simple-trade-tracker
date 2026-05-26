/**
 * Shared types for all tool implementations. Consumed by `tools.ts` and the
 * chat dispatcher in `index.ts`.
 */

import type { MemoryOp } from "../../_shared/memory/index.ts";

/**
 * Per-call context passed by the edge-function entrypoint into the tool
 * dispatcher. `allowedMemoryOps`, when set, restricts which memory ops the
 * update_memory / apply_rule_change tools will accept; when undefined, all
 * ops are permitted. Currently always undefined in production paths — the
 * field is the future hook for restricted/unattended callers.
 */
export interface ToolContext {
  userId?: string;
  calendarId?: string;
  conversationId?: string;
  allowedMemoryOps?: Set<MemoryOp>;
}

/**
 * Gemini function declaration type.
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}
