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

    // ai-trading-agent runs with verify_jwt=true, so the gateway validates this
    // bearer as a JWT BEFORE the function's X-Warmup short-circuit runs. After
    // Supabase's API-key migration the two auto-injected candidates are unusable:
    //   - SUPABASE_ANON_KEY         → empty in this runtime
    //   - SUPABASE_SERVICE_ROLE_KEY → now sb_secret_* (non-JWT) → gateway
    //     rejects with UNAUTHORIZED_INVALID_JWT_FORMAT
    // The legacy anon key is still a valid gateway JWT, injected here under a
    // custom name (custom secrets ARE reliably injected). The anon key is public
    // by design (it ships in the frontend bundle), so this is not a secret leak —
    // it lives in a secret only to honor the repo's no-hardcoded-keys rule.
    // Set with: supabase secrets set WARMUP_BEARER_KEY=<project legacy anon key>
    const warmupKey = Deno.env.get('WARMUP_BEARER_KEY');
    if (!warmupKey) {
      throw new Error('WARMUP_BEARER_KEY not configured (set to the project legacy anon key)');
    }

    // Ping the AI agent with warmup header
    const warmupResponse = await fetch(`${supabaseUrl}/functions/v1/ai-trading-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Warmup': 'true',
        'Authorization': `Bearer ${warmupKey}`
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
