-- Storage gate: free-tier users cannot upload new images. Existing uploads
-- (uploaded while previously paid) remain readable since SELECT policies
-- are untouched. SELECT/UPDATE/DELETE policies are also unchanged, so
-- downgraded users keep read access and can still delete their own files.

-- Drop the existing INSERT policy. The actual policy name is
-- "Users can upload to their own folder" (verified via pg_policies).
drop policy if exists "Users can upload to their own folder" on storage.objects;

-- Recreate it with a paid-tier guard. The path-match logic is copied
-- verbatim from the dropped policy (LIKE on 'users/<uid>/trade-images/%'
-- OR 'users/<uid>/note-images/%') so existing upload code paths
-- continue to work for paid users.
--
-- The tier/status check mirrors _shared/tierEnforcement.ts:
--   - active / trialing / past_due → allowed
--   - cancelled → allowed only while current_period_end > now() (grace)
create policy "Users can upload to their own folder if paid"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trade-images'
    and (
      name like ('users/' || auth.uid()::text || '/trade-images/%')
      or name like ('users/' || auth.uid()::text || '/note-images/%')
    )
    and exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid()
        and s.tier in ('lite', 'pro', 'elite')
        and (
          s.status in ('active', 'trialing', 'past_due')
          or (s.status = 'cancelled' and s.current_period_end > now())
        )
    )
  );
