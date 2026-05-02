/**
 * Conversation title helpers.
 *
 * The title is what shows up in the History sidebar and on cross-references
 * (e.g. the reminders panel's "in <title>" line). Slash-command and
 * note-reference messages have a `[Referenced command:\n...\n]` /
 * `[Referenced note:\n...\n]` framing that's there for the LLM but reads
 * badly as a title. This helper produces a clean title from the raw user
 * message content; pass it as `titleHint` on the first chat send so the
 * backend can store it on the conversation row.
 */

import { stripReferencedBlocks } from './chatMentions';

/**
 * Bare invocations (entire message is just `[Referenced command:]` /
 * `[Referenced note:]` blocks with no typed text) get a friendly label
 * instead of leaking raw block syntax. Mixed messages strip the trailing
 * block(s) and use the typed text only.
 */
export function generateConversationTitle(rawFirstUserMessage: string | null | undefined): string {
  if (!rawFirstUserMessage) {
    return `Conversation on ${new Date().toLocaleDateString()}`;
  }

  const raw = rawFirstUserMessage;
  const stripped = stripReferencedBlocks(raw);

  // Bare: stripping all blocks leaves nothing typed → label by block kind.
  if (!stripped.trim()) {
    const cmdCount = (raw.match(/\[Referenced command:/g) || []).length;
    const noteCount = (raw.match(/\[Referenced note:/g) || []).length;
    if (cmdCount > 0 && noteCount === 0) {
      return cmdCount === 1 ? 'Slash Command' : 'Slash Commands';
    }
    if (noteCount > 0 && cmdCount === 0) {
      return noteCount === 1 ? 'Referenced Note' : 'Referenced Notes';
    }
    return 'Slash Commands & Notes';
  }

  // Mixed or plain: use typed text (with blocks stripped), trimmed to 50 chars.
  const title = stripped.substring(0, 50);
  return title.length < stripped.length ? `${title}...` : title;
}
