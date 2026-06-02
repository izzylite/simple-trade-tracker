# Copy Trade to Another Calendar — Design

**Date:** 2026-06-01
**Status:** Approved (design); ready for implementation planning
**Pillar:** Calendar

## Summary

Add the ability to copy a single trade from one calendar into one or more of
the user's other calendars. Each copy is a **fully independent, standalone
trade** — it does not reference, link to, or sync with the source trade or
source calendar in any way. Images are duplicated into their own storage
objects, and the PnL (`amount`) is recalculated against each destination
calendar's settings.

The entry point is a new **"Copy to calendar"** item in the trade's 3-dot
action menu (alongside Edit / Delete).

## Goals

- Copy one trade into 1..N destination calendars in a single action.
- Recompute each copy's `amount` from the **destination** calendar's risk
  settings (risk-per-trade, account balance, dynamic risk), falling back to the
  original stored `amount` when recalculation isn't possible.
- Duplicate the trade's images into independent storage objects owned by the
  destination (so deleting the source never orphans a copy, and vice versa).
- Keep each copy standalone: `source_trade_id = undefined`,
  `is_synced_copy = false`, sharing fields cleared.

## Non-Goals (v1)

- **Bulk copy** of multiple selected trades (the multi-select toolbar). The
  shared `TradeOperationsProps.onCopyTrade` callback leaves room to add this
  later without rework, but it is out of scope now.
- A **server-side / Orion-callable** copy path. We chose frontend orchestration
  (see Approach). If copy-trade later needs to run server-side, the recalc math
  can be extracted into a shared module at that point.
- Wiring the menu item into surfaces other than `TradeList` (DayDialog,
  TradesListDialog, TradeGalleryDialog, …). The callback lives in the shared
  interface so those surfaces can adopt it cheaply later, but v1 wires only
  `TradeList` (the surface in the original request).
- Enforcing the destination calendar's `required_tag_groups` on the copy. Tags
  are copied as-is; required-group validation is an entry-form constraint, not a
  data constraint.

## Relationship to the Existing Calendar-Link / Sync Feature

The codebase already has a **calendar-linking** feature (`CalendarLinkDialog`,
`calendars.linked_to_calendar_id`, `trades.source_trade_id`,
`trades.is_synced_copy`, `supabase/functions/_shared/tradeSync.ts`,
`handle-trade-changes` → `syncToLinkedCalendar`). That feature auto-copies *new*
trades from a source calendar to a linked target and keeps them in sync for a
24h window (`is_synced_copy = true`).

**This feature is deliberately the opposite:** a one-shot, manual, standalone
copy with **no** link back. We therefore:

- **Reuse** the PnL-recalc *logic* (it is identical to `calculateSyncedAmount`),
  but via the existing **frontend** helpers in
  `features/calendar/utils/dynamicRiskUtils.ts`.
- **Do not** set `is_synced_copy`/`source_trade_id` and **do not** route through
  the link/sync edge path. A copy must never be picked up by the sync machinery.

> Note: if a destination calendar happens to itself be a *source* in a calendar
> link (`linked_to_calendar_id` set), inserting the copy will propagate onward
> per the link feature's existing semantics. That is pre-existing behavior for
> *any* trade added to a linked source calendar and is out of scope here.

## Approach (chosen: A — Frontend orchestration)

A browser-side service orchestrates the copy. Rejected alternatives:

- **B — new `copy-trade` edge function:** more robust to tab-close and callable
  server-side, but adds a deploy + the `--no-verify-jwt` gotcha and more infra
  for what is a thin orchestration the frontend already has all primitives for.
- **C — reuse the link/sync path:** rejected; that machinery is built around
  `is_synced_copy = true` + a live sync window and would contaminate the
  standalone-copy semantics.

Approach A reuses the exact helpers the trade-entry form already uses, so a
copied trade's `amount` is computed the same way a manually-entered trade is.

## Architecture

### Components

| Unit | Location | Responsibility |
|---|---|---|
| `tradeCopyService.copyTradeToCalendars` | `features/calendar/services/tradeCopyService.ts` (new) | Orchestrate the copy per destination; return per-destination results |
| `CopyTradeDialog` | `features/calendar/components/dialogs/CopyTradeDialog.tsx` (new) | Destination picker (multi-select) + progress + summary |
| `TradeOperationsProps.onCopyTrade` | `features/calendar/types/tradeOperations.ts` (edit) | Shared callback `(trade: Trade) => void` |
| Menu item | `features/calendar/components/trades/TradeList.tsx` (edit) | "Copy to calendar" between Edit and Delete; hidden when `isReadOnly` |
| Dialog host | the page that already owns `onEditTrade`/`onDeleteTrade` (e.g. `TradeCalendarPage`) (edit) | Holds `tradeToCopy` state, passes `onCopyTrade` down, renders `CopyTradeDialog` |

`tradeCopyService` imports from `calendarService`, `dynamicRiskUtils`, and
`supabaseStorageService` only — a single direction, so no circular dependency.

### Data flow

