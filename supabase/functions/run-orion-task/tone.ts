/**
 * Coaching-tone instructions shared across all rollup briefings.
 *
 * Originally duplicated in daily-analysis only; weekly/monthly were
 * toneless. Pulling it into one file means a tone tweak applies
 * everywhere consistently, and the UI-driven `tone` config field on
 * each rollup type maps to the same vocabulary.
 */

import type { OrionTone } from './types.ts';

export const TONE_INSTRUCTIONS: Record<OrionTone, string> = {
  tough_love:
    'Be direct and challenging. Call out mistakes bluntly. ' +
    'Push the trader to be better. No sugar-coating. ' +
    'Example: "You broke your own rules again on trade #3. This is a pattern."',
  blunt_analyst:
    'Be factual and analytical. No emotional language. ' +
    'Present data objectively with clear conclusions. ' +
    'Example: "Win rate today: 40%. Below your 30-day average of 58%."',
  supportive_mentor:
    'Be encouraging but honest. Acknowledge what went well first, ' +
    'then gently address areas for improvement. Frame mistakes as learning. ' +
    'Example: "Good discipline on your first two trades. Let\'s look at what shifted after that."',
};

export function getToneInstruction(tone: OrionTone | undefined): string {
  return TONE_INSTRUCTIONS[tone ?? 'tough_love'] ?? TONE_INSTRUCTIONS.tough_love;
}
