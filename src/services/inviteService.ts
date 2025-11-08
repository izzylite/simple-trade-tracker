/**
 * Invite Service
 * Handles invite code verification and consumption via Supabase Edge Functions
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { supabaseAuthService } from './supabaseAuthService';
import type {
  InviteVerificationResult,
  InviteConsumptionResult,
  VerifyInviteRequest,
  ConsumeInviteRequest
} from '../types/invite';

class InviteService {
  /**
   * Verify an invite code before sign-up
   * This can be called without authentication
   *
   * @param inviteCode - The invite code to verify
   * @returns Promise with verification result
   */
  async verifyInviteCode(inviteCode: string): Promise<InviteVerificationResult> {
    try {
      logger.info('Verifying invite code:', inviteCode);

      // Validate input
      if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
        logger.warn('Invalid invite code format');
        return {
          valid: false,
          message: 'Please enter a valid invite code'
        };
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke<InviteVerificationResult>(
        'verify-invite',
        {
          body: { inviteCode: inviteCode.trim() } as VerifyInviteRequest
        }
      );

      if (error) {
        logger.error('Error calling verify-invite function:', error);
        return {
          valid: false,
          message: 'Failed to verify invite code. Please try again.'
        };
      }

      if (!data) {
        logger.error('No data returned from verify-invite function');
        return {
          valid: false,
          message: 'Invalid response from server. Please try again.'
        };
      }

      logger.info('Invite verification result:', data);
      return data;

    } catch (error) {
      logger.error('Exception verifying invite code:', error);
      return {
        valid: false,
        message: 'An unexpected error occurred while verifying the invite code.'
      };
    }
  }

  /**
   * Consume an invite code after successful sign-up
   * This requires the user to be authenticated
   *
   * @param inviteCode - The invite code to consume
   * @returns Promise with consumption result
   */
  async consumeInviteCode(inviteCode: string): Promise<InviteConsumptionResult> {
    try {
      logger.info('Consuming invite code:', inviteCode);

      // Validate input
      if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
        logger.warn('Invalid invite code format for consumption');
        return {
          success: false,
          message: 'Invalid invite code format'
        };
      }

      // Get access token for authenticated request
      const token = await supabaseAuthService.getAccessToken();
      if (!token) {
        logger.error('No access token available for consuming invite');
        return {
          success: false,
          error: 'Authentication required to consume invite code'
        };
      }

      // Call edge function with authentication
      const { data, error } = await supabase.functions.invoke<InviteConsumptionResult>(
        'consume-invite',
        {
          body: { inviteCode: inviteCode.trim() } as ConsumeInviteRequest,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (error) {
        logger.error('Error calling consume-invite function:', error);
        return {
          success: false,
          error: 'Failed to consume invite code'
        };
      }

      if (!data) {
        logger.error('No data returned from consume-invite function');
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }

      logger.info('Invite consumption result:', data);
      return data;

    } catch (error) {
      logger.error('Exception consuming invite code:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while consuming the invite code'
      };
    }
  }

  /**
   * Verify and prepare invite for use
   * Convenience method that validates format and checks with server
   *
   * @param inviteCode - The invite code to validate
   * @returns Promise with validation result
   */
  async validateInviteCode(inviteCode: string): Promise<{
    isValid: boolean;
    errorMessage?: string;
  }> {
    // Check format first
    if (!inviteCode || inviteCode.trim().length === 0) {
      return {
        isValid: false,
        errorMessage: 'Invite code is required'
      };
    }

    // Check against allowed characters
    const validCodePattern = /^[A-Za-z0-9_-]+$/;
    if (!validCodePattern.test(inviteCode.trim())) {
      return {
        isValid: false,
        errorMessage: 'Invite code contains invalid characters'
      };
    }

    // Verify with server
    const result = await this.verifyInviteCode(inviteCode);
    return {
      isValid: result.valid,
      errorMessage: result.valid ? undefined : result.message
    };
  }
}

// Export singleton instance
export const inviteService = new InviteService();
