/**
 * Shared Supabase utilities for Edge Functions
 * Common database operations, authentication, and error handling
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for better type safety
export interface AuthenticatedRequest {
  user: {
    id: string
    email?: string
  }
  supabase: ReturnType<typeof createClient>
}

export interface EdgeFunctionResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

/**
 * Create authenticated Supabase client from request
 */
export async function createAuthenticatedClient(req: Request): Promise<AuthenticatedRequest | null> {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    return null
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader }
      }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return { user, supabase }
}

/**
 * Create service role Supabase client (for background tasks)
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  )
}

/**
 * Standard success response
 */
export function successResponse(data: any, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message && { message })
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  )
}

/**
 * CORS headers for Edge Functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stream',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): string[] {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  const missing = required.filter(key => !Deno.env.get(key))
  return missing
}

/**
 * Log with timestamp and function context
 */
export function log(message: string, level: 'info' | 'error' | 'warn' = 'info', context?: any) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message.toUpperCase()}: ${message}`
  
  if (context) {
    console[level](logMessage, context)
  } else {
    console[level](logMessage)
  }
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T = any>(req: Request): Promise<T | null> {
  try {
    return await req.json()
  } catch (error) {
    log('Failed to parse JSON body', 'error', error)
    return null
  }
}

/**
 * Database transaction wrapper
 */
export async function withTransaction<T>(
  supabase: ReturnType<typeof createClient>,
  callback: (client: ReturnType<typeof createClient>) => Promise<T>
): Promise<T> {
  // Note: Supabase doesn't have explicit transaction API like Firestore
  // We'll implement this as a wrapper for future transaction support
  return await callback(supabase)
}
