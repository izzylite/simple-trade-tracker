/**
 * Warmup AI Agent Edge Function
 * Cron job that pings the ai-trading-agent function every 4 minutes to prevent cold starts
 *
 * This function is invoked by Supabase cron scheduler to keep the AI agent warm
 * and maintain tool cache, ensuring fast response times for users
 */

import { corsHeaders, handleCors, log } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable not configured');
    }

    log('Starting warmup ping to ai-trading-agent', 'info');

    // Ping the AI agent with warmup header
    const warmupResponse = await fetch(`${supabaseUrl}/functions/v1/ai-trading-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Warmup': 'true',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`
      },
      body: JSON.stringify({})
    });

    if (!warmupResponse.ok) {
      const errorText = await warmupResponse.text();
      log(`Warmup ping failed: ${warmupResponse.status} - ${errorText}`, 'error');

      return new Response(
        JSON.stringify({
          success: false,
          error: `Warmup failed: ${warmupResponse.status}`,
          details: errorText,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const warmupData = await warmupResponse.json();
    log(`Warmup successful: ${JSON.stringify(warmupData)}`, 'info');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'AI agent warmed up successfully',
        agentResponse: warmupData,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    log(`Error in warmup function: ${error instanceof Error ? error.message : 'Unknown'}`, 'error', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
