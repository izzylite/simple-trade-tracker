/**
 * Shared types for all tool implementations.
 *
 * `tools.ts` re-exports these for stable external imports
 * (market-research.ts, index.ts).
 */

import type { MemoryOp } from "../../_shared/memory/index.ts";

/**
 * Per-call context passed by edge-function entrypoints into the tool
 * dispatcher. The chat function passes the user's id + calendar (memory
 * is read-write); market-research passes the same plus a restricted
 * `allowedMemoryOps` set so unattended jobs can't do destructive edits
 * without user-in-the-loop signal.
 */
export interface ToolContext {
  userId?: string;
  calendarId?: string;
  conversationId?: string;
  // When omitted, updateMemory defaults to all ops permitted.
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
