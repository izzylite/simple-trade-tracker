-- Supabase Vector Database Schema for Trade Tracker
-- Run this SQL in your Supabase SQL Editor

-- Enable the pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create trade_embeddings table
CREATE TABLE IF NOT EXISTS trade_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Trade identification
  trade_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Trade metadata for quick filtering
  trade_type TEXT NOT NULL CHECK (trade_type IN ('win', 'loss', 'breakeven')),
  trade_amount DECIMAL NOT NULL,
  trade_date TIMESTAMP WITH TIME ZONE NOT NULL,
  trade_session TEXT,
  
  -- Tags for filtering
  tags TEXT[] DEFAULT '{}',
  
  -- Vector embedding (384 dimensions for all-MiniLM-L6-v2)
  embedding vector(384) NOT NULL,
  
  -- Content that was embedded
  embedded_content TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  UNIQUE(trade_id, calendar_id, user_id)
);

-- Create embedding_metadata table for tracking embedding generation
CREATE TABLE IF NOT EXISTS embedding_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and calendar info
  user_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  
  -- Embedding model info
  model_name TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  model_version TEXT NOT NULL DEFAULT 'v1',
  
  -- Statistics
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_embeddings INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(user_id, calendar_id, model_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_embeddings_user_calendar 
  ON trade_embeddings(user_id, calendar_id);

CREATE INDEX IF NOT EXISTS idx_trade_embeddings_trade_type 
  ON trade_embeddings(trade_type);

CREATE INDEX IF NOT EXISTS idx_trade_embeddings_trade_date 
  ON trade_embeddings(trade_date);

CREATE INDEX IF NOT EXISTS idx_trade_embeddings_tags 
  ON trade_embeddings USING GIN(tags);

-- Create vector similarity search index (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_trade_embeddings_vector 
  ON trade_embeddings USING hnsw (embedding vector_cosine_ops);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_trades(
  query_embedding vector(384),
  user_id_param TEXT,
  calendar_id_param TEXT,
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  trade_id TEXT,
  similarity FLOAT,
  trade_type TEXT,
  trade_amount DECIMAL,
  trade_date TIMESTAMP WITH TIME ZONE,
  trade_session TEXT,
  tags TEXT[],
  embedded_content TEXT
) 
LANGUAGE sql STABLE
AS $$
  SELECT 
    te.trade_id,
    1 - (te.embedding <=> query_embedding) as similarity,
    te.trade_type,
    te.trade_amount,
    te.trade_date,
    te.trade_session,
    te.tags,
    te.embedded_content
  FROM trade_embeddings te
  WHERE 
    te.user_id = user_id_param 
    AND te.calendar_id = calendar_id_param
    AND 1 - (te.embedding <=> query_embedding) > similarity_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT max_results;
$$;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_trade_embeddings_updated_at 
  BEFORE UPDATE ON trade_embeddings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_embedding_metadata_updated_at 
  BEFORE UPDATE ON embedding_metadata 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your security requirements)
-- These are for the authenticated role that Supabase uses
ALTER TABLE trade_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY "Users can view their own trade embeddings" ON trade_embeddings
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own trade embeddings" ON trade_embeddings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own trade embeddings" ON trade_embeddings
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own trade embeddings" ON trade_embeddings
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own embedding metadata" ON embedding_metadata
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own embedding metadata" ON embedding_metadata
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own embedding metadata" ON embedding_metadata
  FOR UPDATE USING (auth.uid()::text = user_id);
