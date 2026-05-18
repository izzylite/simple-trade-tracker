import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface TagSuggestion {
  tag: string;
  definition: string;
}

/**
 * Service for managing tag definitions and metadata
 */
export const tagService = {
  /**
   * Fetches all tag definitions for a specific user
   */
  async fetchTagDefinitions(userId: string): Promise<Record<string, string>> {
    if (!userId) return {};

    try {
      const { data, error } = await supabase
        .from('tag_definitions')
        .select('tag_name, definition')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error fetching tag definitions:', error);
        return {};
      }

      const definitions: Record<string, string> = {};
      data?.forEach((item) => {
        definitions[item.tag_name] = item.definition;
      });
      return definitions;
    } catch (err) {
      logger.error('Error fetching tag definitions:', err);
      return {};
    }
  },

  /**
   * Fetches the definition for a specific tag
   */
  async fetchTagDefinition(userId: string, tagName: string): Promise<string> {
    if (!userId || !tagName) return '';

    try {
      const { data, error } = await supabase
        .from('tag_definitions')
        .select('definition')
        .eq('user_id', userId)
        .eq('tag_name', tagName)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        logger.error('Error fetching tag definition:', error);
      }

      return data?.definition || '';
    } catch (err) {
      logger.error('Error fetching tag definition:', err);
      return '';
    }
  },

  /**
   * Saves or updates a tag definition
   */
  async saveTagDefinition(
    userId: string,
    tagName: string,
    definition: string,
    originalDefinition?: string
  ): Promise<void> {
    if (!userId || !tagName) return;

    const trimmedDef = definition.trim();

    // If originalDefinition is provided, skip if no change
    if (originalDefinition !== undefined && trimmedDef === originalDefinition.trim()) {
      return;
    }

    try {
      if (trimmedDef) {
        // Upsert definition
        const { error } = await supabase
          .from('tag_definitions')
          .upsert({
            user_id: userId,
            tag_name: tagName,
            definition: trimmedDef,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,tag_name' });

        if (error) {
          logger.error('Error saving tag definition:', error);
          throw error;
        }
      } else if (originalDefinition) {
        // Delete definition if cleared and it existed before
        await this.deleteTagDefinition(userId, tagName);
      }
    } catch (err) {
      logger.error('Error saving tag definition:', err);
      throw err;
    }
  },

  /**
   * Generates AI-drafted definitions for the given tags via the
   * suggest-tag-definition edge function. The caller decides whether to
   * persist any of the results — this method never writes to the DB.
   *
   * `voiceExamples` are existing definitions from this trader that the model
   * uses to match tone. Pass a handful — the function caps at 5 server-side.
   */
  async suggestTagDefinitions(
    tags: string[],
    voiceExamples?: TagSuggestion[]
  ): Promise<TagSuggestion[]> {
    if (!tags || tags.length === 0) return [];

    try {
      const { data, error } = await supabase.functions.invoke('suggest-tag-definition', {
        body: { tags, examples: voiceExamples ?? [] },
      });

      if (error) {
        logger.error('suggest-tag-definition invoke error:', error);
        throw new Error(error.message || 'Failed to generate suggestions');
      }

      if (!data?.success || !Array.isArray(data.suggestions)) {
        const message = data?.error || 'AI did not return suggestions';
        throw new Error(message);
      }

      return (data.suggestions as TagSuggestion[]).filter(
        (s) => s && typeof s.tag === 'string' && typeof s.definition === 'string'
      );
    } catch (err) {
      logger.error('Error generating tag suggestions:', err);
      throw err;
    }
  },

  /**
   * Moves a definition from oldTag to newTag, or deletes it if newTag is empty.
   *
   * Use this whenever a tag is renamed or deleted via update-tag. The plain
   * saveTagDefinition() can't be used here because:
   *   1. It keys by tag_name, so calling it with the new tag would orphan the
   *      old row instead of renaming it.
   *   2. Its "skip if definition unchanged" guard would no-op when the user
   *      renames a tag without editing the description, leaving the new tag
   *      with no definition at all.
   */
  async renameTagDefinition(
    userId: string,
    oldTag: string,
    newTag: string,
    definition: string
  ): Promise<void> {
    if (!userId || !oldTag) return;

    // Always remove the old row first. If oldTag had no definition this is a no-op.
    await this.deleteTagDefinition(userId, oldTag);

    // Delete-only case (rename to empty / tag removal): nothing more to do.
    const trimmedNew = newTag.trim();
    const trimmedDef = definition.trim();
    if (!trimmedNew || !trimmedDef) return;

    const { error } = await supabase
      .from('tag_definitions')
      .upsert({
        user_id: userId,
        tag_name: trimmedNew,
        definition: trimmedDef,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tag_name' });

    if (error) {
      logger.error('Error saving renamed tag definition:', error);
      throw error;
    }
  },

  /**
   * Deletes a tag definition
   */
  async deleteTagDefinition(userId: string, tagName: string): Promise<void> {
    if (!userId || !tagName) return;

    try {
      const { error } = await supabase
        .from('tag_definitions')
        .delete()
        .eq('user_id', userId)
        .eq('tag_name', tagName);

      if (error) {
        logger.error('Error deleting tag definition:', error);
        throw error;
      }
    } catch (err) {
      logger.error('Error deleting tag definition:', err);
      throw err;
    }
  }
};
