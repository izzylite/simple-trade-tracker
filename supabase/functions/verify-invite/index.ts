/**
 * Verify Invite Edge Function
 *
 * Validates invite codes before allowing user sign-up.
 * This function is called BEFORE authentication to check if an invite is valid.
 *
 * Request body:
 *   - inviteCode: string (required)
 *
 * Response:
 *   - valid: boolean
 *   - message?: string (error message if invalid)
 */

import {
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody,
  corsHeaders
} from '../_shared/supabase.ts';

interface VerifyInviteRequest {
  inviteCode: string;
}

interface VerifyInviteResponse {
  valid: boolean;
  message?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log('Verify invite request received', 'info');

    // Parse request body
    const payload = await parseJsonBody<VerifyInviteRequest>(req);
    if (!payload || !payload.inviteCode) {
      log('Missing inviteCode parameter', 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing inviteCode parameter'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { inviteCode } = payload;

    // Validate invite code format
    if (typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
      log('Invalid inviteCode format', 'warn');
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Invalid invite code format'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create service client (no auth required for verification)
    const supabase = createServiceClient();

    // Query invite link
    log(`Querying invite code: ${inviteCode}`, 'info');
    const { data: invite, error: inviteError } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', inviteCode.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (inviteError) {
      log('Database error querying invite', 'error', inviteError);
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Error verifying invite code'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!invite) {
      log('Invalid invite code - not found', 'warn', { code: inviteCode });
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Invalid or expired invite code'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      log('Invite code expired', 'warn', {
        code: inviteCode,
        expiresAt: invite.expires_at
      });

      // Mark as inactive
      await supabase
        .from('invite_links')
        .update({ is_active: false })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({
          valid: false,
          message: 'This invite code has expired'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check uses remaining
    if (invite.uses_remaining !== null && invite.uses_remaining <= 0) {
      log('Invite code exhausted', 'warn', {
        code: inviteCode,
        usesRemaining: invite.uses_remaining
      });

      // Mark as inactive
      await supabase
        .from('invite_links')
        .update({ is_active: false })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({
          valid: false,
          message: 'This invite code has been fully used'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Invite is valid!
    log('Valid invite code', 'info', { code: inviteCode });
    return new Response(
      JSON.stringify({
        valid: true,
        message: 'Invite code is valid'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    log('Unexpected error in verify-invite', 'error', error);
    return new Response(
      JSON.stringify({
        valid: false,
        message: 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
