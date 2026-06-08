import type { MarketResearchConfig } from 'features/orion/types/orionTask';

/**
 * Friendly label for the sweep cadence used in the helper text under the
 * schedule row. Mirrors the segmented-control labels.
 */
export function formatFrequencyLabel(minutes: number): string {
  if (minutes === 60) return '1 hour';
  if (minutes === 1440) return '24 hours';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} min`;
}

/**
 * Backfill fields on stored task configs so the form never sees undefined
 * values. Coerces sub-hourly frequencies (15/30) to 60 — those are no longer
 * supported (the 1h NEWS_CACHE_TTL kept cold-missing across consecutive runs).
 */
export function hydrateMarketResearchConfig(
  raw: Record<string, unknown>
): MarketResearchConfig {
  const rawFreq = raw.frequency_minutes as number | undefined;
  const supportedFreqs = new Set([60, 120, 180, 240, 360, 1440]);
  const frequency = supportedFreqs.has(rawFreq ?? 0)
    ? (rawFreq as 60 | 120 | 180 | 240 | 360 | 1440)
    : 60;
  return {
    frequency_minutes: frequency,
    min_significance: (raw.min_significance as 'medium' | 'high') ?? 'high',
    subscribed_assets: Array.isArray(raw.subscribed_assets)
      ? (raw.subscribed_assets as string[])
      : [],
  };
}
