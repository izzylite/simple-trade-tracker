# Handle Trade Changes Edge Function

Reacts to row changes on `public.trades` (INSERT / UPDATE / DELETE) and keeps
derived state in sync. It is invoked by a database webhook, not the frontend.

## What it does

1. **Image cleanup** — on UPDATE/DELETE, deletes trade images that are no longer
   referenced by any of that user's trades (cross-calendar safe via
   `canDeleteImage`). Best-effort; failures are logged, never thrown.
2. **Year-stats recompute** — recomputes `calendars.year_stats` for the affected
   calendar. Coalesced via `claim_year_stats_recompute` (≈5 s window) so a burst
   of writes doesn't storm the calendars row. A pg_cron sweep backstops any
   recompute the coalescer or a transient failure drops (see "Reliability").
3. **Linked-calendar sync** — one-way sync of a trade to a linked calendar within
   a 24 h window (`syncToLinkedCalendar`). The synced copy carries
   `is_synced_copy = true` / `source_trade_id` and is de-duplicated by the partial
   unique index `idx_trades_source_calendar_unique`.

It does **not** do tag synchronization (that lives in `update-tag` /
`bulk_update_tag_in_calendar`). Earlier versions of this doc claimed it did — it
doesn't.

## How it is wired (do NOT hand-create the trigger)

The live wiring is **`trigger_trade_changes → notify_trade_changes()`**
(`SECURITY DEFINER`), defined in `supabase/migrations/012_setup_webhooks.sql` and
hardened since:
- `20260518000000_*` — adds the `app.skip_trade_webhook` guard (bulk writes set it
  to suppress the per-row webhook) and `claim_year_stats_recompute` coalescing.
- `20260531225101_*` — **dropped** the legacy duplicate trigger
  `trade_changes_trigger → handle_trade_changes()`, which fired this same function
  a second time per write (2× image cleanup / 2× sync / 2× cost, and bypassed the
  skip flag). It now fires **once** per write.
- `<auth-gate migration>` — `notify_trade_changes()` sends the shared-secret header
  (below).

> **⚠️ Name collision.** The DB trigger function is **`notify_trade_changes`** —
> NOT a same-named `handle_trade_changes()`. A legacy `handle_trade_changes()` DB
> function (named to mirror this edge function's slug) was the duplicate dropped on
> 2026-05-31; do not recreate it. The edge function (this directory,
> `handle-trade-changes`) and the DB trigger function are different things.

## Auth

Deployed `verify_jwt = false` (a DB webhook can't present a user JWT), so the
function authenticates itself with a **shared secret**, mirroring `paddle-webhook`
and `dispatch-reminders`:

- `notify_trade_changes()` reads `trade_webhook_secret` from `vault.decrypted_secrets`
  and sends it as the `X-Trade-Webhook-Secret` header.
- The function compares it (constant-time) against `Deno.env.get('TRADE_WEBHOOK_SECRET')`
  and returns `401` on missing/mismatch before doing any work.

Both copies of the secret (Vault for the trigger, edge env for the function) must
hold the same value.

As defense in depth, the function derives `user_id` from the calendar row
(`calendars.user_id`) rather than trusting the request body.

## Reliability — year-stats reconciliation

Because the webhook is fire-and-forget (pg_net, no retry) and the recompute is
coalesced, the last write in a burst or a transient recompute failure can leave
`year_stats` stale. A pg_cron job (`year-stats-sweep`, via
`reconcile-year-stats`) periodically recomputes any calendar where
`MAX(trades.updated_at) > year_stats_last_recomputed_at`, covering both the source
and any linked calendar. So `year_stats` is **eventually consistent**, not
transactional.

## Request format

```typescript
{
  table: 'trades',
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  old_record?: Trade,   // present for UPDATE and DELETE
  new_record?: Trade,   // present for INSERT and UPDATE
  calendar_id?: string,
  user_id?: string,
}
```

## Environment variables

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — service-role DB/Storage access.
- `TRADE_WEBHOOK_SECRET` — shared secret matching the Vault `trade_webhook_secret`.

## Deploy

```bash
supabase functions deploy handle-trade-changes
```
