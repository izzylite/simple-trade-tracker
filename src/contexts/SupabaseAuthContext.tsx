/**
 * Supabase Auth Context
 * Provides authentication state and methods using Supabase Auth
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseAuthService, type SupabaseUser, type AuthState } from '../services/supabaseAuthService';
import { logger } from '../utils/logger';

interface SupabaseAuthContextType {
  user: SupabaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
  ensureValidSession: () => Promise<boolean>;
}



const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() =>
    supabaseAuthService.getCurrentAuthState()
  );

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = supabaseAuthService.onAuthStateChange((newAuthState) => {
      setAuthState(newAuthState);
    });

    return unsubscribe;
  }, []);


  const signInWithGoogle = async () => {
    try {
      await supabaseAuthService.signInWithGoogle();
    } catch (error) {
      logger.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await supabaseAuthService.signInWithEmail(email, password);
    } catch (error) {
      logger.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    try {
      await supabaseAuthService.signUpWithEmail(email, password, displayName);
    } catch (error) {
      logger.error('Error signing up with email:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabaseAuthService.signOut();
    } catch (error) {
      logger.error('Error signing out:', error);
      throw error;
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      await supabaseAuthService.requestPasswordReset(email);
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await supabaseAuthService.updatePassword(newPassword);
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  };

  const getAccessToken = async () => {
    try {
      return await supabaseAuthService.getAccessToken();
    } catch (error) {
      logger.error('Error getting access token:', error);
      return null;
    }
  };

  const refreshSession = async () => {
    try {
      await supabaseAuthService.refreshSession();
    } catch (error) {
      logger.error('Error refreshing session:', error);
      throw error;
    }
  };

  const ensureValidSession = async () => {
    try {
      return await supabaseAuthService.ensureValidSession();
    } catch (error) {
      logger.error('Error ensuring valid session:', error);
      return false;
    }
  };

  const value: SupabaseAuthContextType = {
    user: authState.user,
    loading: authState.loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    requestPasswordReset,
    updatePassword,
    isAuthenticated: supabaseAuthService.isAuthenticated(),
    getAccessToken,
    refreshSession,
    ensureValidSession,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

// Export useAuth as an alias for useSupabaseAuth for backward compatibility
export const useAuth = useSupabaseAuth;

// Export AuthProvider as an alias for SupabaseAuthProvider
export const AuthProvider = SupabaseAuthProvider;