1. User opens the trade 3-dot menu → clicks **Copy to calendar**.
2. `onCopyTrade(trade)` sets `tradeToCopy` on the host page → `CopyTradeDialog`
   opens.
3. Dialog loads `useCalendars(userId)`, filters out the current calendar and any
   soft-deleted (`deleted_at`) calendars, renders multi-select rows.
4. User selects 1..N calendars → clicks **Copy**.
5. Dialog calls `tradeCopyService.copyTradeToCalendars(trade, destCalendars)`.
6. Service processes each destination independently and returns
   `CopyResult[]`.
7. Dialog shows a summary toast (e.g. "Copied to 2 of 3 calendars"; lists any
   failures) and closes.

### `copyTradeToCalendars` per-destination algorithm

For each destination calendar (independent `try/catch`; one failure never
aborts the others):

1. **Recompute `amount`** (see PnL section).
2. **Duplicate images** (see Images section) → `copiedImages[]`.
3. **Build the insert payload** — strip source-specific fields (mirroring
   `prepareSyncedTrade`), then set the standalone overrides:
   - Stripped: `id`, `created_at`, `updated_at`, `calendar_id`,
     `source_trade_id`, `is_synced_copy`, `share_link`, `is_shared`,
     `shared_at`, `share_id`.
   - Overrides: `calendar_id = destId`, `source_trade_id = undefined`,
     `is_synced_copy = false`, `is_pinned = false`, `is_temporary = false`,
     `amount = recomputed`, `images = copiedImages`, share fields cleared.
   - Preserved as-is: `name`, `trade_type`, `trade_date`, `entry_price`,
     `exit_price`, `stop_loss`, `take_profit`, `risk_to_reward`,
     `partials_taken`, `session`, `notes`, `tags`, `economic_events`.
4. `addTrade(destId, payload)` — the trades insert webhook
   (`handle-trade-changes`) recomputes that calendar's `year_stats`. No webhook
   skipping (single insert; the bulk-write skip pattern does not apply).

### PnL recalculation

Mirrors `calculateSyncedAmount` using the frontend helpers in
`dynamicRiskUtils.ts`:

- **Carry the original `amount` as-is** when *any* of: destination has no
  `risk_per_trade`; trade has no `risk_to_reward`; `partials_taken === true`.
  Breakeven → `0`.
- **Otherwise recalculate:**
  1. `cumPnL = calculateCumulativePnLToDateAsync(trade.trade_date, destCalendar, destTrades)`
  2. `effRisk = calculateEffectiveRiskPercentageAsync(trade.trade_date, destCalendar, dynamicRiskSettings, destTrades)`
     (honors the destination's dynamic-risk settings)
  3. `riskAmount = calculateRiskAmount(effRisk, destCalendar.account_balance, cumPnL)`
  4. `amount = trade_type === 'win' ? round(riskAmount × risk_to_reward) : <loss>`

- **`destTrades`** are fetched once per destination via `getAllTrades(destId)`
  and passed into the helpers (needed for cumulative-PnL-to-date and dynamic
  risk). N destinations ⇒ N trade fetches — acceptable for a manual,
  small-N user action.

- **Loss-sign convention — verify in code, do not guess.**
  `calculateSyncedAmount` returns a *negative* loss amount, while the trade
  form's in-component helper appeared to return a *positive* value. The copied
  loss must read identically to a manually-entered loss in the same calendar.
  Implementation will reuse the same code path the trade form persists with (or
  match its output exactly) and lock the convention with a unit test against a
  known trade before relying on it.

### Images

Trade images live in a **public, user-scoped** bucket
(`users/{userId}/trade-images/{filename}`) and are referenced by `id` inside the
trade's `images` JSONB array. Cleanup-on-delete (`canDeleteImage`) keys off the
image `id` across all of the user's trades.

For each source image:

1. `supabase.storage.from('trade-images').copy(sourcePath, users/{userId}/trade-images/{newId})`
   where `newId` is a freshly generated unique filename.
2. Build a new `TradeImageEntity`: new `id`, new `url` (`getPublicUrl`), new
   `storage_path`, `calendar_id = destId`; preserve `caption`, `width`,
   `height`, `mime_type`, `file_size`, `row`, `column`, `column_width`.

A **fresh `id`** guarantees the copy is independent: the by-`id` cleanup check
sees distinct ids, so deleting the source trade can never orphan the copy's
image (and vice versa).

- **Fallback** if `.copy()` is blocked by storage policy:
  `fetch(sourceUrl)` → blob → `File` → `uploadTradeImage(...)`.
- **Best-effort per image:** if a single image fails both copy and reupload,
  skip that image and continue.
- **If *all* images fail for a destination:** still create the trade *without*
  images, and flag it in that destination's `CopyResult` (status `success` with
  a note like `imagesOmitted: true`) so the summary toast can mention it.
- Skip images flagged `pending: true` or missing a resolvable
  `storage_path`/`url`.

### UI / UX

- **Menu item:** "Copy to calendar" with `ContentCopyIcon`, inserted between
  Edit and Delete in `TradeList`'s `<Menu>`. Hidden when `isReadOnly`.
