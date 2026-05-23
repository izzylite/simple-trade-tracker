-- Track the last Paddle event timestamp processed for each subscription so
-- out-of-order webhook deliveries cannot overwrite newer state with stale state.
alter table public.subscriptions
  add column if not exists last_event_occurred_at timestamptz;

comment on column public.subscriptions.last_event_occurred_at is
  'Paddle event.occurred_at of the most recent webhook applied to this row. Webhook handlers MUST skip incoming events whose occurred_at is older than this value.';
