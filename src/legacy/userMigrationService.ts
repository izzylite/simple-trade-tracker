/**
 * User Migration Service
 * Handles the transition from Firebase Auth to Supabase Auth
 * Maps Firebase user IDs to Supabase user IDs for data migration
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface UserMapping {
  firebase_uid: string;
  supabase_uid: string;
  email: string;
  display_name: string | null;
  migration_date: string;
}

export interface MigrationUser {
  firebase_uid: string;
  email: string;
  display_name?: string;
  photo_url?: string;
  provider?: string;
}

class UserMigrationService {
  /**
   * Create user mapping when a user signs in with Supabase Auth
   * This links their new Supabase user ID to their old Firebase user ID
   */
  async createUserMapping(
    firebaseUid: string,
    supabaseUid: string,
    email: string,
    displayName?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_migrations')
        .upsert({
          firebase_uid: firebaseUid,
          supabase_uid: supabaseUid,
          email: email,
          display_name: displayName || null,
          migration_date: new Date().toISOString()
        }, {
          onConflict: 'firebase_uid'
        });

      if (error) {
        logger.error('Error creating user mapping:', error);
        return false;
      }

      logger.info(`User mapping created: ${firebaseUid} -> ${supabaseUid}`);
      return true;
    } catch (error) {
      logger.error('Error in createUserMapping:', error);
      return false;
    }
  }

  /**
   * Get Supabase user ID from Firebase user ID
   */
  async getSupabaseUidFromFirebaseUid(firebaseUid: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_migrations')
        .select('supabase_uid')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (error) {
        logger.error('Error getting Supabase UID:', error);
        return null;
      }

      return data?.supabase_uid || null;
    } catch (error) {
      logger.error('Error in getSupabaseUidFromFirebaseUid:', error);
      return null;
    }
  }

  /**
   * Get Firebase user ID from Supabase user ID
   */
  async getFirebaseUidFromSupabaseUid(supabaseUid: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_migrations')
        .select('firebase_uid')
        .eq('supabase_uid', supabaseUid)
        .single();

      if (error) {
        logger.error('Error getting Firebase UID:', error);
        return null;
      }

      return data?.firebase_uid || null;
    } catch (error) {
      logger.error('Error in getFirebaseUidFromSupabaseUid:', error);
      return null;
    }
  }

  /**
   * Check if a user has been migrated
   */
  async isUserMigrated(firebaseUid: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_migrations')
        .select('id')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error checking user migration:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Error in isUserMigrated:', error);
      return false;
    }
  }

  /**
   * Get all user mappings (for admin/debugging)
   */
  async getAllUserMappings(): Promise<UserMapping[]> {
    try {
      const { data, error } = await supabase
        .from('user_migrations')
        .select('*')
        .order('migration_date', { ascending: false });

      if (error) {
        logger.error('Error getting all user mappings:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getAllUserMappings:', error);
      return [];
    }
  }

  /**
   * Migrate user data from Firebase UID to Supabase UID
   * This will be called during the data migration process
   */
  async migrateUserData(firebaseUid: string, supabaseUid: string): Promise<boolean> {
    try {
      // Update all user-related tables to use the new Supabase UID
      const updates = await Promise.allSettled([
        // Update calendars
        supabase
          .from('calendars')
          .update({ user_id: supabaseUid })
          .eq('user_id', firebaseUid),

        // Update users table (if exists)
        supabase
          .from('users')
          .update({ firebase_uid: supabaseUid })
          .eq('firebase_uid', firebaseUid),

        // Note: trades, trade_images, etc. are linked via calendar_id, so they'll be updated automatically
      ]);

      // Check if any updates failed
      const failures = updates.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        logger.error('Some user data migration updates failed:', failures);
        return false;
      }

      logger.info(`User data migrated successfully: ${firebaseUid} -> ${supabaseUid}`);
      return true;
    } catch (error) {
      logger.error('Error in migrateUserData:', error);
      return false;
    }
  }

  /**
   * Get the user record from the users table by Supabase auth ID
   * This returns the custom user ID (not the auth ID)
   */
  async getUserIdByAuthId(authId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', authId)
        .single();

      if (error) {
        logger.error('Error getting user ID by auth ID:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.error('Error in getUserIdByAuthId:', error);
      return null;
    }
  }

  /**
   * Handle user sign-in and automatic migration
   * This should be called when a user signs in with Supabase Auth
   */
  async handleUserSignIn(
    supabaseUid: string,
    email: string,
    displayName?: string
  ): Promise<{ migrated: boolean; firebaseUid?: string }> {
    try {
      // Check if this email was used with Firebase Auth
      // We'll need to implement a way to identify Firebase users
      // For now, we'll create a simple mapping based on email

      // This is a placeholder - in a real migration, you'd have a list of Firebase users
      // For your case, since you're the primary user, we can handle this manually

      logger.info(`User signed in with Supabase: ${email} (${supabaseUid})`);

      return {
        migrated: false, // Will be true once we implement the actual migration logic
        firebaseUid: undefined
      };
    } catch (error) {
      logger.error('Error in handleUserSignIn:', error);
      return { migrated: false };
    }
  }
}

// Create singleton instance
export const userMigrationService = new UserMigrationService();

export default userMigrationService;
