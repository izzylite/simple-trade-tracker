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
// Following official Supabase documentation patterns
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Enable session persistence for Supabase Auth
    autoRefreshToken: true, // Enable automatic token refresh
    detectSessionInUrl: true, // Detect auth session from URL (for OAuth redirects)
    flowType: 'implicit', // Use implicit flow for OAuth (better for web apps)
  },
  db: {
    schema: 'public',
  },
});
 

 
