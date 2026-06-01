-- Revoke EXECUTE from anon on append_conversation_message.
-- Supabase auto-grants EXECUTE to both anon and authenticated when a function
-- is created; REVOKE ALL FROM PUBLIC in the create migration does not cover
-- these explicit role grants. Anon callers have no valid user_id and cannot
-- match any row, but defence-in-depth: deny them the call entirely.
REVOKE EXECUTE
  ON FUNCTION public.append_conversation_message(uuid, uuid, jsonb, integer, integer, text)
  FROM anon;
