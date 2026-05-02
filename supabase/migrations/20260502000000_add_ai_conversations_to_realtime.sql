-- Add ai_conversations to the realtime publication so the client can
-- receive postgres_changes for reminder-fired messages and other
-- backend-driven appends to messages JSONB. Without this, the in-app
-- chat panel doesn't see reminder replies until the user reloads.
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