- **`CopyTradeDialog`:** follows `DuplicateCalendarDialog` structure +
  design-system tokens (`BaseDialog`, `styles/designTokens`, card/chip
  primitives). Contents:
  - Title: "Copy trade to…"; brief subtext naming the trade.
  - Multi-select list of calendars (checkbox rows: name + account balance;
    current + deleted excluded). Empty-state when the user has no other
    calendars.
  - **Copy** button disabled until ≥1 calendar selected; shows a spinner and
    per-row status (queued / copying / done / error) while running.
  - On completion: summary toast and close.
- **Host page:** `const [tradeToCopy, setTradeToCopy] = useState<Trade | null>(null)`;
  pass `onCopyTrade={setTradeToCopy}` down the existing `TradeOperationsProps`
  chain; render `<CopyTradeDialog open={!!tradeToCopy} trade={tradeToCopy} currentCalendarId=… userId=… onClose={…} />`.
  `userId` is available from `calendar.user_id` / auth context.

### Error handling

- Per-destination isolation; aggregate into `CopyResult[]`.
- Summary toast distinguishes full success, partial success
  ("Copied to 2 of 3 — failed: <name> (<reason>)"), and total failure.
- Guard against `destId === currentCalendarId` (also excluded from the picker).
- Destinations are the user's own calendars (`useCalendars`), so RLS/storage
  policies for same-user copy apply.

## Testing

- **Unit — amount recalc:** win / loss / breakeven × `risk_to_reward`
  present/absent × `partials_taken` × destination with/without `risk_per_trade`
  × dynamic-risk threshold crossed/not. Includes an explicit **loss-sign**
  assertion. Use the shared `src/test-utils/makeTrade.ts` fixture.
- **Unit — payload build:** asserts `source_trade_id` undefined,
  `is_synced_copy === false`, share fields cleared, `is_pinned`/`is_temporary`
  false, `calendar_id` = dest, and images re-keyed with new ids + dest
  `calendar_id`.
- **Component — `CopyTradeDialog`:** excludes current calendar from the list,
  Copy disabled until a selection, renders per-row status, surfaces a
  partial-failure summary.
- **Manual / integration:** copy a trade with an image into another calendar;
  delete the source trade; confirm the copy's image still resolves (true
  independence); confirm the destination's `year_stats` recomputed.

## Scale considerations

A copy is a manual action on one trade into a small number of calendars, so N is
small by nature. The only at-scale axis is responsiveness: the operation runs
off the main render with visible per-destination progress, and image
duplication uses storage-side `.copy()` (no download/reupload round-trip on the
happy path). No new at-scale failure mode is introduced.

## Open items resolved during design

- Scope: single trade only (no bulk) for v1.
- Destinations: multiple per action.
- PnL fallback: copy the original `$amount` when recalculation isn't possible
  (no warn).
- All-images-fail: create the trade without images and note it in the result.

## Post-review (2026-06-02)

A multi-agent adversarial review (6 dimensions → per-finding verification) found
**0 critical / 0 high**, 9 medium, 10 low confirmed (12 invalidated). All
correctness/robustness/a11y/reuse findings were fixed in commit
`fix(calendar): address copy-trade review findings`:

- re-read the source trade from the DB (guards against the "consistent risk"
  in-memory hypothetical amount being persisted into a destination)
- shared `amountFromRiskAmount` helper (no formula divergence between copy and
  the `useCalendarTrades` recalc)
- canonical destination image prefix + orphan cleanup on insert failure
- year_stats optimized amount path (dropped the full destination history read)
- `imagesOmitted` partial-failure signal + `warning`-severity snackbar for
  partial copy runs
- keyboard-operable destination rows (`FormControlLabel`) + aria-live list
- `primaryButtonSx` token + post-copy SWR refresh

**Deliberately deferred (with rationale):**

1. **Onward re-sync when a destination is itself a calendar-link source.**
   Inserting the copy fires the trades webhook, which (if the destination has
   `linked_to_calendar_id`) propagates it to the linked target. This is
   *consistent* with the calendar-link contract ("new trades in the source copy
   to the target") and was already flagged as accepted scope above. The
   suggested fix (a `skip_trade_webhook` SECURITY DEFINER RPC + explicit
   `year_stats` recompute) is a substantial backend change that would also
   change link semantics — not worth it for behavior that is arguably correct.
   Revisit only if product decides copies must never propagate.

2. **Client-side tier precheck before `storage.copy()`.** The storage RLS
   INSERT policy already gates image creation on paid tier, so a downgraded
   user's copy fails closed and is reported as "copied without images" (never a
   raw error). Adding a precheck would cost an extra `getUser` + `subscriptions`
   query on every copy run (the common paid case) to spare a rare edge case —
   a net pessimization. Skipped.

3. **Timeout/abort on a hung copy.** The dialog blocks close while copying.
   Wrapping each step in `Promise.race(timeout)` risks reporting a destination
   as failed while its insert later succeeds (Supabase calls can't be
   cancelled), producing a worse inconsistency. The Supabase client has its own
   network timeouts; left as-is.
