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

// Create Supabase client with standard configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'cotex-journel',
    },
  },
});

// Export the URL for use in other services
export { supabaseUrl };
 

 
