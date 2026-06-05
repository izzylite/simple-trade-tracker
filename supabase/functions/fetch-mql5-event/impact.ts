/**
 * Impact rating helpers for economic events.
 *
 * Impact is the High/Medium/Low importance of an economic event. The MQL5
 * event page is authoritative for a given event, but the stored value can be a
 * stale PLACEHOLDER: the weekly bulk refresh writes `impact: 'Low'` for inline
 * events it has not yet enriched (see mql5-extractor.ts). That placeholder is
 * indistinguishable from a genuine "Low" rating, and the old write guard
 * (`if (!cachedEvent.impact)`) refused to ever overwrite it — so a high-impact
 * event like Nonfarm Payrolls stayed mislabeled "Low" forever.
 *
 * resolveImpact lets a fresh scrape CORRECT impact upward (or fill an empty
 * value) but never silently DOWNGRADES a higher stored rating. This:
 *  - fixes the placeholder lock-in (placeholder Low is always upgradeable), and
 *  - preserves the original intent of not letting MQL5's ratings clobber a
 *    genuine High set by the primary source.
 * For a trading-alert product, over-warning (keeping High) is the safe
 * direction; we never hide a real High.
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
 * Decide the impact to persist given the currently-cached value and a freshly
 * scraped value.
 *
 * Returns the impact string to write, or null to leave the stored value
 * unchanged.
 *
 * Rules:
 *  - An unrecognized scraped value is ignored (return null).
 *  - If there is no valid cached impact, take the scraped value (fill).
 *  - Otherwise take the scraped value only when it is the same or higher rank
 *    than the cached one (correct/upgrade), never lower (no silent downgrade).
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
