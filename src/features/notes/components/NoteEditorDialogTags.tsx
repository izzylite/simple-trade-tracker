/**
 * Default note-tag config (icons + display labels + subtitles).
 * Extracted from NoteEditorDialog so both the dialog and the inline editor body
 * can share without circular imports.
 */

import {
  TrackChanges as StrategyIcon,
  EventNote as GamePlanIcon,
  Lightbulb as InsightIcon,
  School as LessonIcon,
  Description as GeneralIcon,
  Shield as RiskIcon,
  Psychology as PsychologyIcon,
  Gavel as GuidelineIcon,
  Bolt as SlashCommandIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

import {
  SLASH_COMMAND_TAG,
  GUIDELINE_TAG,
  GAME_PLAN_TAG,
  LESSON_LEARNED_TAG,
  RISK_MANAGEMENT_TAG,
  PSYCHOLOGY_TAG,
  GENERAL_TAG,
  STRATEGY_TAG,
  INSIGHT_TAG,
} from '../types/note';

export interface TagInfo {
  label: string;
  subtitle: string;
  Icon: SvgIconComponent;
}

export const DEFAULT_NOTE_TAGS_MAP: Record<string, TagInfo> = {
  [STRATEGY_TAG]: { label: 'Strategy', subtitle: 'Long-term trading approach and rules', Icon: StrategyIcon },
  [GAME_PLAN_TAG]: { label: 'Game Plan', subtitle: 'Specific plan for the upcoming session', Icon: GamePlanIcon },
  [INSIGHT_TAG]: { label: 'Insight', subtitle: 'Market observations and patterns', Icon: InsightIcon },
  [LESSON_LEARNED_TAG]: { label: 'Lesson Learned', subtitle: 'Review of mistakes and successes', Icon: LessonIcon },
  [GENERAL_TAG]: { label: 'General', subtitle: 'General notes and thoughts', Icon: GeneralIcon },
  [RISK_MANAGEMENT_TAG]: { label: 'Risk Management', subtitle: 'Position sizing and stop-loss rules', Icon: RiskIcon },
  [PSYCHOLOGY_TAG]: { label: 'Psychology', subtitle: 'Mental state and emotional control', Icon: PsychologyIcon },
  [GUIDELINE_TAG]: { label: 'Guideline', subtitle: 'Instructions for Orion (max 1)', Icon: GuidelineIcon },
  [SLASH_COMMAND_TAG]: { label: 'Slash Command', subtitle: 'Reusable AI prompt — trigger via "/" in chat', Icon: SlashCommandIcon },
};

export const getTagDisplayLabel = (tag: string): string =>
  DEFAULT_NOTE_TAGS_MAP[tag]?.label || tag;

export const getTagSubtitle = (tag: string): string =>
  DEFAULT_NOTE_TAGS_MAP[tag]?.subtitle || '';

export const getTagIcon = (tag: string): SvgIconComponent | undefined =>
  DEFAULT_NOTE_TAGS_MAP[tag]?.Icon;
