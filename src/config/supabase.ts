/**
 * Supabase Configuration
 * Vector database setup for AI chat enhancement
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Environment variables validation
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Missing Supabase environment variables. Please check your .env file.');
  throw new Error('Supabase configuration is incomplete');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We'll use Firebase for auth
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
});

// Database table names
export const SUPABASE_TABLES = {
  TRADE_EMBEDDINGS: 'trade_embeddings',
  EMBEDDING_METADATA: 'embedding_metadata',
} as const;

// Vector similarity search configuration
export const VECTOR_CONFIG = {
  EMBEDDING_DIMENSION: 384, // all-MiniLM-L6-v2 dimension
  SIMILARITY_THRESHOLD: 0.3, // Minimum similarity score (lowered after migration testing)
  MAX_RESULTS: 20, // Maximum results to return
} as const;

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // Try to access our trade_embeddings table (which we know exists)
    const { data, error } = await supabase
      .from('trade_embeddings')
      .select('count', { count: 'exact', head: true });

    if (error) {
      logger.error('Supabase connection test failed:', error);
      return false;
    }

    logger.log('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    return false;
  }
}
