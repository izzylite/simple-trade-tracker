-- Function: returns total bytes used by the calling user in the trade-images
-- bucket (holds both trade-images/ and note-images/ subpaths per Task 10).
-- Used by the client to enforce the 10 GB tier cap before upload.
-- Scoped by auth.uid() so callers cannot inspect another user's storage.

create or replace function public.user_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
    from storage.objects
    where bucket_id = 'trade-images'
      and (name like ('users/' || auth.uid()::text || '/trade-images/%')
        or name like ('users/' || auth.uid()::text || '/note-images/%'));
$$;

revoke all on function public.user_storage_bytes() from public;
revoke execute on function public.user_storage_bytes() from anon, service_role;
grant execute on function public.user_storage_bytes() to authenticated;
