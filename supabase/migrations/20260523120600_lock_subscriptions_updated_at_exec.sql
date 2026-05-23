-- Defense in depth: trigger functions don't need client-side EXECUTE.
-- Closes the default-privilege gap left by Task 1.

revoke all on function public.subscriptions_set_updated_at() from public, anon, authenticated;
