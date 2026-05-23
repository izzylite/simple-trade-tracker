-- Revert Task 11: paid tier image uploads are unlimited. The `user_storage_bytes()`
-- helper is dropped because nothing else uses it. Fair-use is governed by TOS,
-- and outlier abuse can be addressed via Supabase storage analytics case-by-case
-- rather than a hard code-level cap.

drop function if exists public.user_storage_bytes();
