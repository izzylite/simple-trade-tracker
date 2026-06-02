/**
 * Trade-copy service — copies a single trade into other calendars as fully
 * independent, standalone trades. PnL is recomputed per destination; images
 * are duplicated into their own storage objects; no link/sync to the source.
 */
import { supabase } from 'config/supabase';
import { logger } from 'utils/logger';
import { getPublicUrl } from 'services/supabaseStorageService';
import { Trade, Calendar, TradeImageEntity } from 'features/calendar/types/dualWrite';
import {
  DynamicRiskSettings,
  calculateCumulativePnLToDateAsync,
  calculateEffectiveRiskPercentageAsync,
  calculateRiskAmount,
  amountFromRiskAmount,
} from '../utils/dynamicRiskUtils';
import { addTrade, getTradeById } from './calendarService';

const TRADE_IMAGES_BUCKET = 'trade-images';

export interface CopyResult {
  calendarId: string;
  calendarName: string;
  status: 'success' | 'error';
  error?: string;
  /** true when the trade was created but one or more images could not be duplicated */
  imagesOmitted?: boolean;
}

/**
 * Recompute a copied trade's `amount` for the destination calendar's risk
 * model. Carries the raw amount when recalculation isn't possible.
 *
 * Pure when `destTrades` is provided. When omitted, the destination's
 * cumulative-PnL-to-date is derived from its `year_stats` plus a single
 * narrow query for the trade's own month (the canonical optimized path) —
 * cheaper than reading the destination's full trade history.
 */
export async function computeCopyAmount(
  trade: Trade,
  destCalendar: Calendar,
  destTrades?: Trade[]
): Promise<number> {
  if (trade.trade_type === 'breakeven') return 0;
  if (!destCalendar.risk_per_trade) return trade.amount;
  if (!trade.risk_to_reward || trade.partials_taken) return trade.amount;

  const drs: DynamicRiskSettings = {
    account_balance: destCalendar.account_balance,
    risk_per_trade: destCalendar.risk_per_trade,
    dynamic_risk_enabled: destCalendar.dynamic_risk_enabled,
    increased_risk_percentage: destCalendar.increased_risk_percentage,
    profit_threshold_percentage: destCalendar.profit_threshold_percentage,
  };

  const tradeDate = new Date(trade.trade_date);
  const cumulativePnL = await calculateCumulativePnLToDateAsync(tradeDate, destCalendar, destTrades);
  const effRisk = await calculateEffectiveRiskPercentageAsync(tradeDate, destCalendar, drs, destTrades);
  const riskAmount = calculateRiskAmount(effRisk, destCalendar.account_balance, cumulativePnL);

  return amountFromRiskAmount(trade.trade_type, trade.risk_to_reward, riskAmount);
}

/**
 * Build the insert payload for a standalone copy: strip source/sync/share
 * fields and apply standalone overrides. `copiedImages` are already-duplicated
 * image entities owned by the destination.
 */
export function buildCopiedTradePayload(
  trade: Trade,
  destCalendarId: string,
  recomputedAmount: number,
  copiedImages: TradeImageEntity[]
): Omit<Trade, 'id' | 'created_at' | 'updated_at'> {
  const {
    id,
    created_at,
    updated_at,
    calendar_id,
    source_trade_id,
    is_synced_copy,
    is_pinned,
    is_temporary,
    share_link,
    is_shared,
    shared_at,
    share_id,
    images,
    ...rest
  } = trade;

  return {
    ...rest,
    calendar_id: destCalendarId,
    amount: recomputedAmount,
    images: copiedImages,
    source_trade_id: undefined,
    is_synced_copy: false,
    is_pinned: false,
    is_temporary: false,
    share_link: undefined,
    is_shared: false,
    shared_at: undefined,
    share_id: undefined,
  };
}

/** Build the aggregate snackbar notification for a finished copy run. */
export function summarizeCopyResults(
  results: CopyResult[]
): { kind: 'success' | 'warning' | 'error'; message: string } {
  const ok = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status === 'error');
  const omitted = ok.some((r) => r.imagesOmitted);
  const imgNote = omitted ? ' (some without images)' : '';

  if (failed.length === 0) {
    const msg =
      ok.length === 1
        ? `Copied trade to ${ok[0].calendarName}${omitted ? ' without images' : ''}.`
        : `Copied trade to ${ok.length} calendars${imgNote}.`;
    return { kind: 'success', message: msg };
  }

  if (ok.length === 0) {
    return { kind: 'error', message: "Couldn't copy the trade to any calendar." };
  }

  const failedNames = failed.map((r) => r.calendarName).join(', ');
  return {
    kind: 'warning',
    message: `Copied to ${ok.length} of ${ok.length + failed.length} calendars${imgNote} · failed: ${failedNames}.`,
  };
}

