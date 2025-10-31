/**
 * Supabase Authentication Service
 * Handles user authentication using Supabase Auth with Google OAuth
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { userMigrationService } from './userMigrationService';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface SupabaseUser {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  provider: string;
  firebaseUid?: string; // For migration compatibility
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
      supabase.auth.onAuthStateChange(async (event, session) => {
        logger.info('Auth state changed:', event);

        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              await this.handleUserSignIn(session.user, session);
            }
            break;

          case 'SIGNED_OUT':
            logger.info('User signed out, clearing auth state');
            this.updateAuthState(null);
            break;

          case 'TOKEN_REFRESHED':
            // Token was automatically refreshed by Supabase
            logger.info('Access token refreshed successfully');
            if (session) {
              this.updateAuthState(session);
            }
            break;

          case 'USER_UPDATED':
            // User metadata or email was updated
            logger.info('User profile updated');
            if (session) {
              this.updateAuthState(session);
            }
            break;

          case 'PASSWORD_RECOVERY':
            // User clicked password recovery link
            logger.info('Password recovery event received');
            this.updateAuthState(session);
            break;

          case 'INITIAL_SESSION':
            // Initial session loaded on page load
            logger.info('Initial session loaded');
            this.updateAuthState(session);
            break;

          default:
            // Handle any other events
            logger.info('Unhandled auth event:', event);
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

      // Handle user migration if needed
      const migrationResult = await userMigrationService.handleUserSignIn(
        user.id,
        user.email!,
        displayName
      );

      // Create or update user in our users table
      // Note: This will work because we added the INSERT policy for users
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          firebase_uid: user.id, // Use Supabase user ID as firebase_uid for now
          email: user.email!,
          display_name: displayName,
          photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          provider: user.app_metadata?.provider || 'google',
          last_login: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'firebase_uid'
        });

      if (upsertError) {
        logger.error('Error upserting user:', upsertError);
        // Don't throw error - continue with auth even if user record creation fails
        logger.warn('Continuing with authentication despite user record creation failure');
      } else {
        logger.info('User upserted successfully');

        // Log migration status
        if (migrationResult.migrated) {
          logger.info(`User migration completed for ${user.email}`);
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
      email: user.email!,
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
      photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      provider: user.app_metadata?.provider || 'google',
      firebaseUid: user.id // For migration compatibility
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
}

// Create singleton instance
export const supabaseAuthService = new SupabaseAuthService();

// Export types
export type { User as SupabaseAuthUser, Session as SupabaseSession, AuthError };
