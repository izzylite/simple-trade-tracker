-- Revoke Supabase's default-privilege EXECUTE grants on increment_orion_tokens
-- so only service_role (and the owning postgres role) can call it. The function
-- is SECURITY DEFINER + takes p_user_id as input with no auth.uid() check, so
-- client-callable EXECUTE would let any signed-in user inflate any other
-- user's token counter.

revoke all on function public.increment_orion_tokens(uuid, bigint) from anon, authenticated;