/** Resolve the in-bucket object path for a source image. Exported for tests. */
export function sourceObjectPath(image: TradeImageEntity): string | null {
  if (image.storage_path) return image.storage_path;
  const marker = `/object/public/${TRADE_IMAGES_BUCKET}/`;
  const i = image.url ? image.url.indexOf(marker) : -1;
  if (i < 0) return null;
  try {
    return decodeURIComponent(image.url.slice(i + marker.length));
  } catch {
    // Malformed percent-encoding — fall back to the raw slice rather than throw.
    return image.url.slice(i + marker.length);
  }
}

/** Generate a unique object id preserving the source extension. Exported for tests. */
export function freshImageId(sourcePath: string): string {
  const slash = sourcePath.lastIndexOf('/');
  const base = slash >= 0 ? sourcePath.slice(slash + 1) : sourcePath;
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  return `${crypto.randomUUID()}${ext}`;
}

/**
 * Duplicate a trade's images into fresh storage objects under the destination
 * owner's canonical prefix (`users/{userId}/trade-images/{newId}`) — the exact
 * path the by-id cleanup reconstructs, so a copy is never orphaned when the
 * source is deleted. Best-effort per image. Returns the copied entities and how
 * many real (non-pending) images were NOT copied.
 */
async function copyTradeImages(
  images: TradeImageEntity[] | undefined,
  destCalendarId: string,
  userId: string | undefined
): Promise<{ images: TradeImageEntity[]; omittedCount: number }> {
  const real = (images ?? []).filter((img) => !img.pending);
  if (real.length === 0) return { images: [], omittedCount: 0 };
  if (!userId) return { images: [], omittedCount: real.length };

  const copied: TradeImageEntity[] = [];
  for (const img of real) {
    try {
      const srcPath = sourceObjectPath(img);
      if (!srcPath) continue;
      const newId = freshImageId(srcPath);
      const destPath = `users/${userId}/trade-images/${newId}`;

      const { error } = await supabase.storage
        .from(TRADE_IMAGES_BUCKET)
        .copy(srcPath, destPath);
      if (error) throw error;

      copied.push({
        ...img,
        id: newId,
        url: getPublicUrl(TRADE_IMAGES_BUCKET, destPath),
        storage_path: destPath,
        calendar_id: destCalendarId,
        pending: false,
      });
    } catch (e) {
      logger.error('copyTradeImages: failed to copy image', img.id, e);
    }
  }

  return { images: copied, omittedCount: real.length - copied.length };
}

/**
 * Copy a trade into each destination calendar. Per-destination isolation:
 * one failure never aborts the rest. Calls `onResult` after each destination
 * so callers can render per-row progress.
 *
 * The source trade is re-read from the DB so a non-persisted "consistent risk"
 * hypothetical amount held in memory can never be written into a destination.
 * If a destination INSERT fails after its images were duplicated, those orphan
 * storage objects are removed best-effort.
 */
export async function copyTradeToCalendars(
  trade: Trade,
  destCalendars: Calendar[],
  onResult?: (result: CopyResult) => void
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];

  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id;
  } catch (e) {
    logger.error('copyTradeToCalendars: getUser failed', e);
  }

  // Authoritative persisted source row — the in-memory `trade` may carry a
  // hypothetical amount when the "consistent risk" view is toggled on.
  let source: Trade = trade;
  try {
    const fetched = await getTradeById(trade.id);
    if (fetched) source = fetched;
  } catch (e) {
    logger.error('copyTradeToCalendars: getTradeById failed, using in-memory trade', e);
  }

  for (const dest of destCalendars) {
    let copiedPaths: string[] = [];
    let result: CopyResult;
    try {
      const amount = await computeCopyAmount(source, dest);
      const { images: copiedImages, omittedCount } = await copyTradeImages(
        source.images,
        dest.id!,
        userId
      );
      copiedPaths = copiedImages
        .map((i) => i.storage_path)
        .filter((p): p is string => !!p);
      const payload = buildCopiedTradePayload(source, dest.id!, amount, copiedImages);
      await addTrade(dest.id!, payload);
      result = {
        calendarId: dest.id!,
        calendarName: dest.name,
        status: 'success',
        imagesOmitted: omittedCount > 0,
      };
    } catch (e) {
      // Remove any images already copied for this failed destination so the
      // insert failure doesn't leak orphaned storage objects.
      if (copiedPaths.length) {
        try {
          await supabase.storage.from(TRADE_IMAGES_BUCKET).remove(copiedPaths);
        } catch (cleanupErr) {
          logger.error('copyTradeToCalendars: orphan image cleanup failed', cleanupErr);
        }
      }
      logger.error('copyTradeToCalendars: failed for calendar', dest.id, e);
      result = {
        calendarId: dest.id!,
        calendarName: dest.name,
        status: 'error',
        error: (e as Error)?.message ?? 'Copy failed',
      };
    }
    results.push(result);
    onResult?.(result);
  }

  return results;
}
