/**
 * Supabase Authentication Service
 * Handles user authentication using Supabase Auth with Google OAuth
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger'; 
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface SupabaseUser {
  id: string;
  uid: string; // Alias for id to maintain backward compatibility
  email: string;
  displayName: string | null;
  photoURL: string | null;
  provider: string;
}

export interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
}

class SupabaseAuthService {
  private authStateListeners: ((authState: AuthState) => void)[] = [];
  private currentAuthState: AuthState = {
    user: null,
    session: null,
    loading: true
  };

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication and set up session listener
   */
  private async initializeAuth() {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('Error getting initial session:', error);
      }

      // Update auth state
      this.updateAuthState(session);

      // Listen for auth changes
      // Following Supabase best practices for handling all auth events
      // IMPORTANT: Using setTimeout for async operations to prevent deadlock when switching browser tabs
      // See: https://github.com/orgs/supabase/discussions/19058
      supabase.auth.onAuthStateChange((event, session) => {
        logger.info('Auth state changed:', event);

        // Update auth state immediately (synchronously) to prevent UI delays
        // Only defer async database operations to prevent deadlock
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              // Update auth state immediately
              this.updateAuthState(session);
              // Defer async database operations
              setTimeout(async () => {
                await this.handleUserSignIn(session.user, session);
              }, 0);
            }
            break;

          case 'SIGNED_OUT':
            this.updateAuthState(null);
            break;

          case 'TOKEN_REFRESHED':
            // Token was automatically refreshed by Supabase
            if (session) {
              this.updateAuthState(session);
            }
            break;

          case 'USER_UPDATED':
            // User metadata or email was updated
            if (session) {
              this.updateAuthState(session);
            }
            break;

          case 'PASSWORD_RECOVERY':
            // User clicked password recovery link
            this.updateAuthState(session);
            break;

          case 'INITIAL_SESSION':
            // Initial session loaded on page load
            this.updateAuthState(session);
            break;

          default:
            // Handle any other events
            this.updateAuthState(session);
        }
      });

    } catch (error) {
      logger.error('Error initializing auth:', error);
      this.updateAuthState(null);
    }
  }




  /**
   * Handle user sign-in and create/update user record
   */
  private async handleUserSignIn(user: User, session: Session) {
    try {
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || null;

      // Check if user already exists (to determine if this is a new signup)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      const isNewUser = !existingUser;

      

      // Determine auth provider
      const provider = user.app_metadata?.provider || 'email';

      // Create or update user in our users table
      // Note: This will work because we added the INSERT policy for users
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id, // Supabase Auth user ID
          email: user.email!,
          display_name: displayName,
          photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          provider: provider,
          last_login: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        logger.error('Error upserting user:', upsertError);
        // Don't throw error - continue with auth even if user record creation fails
        logger.warn('Continuing with authentication despite user record creation failure');
      } else {
        logger.info('User upserted successfully');

       

        // Consume pending invite code if this is a new user
        if (isNewUser) {
          const pendingInviteCode = localStorage.getItem('pendingInviteCode');
          if (pendingInviteCode) {
            logger.info('New user detected, consuming pending invite code');
            try {
              // Import inviteService dynamically to avoid circular dependency
              const { inviteService } = await import('./inviteService');
              await inviteService.consumeInviteCode(pendingInviteCode);
              localStorage.removeItem('pendingInviteCode');
              logger.info('Invite code consumed successfully for new user');
            } catch (inviteError) {
              logger.error('Failed to consume invite code:', inviteError);
              // Don't fail the authentication, just log the error
            }
          }
        } else {
          // Existing user - remove any pending invite code
          localStorage.removeItem('pendingInviteCode');
          logger.info('Existing user signed in, clearing any pending invite code');
        }
      }

      this.updateAuthState(session);
    } catch (error) {
      logger.error('Error handling user sign-in:', error);
      // Continue with auth state update even if user creation fails
      this.updateAuthState(session);
    }
  }

  /**
   * Update auth state and notify listeners
   */
  private updateAuthState(session: Session | null) {
    const user = session?.user ? this.mapSupabaseUser(session.user) : null;
    
    this.currentAuthState = {
      user,
      session,
      loading: false
    };

    // Notify all listeners
    this.authStateListeners.forEach(listener => {
      listener(this.currentAuthState);
    });
  }

  /**
   * Map Supabase user to our user interface
   */
  private mapSupabaseUser(user: User): SupabaseUser {
    return {
      id: user.id,
      uid: user.id, // Alias for backward compatibility
      email: user.email!,
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || null,
      photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      provider: user.app_metadata?.provider || 'email'
    };
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<void> {
    try {
      logger.info('Starting Google OAuth sign-in...');
      logger.info('Redirect URL will be:', `${window.location.origin}/auth/callback`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false
        }
      });

      if (error) {
        logger.error('Error signing in with Google:', error);
        throw error;
      }

      logger.info('OAuth redirect initiated successfully');
      logger.info('OAuth data:', data);
    } catch (error) {
      logger.error('Google sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   * Creates a new user account with email/password authentication
   *
   * @param email - User's email address
   * @param password - User's password (minimum 8 characters)
   * @param displayName - Optional display name for the user
   * @throws {AuthError} If sign-up fails
   */
  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> {
    try {
      logger.info('Starting email/password sign-up for:', email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || null,
            full_name: displayName || null
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        logger.error('Error signing up with email:', error);
        throw error;
      }

      if (data.user) {
        logger.info('Email sign-up successful, user created:', data.user.id);

        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          logger.info('Email confirmation required - check inbox');
        } else {
          logger.info('User signed up and logged in immediately');
        }
      }
    } catch (error) {
      logger.error('Email sign-up failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   * Authenticates an existing user with email/password credentials
   *
   * @param email - User's email address
   * @param password - User's password
   * @throws {AuthError} If sign-in fails
   */
  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      logger.info('Starting email/password sign-in for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Error signing in with email:', error);
        throw error;
      }

      if (data.session) {
        logger.info('Email sign-in successful');
        // The session will be handled by the onAuthStateChange listener
      }
    } catch (error) {
      logger.error('Email sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Request password reset email
   * Sends a password reset link to the user's email address
   *
   * @param email - User's email address
   * @throws {AuthError} If request fails
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      logger.info('Requesting password reset for:', email);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        logger.error('Error requesting password reset:', error);
        throw error;
      }

      logger.info('Password reset email sent successfully');
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * Updates the password for the currently authenticated user
   * This should be called after user clicks the reset link in their email
   *
   * @param newPassword - New password (minimum 8 characters)
   * @throws {AuthError} If update fails
   */
  async updatePassword(newPassword: string): Promise<void> {
    try {
      logger.info('Updating user password');

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        logger.error('Error updating password:', error);
        throw error;
      }

      logger.info('Password updated successfully');
    } catch (error) {
      logger.error('Password update failed:', error);
      throw error;
    }
  }

  /**
   * Get current auth state
   */
  getCurrentAuthState(): AuthState {
    return this.currentAuthState;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (authState: AuthState) => void): () => void {
    this.authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current user
   */
  getCurrentUser(): SupabaseUser | null {
    return this.currentAuthState.user;
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentAuthState.session;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentAuthState.user && !!this.currentAuthState.session;
  }

  /**
   * Get access token for API calls
   *
   * Uses getUser() to validate the JWT with the Supabase Auth server
   * before returning the token. This ensures the token is valid and hasn't
   * been tampered with.
   *
   * Note: While getSession() is acceptable for client-side SPAs, using getUser()
   * provides an extra layer of security by validating the JWT server-side.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      // First validate the user's JWT with the Auth server
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        logger.error('Error validating user for token:', userError);
        return null;
      }

      // After validation, get the session to retrieve the access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error('Error getting session for token:', sessionError);
        return null;
      }

      return session?.access_token || null;
    } catch (error) {
      logger.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Refresh current session
   */
  async refreshSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('Error refreshing session:', error);
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Session refresh failed:', error);
      return null;
    }
  }

  /**
   * Ensure session is valid before performing operations
   * Call this before database queries to ensure auth is ready
   */
  async ensureValidSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('Error checking session validity:', error);
        return false;
      }

      if (!session) {
        return false;
      }

      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
      const now = new Date();

      if (!expiresAt) {
        return true; // Allow operation if no expiry time
      }

      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      if (timeUntilExpiry <= 0) {
        const refreshedSession = await this.refreshSession();
        return !!refreshedSession;
      }

      return true;
    } catch (error) {
      logger.error('Error ensuring valid session:', error);
      return false;
    }
  }
}

// Create singleton instance
export const supabaseAuthService = new SupabaseAuthService();

// Export types
export type { User as SupabaseAuthUser, Session as SupabaseSession, AuthError };
