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
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

// Firebase-compatible interface for easy migration
interface FirebaseCompatibleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface FirebaseCompatibleAuthContextType {
  user: FirebaseCompatibleUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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

  const signOut = async () => {
    try {
      await supabaseAuthService.signOut();
    } catch (error) {
      logger.error('Error signing out:', error);
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

  const value: SupabaseAuthContextType = {
    user: authState.user,
    loading: authState.loading,
    signInWithGoogle,
    signOut,
    isAuthenticated: supabaseAuthService.isAuthenticated(),
    getAccessToken,
    refreshSession,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

// Firebase-compatible context for easy migration
const FirebaseCompatibleAuthContext = createContext<FirebaseCompatibleAuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(FirebaseCompatibleAuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SupabaseAuthProvider>
      <FirebaseCompatibleAuthProvider>
        {children}
      </FirebaseCompatibleAuthProvider>
    </SupabaseAuthProvider>
  );
};

const FirebaseCompatibleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: supabaseUser, loading, signInWithGoogle, signOut } = useSupabaseAuth();

  // Convert Supabase user to Firebase-compatible format
  const user: FirebaseCompatibleUser | null = supabaseUser ? {
    uid: supabaseUser.id,
    email: supabaseUser.email,
    displayName: supabaseUser.displayName,
    photoURL: supabaseUser.photoURL,
  } : null;

  const value: FirebaseCompatibleAuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return (
    <FirebaseCompatibleAuthContext.Provider value={value}>
      {children}
    </FirebaseCompatibleAuthContext.Provider>
  );
};
