/**
 * Heuristic token estimation for the AI chat budget meter.
 *
 * Gemini's tokenizer lives on the server (countTokens API). Calling it on
 * every send is too slow and burns quota, so we use a ~chars/4 heuristic —
 * accurate to within ±15% for English text, which is fine for a UX progress
 * bar that only needs to land at roughly the right point.
 *
 * Images: Gemini bills 258 tokens per low-res image tile; we use that as a
 * conservative per-image cost since users typically attach screenshots.
 */
import type { ChatMessage } from 'features/orion/types/aiChat';

const CHARS_PER_TOKEN = 4;
const TOKENS_PER_IMAGE = 258;

const estimateMessageTokens = (msg: ChatMessage): number => {
  let chars = (msg.content ?? '').length;
  if (msg.reasoning) chars += msg.reasoning.length;
  const imageCount = msg.images?.length ?? 0;
  return Math.ceil(chars / CHARS_PER_TOKEN) + imageCount * TOKENS_PER_IMAGE;
};

export const estimateConversationTokens = (messages: ChatMessage[]): number =>
  messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
