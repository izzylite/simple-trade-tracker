/**
 * Consume Invite Edge Function
 *
 * Called after successful sign-up to decrement uses and track user.
 * This function requires authentication (user must be signed in).
 *
 * Request body:
 *   - inviteCode: string (required)
 *
 * Response:
 *   - success: boolean
 *   - message: string
 */

import {
  createAuthenticatedClient,
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody,
  corsHeaders
} from '../_shared/supabase.ts';

interface ConsumeInviteRequest {
  inviteCode: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log('Consume invite request received', 'info');

    // Authenticate user
    const authClient = await createAuthenticatedClient(req);
    if (!authClient) {
      log('Unauthorized request - no valid auth token', 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { user } = authClient;

    // Parse request body
    const payload = await parseJsonBody<ConsumeInviteRequest>(req);
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

    // Use service client for database operations (bypasses RLS)
    const supabase = createServiceClient();

    // Get invite link
    log(`Consuming invite code for user ${user.id}: ${inviteCode}`, 'info');
    const { data: invite, error: inviteError } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', inviteCode.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (inviteError) {
      log('Database error fetching invite', 'error', inviteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching invite code'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!invite) {
      log('Invalid invite code - not found or inactive', 'warn', {
        code: inviteCode
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid invite code'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user already used this invite
    const usedByUsers = invite.used_by_users || [];
    if (usedByUsers.includes(user.id)) {
      log('User already consumed this invite', 'warn', {
        userId: user.id,
        code: inviteCode
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invite already consumed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build update object
    const updates: Record<string, any> = {
      used_count: (invite.used_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      used_by_users: [...usedByUsers, user.id]
    };

    // Decrement uses_remaining if not unlimited
    if (invite.uses_remaining !== null) {
      updates.uses_remaining = invite.uses_remaining - 1;

      // Deactivate if exhausted
      if (updates.uses_remaining <= 0) {
        updates.is_active = false;
        log('Invite exhausted - marking as inactive', 'info', {
          code: inviteCode
        });
      }
    }

    // Update invite link
    const { error: updateError } = await supabase
      .from('invite_links')
      .update(updates)
      .eq('id', invite.id);

    if (updateError) {
      log('Error updating invite link', 'error', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to consume invite'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update user record with invite code used
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ invite_code_used: inviteCode.trim() })
      .eq('id', user.id);

    if (userUpdateError) {
      log('Error updating user invite_code_used', 'warn', userUpdateError);
      // Don't fail the request, just log the warning
    }

    log('Invite consumed successfully', 'info', {
      userId: user.id,
      code: inviteCode,
      usesRemaining: updates.uses_remaining
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invite consumed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    log('Unexpected error in consume-invite', 'error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
