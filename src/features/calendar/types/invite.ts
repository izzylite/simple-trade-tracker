/**
 * TypeScript types for the invite link verification system
 */

/**
 * Invite Link Database Record
 * Represents a row in the invite_links table
 */
export interface InviteLink {
  /** Unique identifier (UUID) */
  id: string;

  /** Unique invite code (alphanumeric, dash, underscore) */
  code: string;

  /** User ID who created this invite (references auth.users.id) */
  created_by: string | null;

  /** Number of uses remaining (null = unlimited) */
  uses_remaining: number | null;

  /** Maximum allowed uses (null = unlimited) */
  max_uses: number | null;

  /** Number of times this invite has been used */
  used_count: number;

  /** Whether the invite is currently active */
  is_active: boolean;

  /** When the invite expires (null = never expires) */
  expires_at: string | null;

  /** When the invite was created */
  created_at: string;

  /** When the invite was last used */
  last_used_at: string | null;

  /** Array of user IDs who have used this invite */
  used_by_users: string[];
}

/**
 * Result from invite verification
 */
export interface InviteVerificationResult {
  /** Whether the invite is valid and can be used */
  valid: boolean;

  /** Message explaining why the invite is invalid (if applicable) */
  message?: string;
}

/**
 * Result from invite consumption
 */
export interface InviteConsumptionResult {
  /** Whether the invite was successfully consumed */
  success: boolean;

  /** Message about the consumption result */
  message?: string;

  /** Error message if consumption failed */
  error?: string;
}

/**
 * Request payload for verifying an invite
 */
export interface VerifyInviteRequest {
  /** The invite code to verify */
  inviteCode: string;
}

/**
 * Request payload for consuming an invite
 */
export interface ConsumeInviteRequest {
  /** The invite code to consume */
  inviteCode: string;
}

/**
 * Statistics about invite usage
 */
export interface InviteStats {
  /** Total number of invites created */
  totalCreated: number;

  /** Number of active invites */
  activeCount: number;

  /** Number of expired invites */
  expiredCount: number;

  /** Number of exhausted invites */
  exhaustedCount: number;

  /** Total number of sign-ups from invites */
  totalSignups: number;
}
