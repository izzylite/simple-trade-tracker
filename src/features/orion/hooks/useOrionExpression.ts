import { useEffect, useRef, useState } from 'react';
import type { OrionState } from 'features/orion/components/aiChat/OrionMark';

/**
 * Derives an Orion expression from chat liveness signals.
 *
 *   snap      → fired on mount as an intro beat, and again when the agent
 *               loop ends with a new assistant message.
 *   focus     → fired the moment the agent loop kicks off (user just sent).
 *   looking   → held while the agent loop is running on a non-search tool
 *               (or no tool — generic thought).
 *   searching → held while the agent is mid-call on a search-class tool
 *               (search_web, recall_conversations, manage_note:search, etc).
 *   idle      → ambient default — gentle blink every ~5s.
 *   sleep     → after IDLE_TIMEOUT_MS of no activity. Snores Zs.
 *   resting   → truly static. Callers that need a motionless mark
 *               (per-message avatar, FAB) hardcode `state="resting"` and
 *               don't use this hook.
 *
 * Callers can fire one-shots by passing `pulse: { state, key }`. Every
 * `key` change re-fires the configured one-shot — used by the drawer to
 * wink on a Tasks-tab switch.
 *
 * `runId` increments on every transition so callers can pass it as a React
 * `key` to restart one-shot animations even when the resolved state matches
 * the previous one.
 */

const FOCUS_MS = 2_400;
const SNAP_MS = 5_400;
const WINK_MS = 3_600;
const ALERT_MS = 3_000;
const IDLE_TIMEOUT_MS = 1 * 60 * 1_000; // 1 min → sleep (TEMP: test value, restore to 5 min)

// Tool labels (from useAIChat TOOL_LABELS) that read as "Orion is hunting
// for information." Matched as a prefix or substring against the comma-
// joined `toolStatus` string. Loose by design — when a new search-like
// tool is added we get the figure-8 for free; if a label is renamed and
// we lose it, the regression is just visual.
const SEARCH_LABEL_PATTERNS = [
  'Searching',
  'Recalling',
  'Reading',
  'Loading',
  'Looking up',
  'Pulling',
];

function isSearchingTool(toolStatus: string | undefined): boolean {
  if (!toolStatus) return false;
  return SEARCH_LABEL_PATTERNS.some((p) => toolStatus.includes(p));
}

type OneShotState = 'wink' | 'snap' | 'focus' | 'alert';

const ONE_SHOT_DURATION: Record<OneShotState, number> = {
  wink: WINK_MS,
  snap: SNAP_MS,
  focus: FOCUS_MS,
  alert: ALERT_MS,
};

export interface OrionExpressionOptions {
  /** Human-readable label of the currently-running tool. */
  toolStatus?: string;
  /**
   * Increment this to mark a user interaction beyond send/receive (tab
   * switches, etc.). Resets the sleep timer.
   */
  activitySignal?: number;
  /** Fire-and-forget one-shot. Bump `key` to re-trigger. */
  pulse?: { state: OneShotState; key: number };
}

export interface OrionExpression {
  state: OrionState;
  runId: number;
}

