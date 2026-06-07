/**
 * Impact rating helpers for economic events. Shared by refresh-economic-calendar
 * (MyFXBook write path) and fetch-mql5-event (MQL5 enrichment).
 *
 * Impact is the High/Medium/Low importance of an economic event. The stored
 * value can be a stale PLACEHOLDER: bulk writes record `impact: 'Low'` for rows
 * not yet enriched, and that placeholder is indistinguishable from a genuine
 * "Low". A naive write guard (`if (!cachedEvent.impact)`) would refuse to ever
 * overwrite it, so a high-impact event like Nonfarm Payrolls would stay
 * mislabeled "Low" forever.
 *
 * resolveImpact lets a fresh value CORRECT impact upward (or fill an empty slot)
 * but never silently DOWNGRADES a higher stored rating. For a trading-alert
 * product, over-warning (keeping High) is the safe direction; we never hide a
 * real High.
 */

export type ImpactLevel = "High" | "Medium" | "Low";

const IMPACT_RANK: Record<ImpactLevel, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

/**
 * Normalize an arbitrary impact string to the canonical High/Medium/Low,
 * or null if it is not a recognized rating (so callers never persist garbage).
 */
export function normalizeImpact(value: string | null | undefined): ImpactLevel | null {
  if (!value) return null;
  switch (value.trim().toLowerCase()) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return null;
  }
}

/**
 * Decide the impact to persist given the currently-stored value and a freshly
 * scraped value. Returns the impact to write, or null to leave it unchanged.
 *
 * Rules:
 *  - An unrecognized scraped value is ignored (return null).
 *  - If there is no valid stored impact, take the scraped value (fill).
 *  - Otherwise take the scraped value only when it is the same or higher rank
 *    than the stored one (correct/upgrade), never lower (no silent downgrade).
 */
export function resolveImpact(
  cachedImpact: string | null | undefined,
  scrapedImpact: string | null | undefined,
): ImpactLevel | null {
  const scraped = normalizeImpact(scrapedImpact);
  if (!scraped) return null;

  const cached = normalizeImpact(cachedImpact);
  if (!cached) return scraped;

  return IMPACT_RANK[scraped] >= IMPACT_RANK[cached] ? scraped : null;
}
