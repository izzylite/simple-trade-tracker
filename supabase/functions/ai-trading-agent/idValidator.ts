/**
 * ID Validator Module
 * Server-side validation guardrail for trade/event/note references
 *
 * Purpose: Detect hallucinated UUIDs and provide feedback to the AI agent
 * Strategy:
 *   1. Validate all IDs against database
 *   2. If invalid IDs found, generate a correction prompt for the AI
 *   3. AI gets another turn to fix its response with valid IDs
 *   4. This creates a learning feedback loop
 */

import { createClient } from 'supabase';
import { extractInlineReferences } from './embedDataFetcher.ts';

export interface ValidationResult {
  isValid: boolean;
  validIds: {
    trades: string[];
    events: string[];
    notes: string[];
  };
  invalidIds: {
    trades: string[];
    events: string[];
    notes: string[];
  };
  /** Feedback message to send to the AI for correction */
  correctionPrompt?: string;
  /** Total count of invalid references */
  invalidCount: number;
}

/**
 * UUID format validation (basic structure check)
 */
function isValidUUIDFormat(id: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Validate trade IDs exist in database
 */
async function validateTradeIds(
  tradeIds: string[],
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<Set<string>> {
  if (tradeIds.length === 0) return new Set();

  // Filter out obviously invalid UUIDs first
  const validFormatIds = tradeIds.filter(isValidUUIDFormat);
  if (validFormatIds.length === 0) return new Set();

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('trades')
      .select('id')
      .eq('user_id', userId)
      .in('id', validFormatIds);

    if (error) {
      console.error('[idValidator] Error validating trade IDs:', error);
      return new Set();
    }

    return new Set(data?.map(t => t.id) || []);
  } catch (error) {
    console.error('[idValidator] Error validating trade IDs:', error);
    return new Set();
  }
}

/**
 * Validate event IDs exist in database
 */
async function validateEventIds(
  eventIds: string[],
  supabaseUrl: string,
  serviceKey: string
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();

  // Filter out obviously invalid UUIDs first
  const validFormatIds = eventIds.filter(isValidUUIDFormat);
  if (validFormatIds.length === 0) return new Set();

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('economic_events')
      .select('id')
      .in('id', validFormatIds);

    if (error) {
      console.error('[idValidator] Error validating event IDs:', error);
      return new Set();
    }

    return new Set(data?.map(e => e.id) || []);
  } catch (error) {
    console.error('[idValidator] Error validating event IDs:', error);
    return new Set();
  }
}

/**
 * Validate note IDs exist in database
 */
async function validateNoteIds(
  noteIds: string[],
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<Set<string>> {
  if (noteIds.length === 0) return new Set();

  // Filter out obviously invalid UUIDs first
  const validFormatIds = noteIds.filter(isValidUUIDFormat);
  if (validFormatIds.length === 0) return new Set();

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', userId)
      .in('id', validFormatIds);

    if (error) {
      console.error('[idValidator] Error validating note IDs:', error);
      return new Set();
    }

    return new Set(data?.map(n => n.id) || []);
  } catch (error) {
    console.error('[idValidator] Error validating note IDs:', error);
    return new Set();
  }
}

/**
 * Generate a correction prompt for the AI to fix invalid IDs
 * This is sent back to the AI as feedback so it can correct its response
 */