export function useOrionExpression(
  isLoading: boolean,
  messageCount: number,
  options: OrionExpressionOptions = {},
): OrionExpression {
  const { toolStatus, activitySignal, pulse } = options;

  // Open with the intro snap. The mount effect below clears it to `idle`
  // after the animation completes.
  const [expression, setExpression] = useState<OrionExpression>({
    state: 'snap',
    runId: 1,
  });

  const prevLoadingRef = useRef(isLoading);
  const prevCountRef = useRef(messageCount);
  const prevPulseKeyRef = useRef(pulse?.key);
  // Single timeout slot for one-shot → fallback transitions. Activity
  // bumps reset it; new one-shots clear and reschedule.
  const oneShotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate slot for the idle → sleep timer. Lives independently because
  // it should keep ticking while a one-shot plays out.
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armSleepTimer = () => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    sleepTimeoutRef.current = setTimeout(() => {
      setExpression(({ runId }) => ({ state: 'sleep', runId: runId + 1 }));
    }, IDLE_TIMEOUT_MS);
  };

  // Intro snap → idle on first mount, then arm the sleep timer.
  useEffect(() => {
    oneShotTimeoutRef.current = setTimeout(() => {
      setExpression(({ runId }) => ({ state: 'idle', runId: runId + 1 }));
    }, SNAP_MS);
    armSleepTimer();
    return () => {
      if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activity tracker: any send/receive/tab-switch resets the sleep timer
  // AND wakes the mark if it's currently sleeping.
  useEffect(() => {
    armSleepTimer();
    setExpression((curr) =>
      curr.state === 'sleep'
        ? { state: 'idle', runId: curr.runId + 1 }
        : curr,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitySignal, messageCount, isLoading]);

  // Loop start/end transitions. Snap on response landing, focus on send,
  // and choose looking-vs-searching when the loop is mid-flight based on
  // the current tool status at the moment focus rolls into the long-form
  // state. The toolStatus-watcher effect below keeps it in sync if the
  // tool changes mid-loop.
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const prevCount = prevCountRef.current;
    prevLoadingRef.current = isLoading;
    prevCountRef.current = messageCount;

    if (isLoading && !wasLoading) {
      if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
      setExpression(({ runId }) => ({ state: 'focus', runId: runId + 1 }));
      oneShotTimeoutRef.current = setTimeout(() => {
        if (prevLoadingRef.current) {
          const next: OrionState = isSearchingTool(toolStatus)
            ? 'searching'
            : 'looking';
          setExpression(({ runId }) => ({ state: next, runId: runId + 1 }));
        }
      }, FOCUS_MS);
      return;
    }

    if (!isLoading && wasLoading) {
      if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
      const arrived = messageCount > prevCount;
      if (arrived) {
        setExpression(({ runId }) => ({ state: 'snap', runId: runId + 1 }));
        oneShotTimeoutRef.current = setTimeout(() => {
          setExpression(({ runId }) => ({ state: 'idle', runId: runId + 1 }));
        }, SNAP_MS);
      } else {
        setExpression(({ runId }) => ({ state: 'idle', runId: runId + 1 }));
      }
    }
    // toolStatus intentionally NOT a dep — re-evaluating only at the moment
    // of the focus→long-form transition. Mid-loop tool changes are picked
    // up by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, messageCount]);

  // Mid-loop tool swap: while the agent loop is running and the current
  // state is the long-form looking/searching pair, flip to match toolStatus.
  // No-op during one-shots (focus / snap / wink) so they finish cleanly.
  useEffect(() => {
    if (!isLoading) return;
    setExpression((curr) => {
      if (curr.state !== 'looking' && curr.state !== 'searching') return curr;
      const next: OrionState = isSearchingTool(toolStatus)
        ? 'searching'
        : 'looking';
      if (next === curr.state) return curr;
      return { state: next, runId: curr.runId + 1 };
    });
  }, [toolStatus, isLoading]);

  // External one-shot pulse — wink on tab change, etc. Triggers on every
  // key change (including the initial mount when key is defined and prev
  // is undefined). After the duration, falls back to idle UNLESS a real
  // signal has since taken over (the setExpression callback compares).
  useEffect(() => {
    if (!pulse) return;
    if (pulse.key === prevPulseKeyRef.current) return;
    prevPulseKeyRef.current = pulse.key;

    if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
    setExpression(({ runId }) => ({ state: pulse.state, runId: runId + 1 }));
    const duration = ONE_SHOT_DURATION[pulse.state];
    oneShotTimeoutRef.current = setTimeout(() => {
      setExpression((curr) =>
        // Only fall back if we're still showing the pulse we set. A real
        // loop transition that landed inside the window already overrode
        // us — leave it alone.
        curr.state === pulse.state
          ? { state: 'idle', runId: curr.runId + 1 }
          : curr,
      );
    }, duration);
  }, [pulse]);

  return expression;
}
