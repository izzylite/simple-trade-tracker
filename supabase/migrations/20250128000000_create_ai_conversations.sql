-- Create ai_conversations table for storing AI chat conversation history
-- Each conversation belongs to a calendar and contains an array of messages

CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT ai_conversations_title_length CHECK (char_length(title) <= 100),
    CONSTRAINT ai_conversations_message_count_check CHECK (message_count >= 0 AND message_count <= 50),
    CONSTRAINT ai_conversations_messages_is_array CHECK (jsonb_typeof(messages) = 'array')
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_calendar_id ON public.ai_conversations(calendar_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON public.ai_conversations(updated_at DESC);

-- Create composite index for common query pattern (user's conversations for a calendar)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_calendar ON public.ai_conversations(user_id, calendar_id, updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;

-- RLS Policies: Users can only access their own conversations
-- Note: user_id in ai_conversations matches the id in users table, which is the same as auth.uid()
CREATE POLICY "Users can view their own conversations"
    ON public.ai_conversations
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own conversations"
    ON public.ai_conversations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
    ON public.ai_conversations
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations"
    ON public.ai_conversations
    FOR DELETE
    USING (user_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at_trigger ON public.ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at_trigger
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ai_conversations_updated_at();

-- Add comment to table
COMMENT ON TABLE public.ai_conversations IS 'Stores AI chat conversation history for each calendar. Conversations are automatically deleted when the parent calendar is deleted (CASCADE).';
COMMENT ON COLUMN public.ai_conversations.title IS 'Auto-generated from first user message (max 100 chars) or "Conversation on [date]"';
COMMENT ON COLUMN public.ai_conversations.messages IS 'JSONB array of ChatMessage objects with role, content, timestamp, etc.';
COMMENT ON COLUMN public.ai_conversations.message_count IS 'Total number of messages in the conversation (max 50)';

