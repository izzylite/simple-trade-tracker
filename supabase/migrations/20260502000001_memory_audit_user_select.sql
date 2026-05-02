-- Allow users to read their own memory audit rows.
-- The table was created with RLS enabled but no SELECT policy (service-role only).
-- This mirrors the pattern on agent_memory_events which has the same scope.
CREATE POLICY "Users can view their own memory audit"
  ON public.memory_audit FOR SELECT
  USING (user_id = auth.uid());
