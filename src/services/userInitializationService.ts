/**
 * User Initialization Service
 * Handles automatic user record creation and synchronization on first login
 * This service ensures that every authenticated user has a corresponding record in the users table
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface UserRecord {
  id: string; // Supabase auth ID (auth.uid())
  email: string;
  display_name?: string;
  photo_url?: string;
  provider?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active?: boolean;
}

class UserInitializationService {
  /**
   * Initialize or sync user record on authentication
   * Creates a new user record if one doesn't exist, or returns existing record
   * @param authId - Supabase auth ID (from auth.uid())
   * @param email - User email
   * @param displayName - User display name (optional)
   * @param photoUrl - User photo URL (optional)
   * @returns User record
   */
  async initializeUser(
    authId: string,
    email: string,
    displayName?: string,
    photoUrl?: string
  ): Promise<UserRecord> {
    try {
      // Check if user already exists
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (expected for new users)
        logger.error('Error checking for existing user:', selectError);
        throw selectError;
      }

      if (existingUser) {
        logger.info('User already exists:', { userId: existingUser.id, email });
        return existingUser as UserRecord;
      }

      // Create new user record with explicit ID
      logger.info('Creating new user record:', { authId, email });
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: authId,
            email,
            display_name: displayName || null,
            photo_url: photoUrl || null,
            provider: 'google',
            is_active: true
          }
        ])
        .select()
        .single();

      if (insertError) {
        logger.error('Error creating user record:', insertError);
        throw insertError;
      }

      logger.info('User record created successfully:', { userId: newUser.id, email });
      return newUser as UserRecord;
    } catch (error) {
      logger.error('Error initializing user:', error);
      throw error;
    }
  }

  /**
   * Get user record by auth ID
   * @param authId - Supabase auth ID
   * @returns User record or null if not found
   */
  async getUserByAuthId(authId: string): Promise<UserRecord | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching user by auth ID:', error);
        throw error;
      }

      return data ? (data as UserRecord) : null;
    } catch (error) {
      logger.error('Error getting user by auth ID:', error);
      return null;
    }
  }
 

  /**
   * Update user profile
   * @param authId - Supabase auth ID
   * @param updates - Partial user record to update (can include last_login, is_active, etc.)
   */
  async updateUserProfile(
    authId: string,
    updates: Partial<Omit<UserRecord, 'id' | 'created_at' | 'email'>>
  ): Promise<UserRecord | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', error);
        throw error;
      }

      return data ? (data as UserRecord) : null;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return null;
    }
  }
}

export const userInitializationService = new UserInitializationService();

