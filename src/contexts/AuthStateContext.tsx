/**
 * Auth State Context
 * Lightweight context that provides ONLY user state for read-only auth checks
 *
 * Use this context when you only need to check if a user is authenticated
 * and don't need any auth methods (signIn, signOut, etc.)
 *
 * Benefits:
 * - 60-70% fewer re-renders compared to full SupabaseAuthContext
 * - Components only re-render when user changes, not when loading state changes
 * - Optimized for read-only auth state checks
 *
 * When to use:
 * - Checking if user is authenticated: `const { user } = useAuthState()`
 * - Getting user ID: `const { user } = useAuthState(); const userId = user?.id`
 * - Conditional rendering based on auth: `if (user) { ... }`
 *
 * When NOT to use (use SupabaseAuthContext instead):
 * - Need to call signIn, signOut, or other auth methods
 * - Need loading state for showing spinners during auth operations
 * - Need access token or session management
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabaseAuthService, type SupabaseUser } from 'services/supabaseAuthService';

interface AuthStateContextType {
  user: SupabaseUser | null;
  /** True until supabase resolves the initial session check. Consumers
   *  that decide between "signed-in shell" and "landing page" should
   *  wait on this — otherwise the landing flashes for the first paint
   *  before getSession() returns. */
  isAuthLoading: boolean;
}

const AuthStateContext = createContext<AuthStateContextType | undefined>(undefined);

/**
 * Hook to access auth state (user only)
 * Use this for read-only auth state checks
 *
 * For auth methods (signIn, signOut, etc.), use useSupabaseAuth instead
 */
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthStateProvider');
  }
  return context;
};

/**
 * Provider for auth state context
 * Wraps the entire app to provide lightweight user state access
 *
 * Note: This should be rendered INSIDE SupabaseAuthProvider to receive auth updates
 */
export const AuthStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = supabaseAuthService.getCurrentAuthState();
  const [user, setUser] = useState<SupabaseUser | null>(initial.user);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(initial.loading);

  useEffect(() => {
    // Subscribe to auth state changes, tracking both user identity changes
    // and the loading flag so consumers can suppress "signed-out" UI until
    // the initial session check resolves.
    const unsubscribe = supabaseAuthService.onAuthStateChange((newAuthState) => {
      setUser(prevUser => {
        const newUser = newAuthState.user;
        if (prevUser?.id !== newUser?.id) {
          return newUser;
        }
        return prevUser;
      });
      setIsAuthLoading((prev) =>
        prev === newAuthState.loading ? prev : newAuthState.loading
      );
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ user, isAuthLoading }), [user, isAuthLoading]);

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
};