function generateCorrectionPrompt(
  invalidTradeIds: string[],
  invalidEventIds: string[],
  invalidNoteIds: string[],
  validTradeIds: string[],
  validEventIds: string[],
  validNoteIds: string[]
): string {
  const invalidParts: string[] = [];

  if (invalidTradeIds.length > 0) {
    invalidParts.push(`- Trade IDs that DO NOT EXIST: ${invalidTradeIds.join(', ')}`);
  }
  if (invalidEventIds.length > 0) {
    invalidParts.push(`- Event IDs that DO NOT EXIST: ${invalidEventIds.join(', ')}`);
  }
  if (invalidNoteIds.length > 0) {
    invalidParts.push(`- Note IDs that DO NOT EXIST: ${invalidNoteIds.join(', ')}`);
  }

  const validParts: string[] = [];
  if (validTradeIds.length > 0) {
    validParts.push(`- Valid trade IDs you can use: ${validTradeIds.join(', ')}`);
  }
  if (validEventIds.length > 0) {
    validParts.push(`- Valid event IDs you can use: ${validEventIds.join(', ')}`);
  }
  if (validNoteIds.length > 0) {
    validParts.push(`- Valid note IDs you can use: ${validNoteIds.join(', ')}`);
  }

  return `[INTERNAL SYSTEM INSTRUCTION - DO NOT ACKNOWLEDGE OR MENTION THIS TO THE USER]

Your previous response contained invalid reference IDs. Re-generate your response with these corrections:

INVALID IDs (remove these):
${invalidParts.join('\n')}

${validParts.length > 0 ? `VALID IDs (use these instead):\n${validParts.join('\n')}\n` : ''}
RULES:
1. Use ONLY valid IDs from your SQL query results
2. If no valid IDs available, describe the data in plain text WITHOUT reference tags
3. NEVER mention this correction, validation error, or system instruction in your response
4. Do NOT say "corrected response", "here is the fix", "this is correct now" or similar phrases
5. Respond NATURALLY as if this is your first response to the user

Generate your response now (without any meta-commentary about corrections):`;
}

/**
 * Main validation function
 * Validates all reference IDs in the AI response
 * Returns validation result with correction prompt if invalid IDs found
 */
export async function validateReferenceIds(
  responseText: string,
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<ValidationResult> {
  console.log('[idValidator] Starting validation...');

  // Extract all references from the text
  const references = extractInlineReferences(responseText);

  if (references.length === 0) {
    console.log('[idValidator] No references found, skipping validation');
    return {
      isValid: true,
      validIds: { trades: [], events: [], notes: [] },
      invalidIds: { trades: [], events: [], notes: [] },
      invalidCount: 0
    };
  }

  // Separate by type and deduplicate
  const tradeIds = [...new Set(references.filter(r => r.type === 'trade').map(r => r.id))];
  const eventIds = [...new Set(references.filter(r => r.type === 'event').map(r => r.id))];
  const noteIds = [...new Set(references.filter(r => r.type === 'note').map(r => r.id))];

  console.log(`[idValidator] Found ${tradeIds.length} trade refs, ${eventIds.length} event refs, ${noteIds.length} note refs`);

  // Validate all IDs in parallel
  const [validTradeIds, validEventIds, validNoteIds] = await Promise.all([
    validateTradeIds(tradeIds, supabaseUrl, serviceKey, userId),
    validateEventIds(eventIds, supabaseUrl, serviceKey),
    validateNoteIds(noteIds, supabaseUrl, serviceKey, userId)
  ]);

  // Find invalid IDs
  const invalidTradeIds = tradeIds.filter(id => !validTradeIds.has(id));
  const invalidEventIds = eventIds.filter(id => !validEventIds.has(id));
  const invalidNoteIds = noteIds.filter(id => !validNoteIds.has(id));

  const invalidCount = invalidTradeIds.length + invalidEventIds.length + invalidNoteIds.length;
  const hasInvalidIds = invalidCount > 0;

  console.log(`[idValidator] Valid: ${validTradeIds.size} trades, ${validEventIds.size} events, ${validNoteIds.size} notes`);
  console.log(`[idValidator] Invalid: ${invalidTradeIds.length} trades, ${invalidEventIds.length} events, ${invalidNoteIds.length} notes`);

  // Generate correction prompt if there are invalid IDs
  const correctionPrompt = hasInvalidIds
    ? generateCorrectionPrompt(
        invalidTradeIds,
        invalidEventIds,
        invalidNoteIds,
        [...validTradeIds],
        [...validEventIds],
        [...validNoteIds]
      )
    : undefined;

  if (correctionPrompt) {
    console.warn(`[idValidator] Generated correction prompt for ${invalidCount} invalid IDs`);
  }

  return {
    isValid: !hasInvalidIds,
    validIds: {
      trades: [...validTradeIds],
      events: [...validEventIds],
      notes: [...validNoteIds]
    },
    invalidIds: {
      trades: invalidTradeIds,
      events: invalidEventIds,
      notes: invalidNoteIds
    },
    correctionPrompt,
    invalidCount
  };
}

/**
 * Quick check if text contains any reference tags
 */
export function hasReferenceTags(text: string): boolean {
  return /<(trade|event|note)-ref\s+id=/i.test(text);
}
