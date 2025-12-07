import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Typography,
  Box,
  Chip,
  alpha,
  useTheme,
  Button,
  CircularProgress
} from '@mui/material';
import { Delete as DeleteIcon, AutoAwesome as AIIcon } from '@mui/icons-material';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup, formatTagWithCapitalizedGroup } from '../utils/tagColors';
import { BaseDialog } from './common';
import { logger } from '../utils/logger';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/SupabaseAuthContext';

interface TagEditDialogProps {
  open: boolean;
  onClose: (definitionUpdated?: boolean) => void;
  tag: string;
  calendarId: string;
  onSuccess?: (oldTag: string, newTag: string, tradesUpdated: number) => void;
  onDelete?: (deletedTag: string, tradesUpdated: number) => void;
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  /** Pre-loaded definition from parent (skip fetch if provided) */
  initialDefinition?: string;
}

const TagEditDialog: React.FC<TagEditDialogProps> = ({
  open,
  onClose,
  tag,
  calendarId,
  onSuccess,
  onDelete,
  onTagUpdated,
  initialDefinition
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [newTag, setNewTag] = useState(tag);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definition, setDefinition] = useState('');
  const [originalDefinition, setOriginalDefinition] = useState('');
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);

  // Fetch existing definition when dialog opens
  const fetchDefinition = useCallback(async (tagName: string) => {
    if (!user?.id || !tagName) return;

    setIsLoadingDefinition(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('tag_definitions')
        .select('definition')
        .eq('user_id', user.id)
        .eq('tag_name', tagName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        logger.error('Error fetching tag definition:', fetchError);
      }

      const def = data?.definition || '';
      setDefinition(def);
      setOriginalDefinition(def);
    } catch (err) {
      logger.error('Error fetching tag definition:', err);
    } finally {
      setIsLoadingDefinition(false);
    }
  }, [user?.id]);

  // Save or update definition
  const saveDefinition = async (tagName: string, newDefinition: string) => {
    if (!user?.id) return;

    const trimmedDef = newDefinition.trim();

    if (trimmedDef === originalDefinition) {
      return; // No change
    }

    try {
      if (trimmedDef) {
        // Upsert definition
        const { error: upsertError } = await supabase
          .from('tag_definitions')
          .upsert({
            user_id: user.id,
            tag_name: tagName,
            definition: trimmedDef,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,tag_name' });

        if (upsertError) {
          logger.error('Error saving tag definition:', upsertError);
        }
      } else if (originalDefinition) {
        // Delete definition if cleared
        const { error: deleteError } = await supabase
          .from('tag_definitions')
          .delete()
          .eq('user_id', user.id)
          .eq('tag_name', tagName);

        if (deleteError) {
          logger.error('Error deleting tag definition:', deleteError);
        }
      }
    } catch (err) {
      logger.error('Error saving tag definition:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTag.trim() || (isGrouped && !tagName.trim())) {
      setError('Tag cannot be empty');
      return;
    }

    // Validate that the tag doesn't contain multiple colons
    const colonCount = (newTag.match(/:/g) || []).length;
    if (colonCount > 1) {
      setError('Tags can only contain one colon (:) for category formatting');
      return;
    }

    const tagChanged = newTag !== tag;
    const definitionChanged = definition.trim() !== originalDefinition;

    if (!tagChanged && !definitionChanged) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedTag = tag.trim();
      // Capitalize the group name before submitting
      const trimmedNewTag = formatTagWithCapitalizedGroup(newTag.trim());

      if (tagChanged && onTagUpdated) {
        // Use the provided onTagUpdated callback for tag rename
        const result = await onTagUpdated(trimmedTag, trimmedNewTag);

        if (result.success) {
          // Save or update the definition for the new tag name
          await saveDefinition(trimmedNewTag, definition);

          if (onSuccess) {
            onSuccess(trimmedTag, trimmedNewTag, result.tradesUpdated || 0);
          }
          onClose(definitionChanged);
        } else {
          setError('Failed to update tag');
        }
      } else {
        // Only definition changed, save it
        await saveDefinition(trimmedTag, definition);
        onClose(true);
      }
    } catch (error) {
      logger.error('Error updating tag:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGrouped = isGroupedTag(tag); 
  // For grouped tags, extract the tag name part for the input field
  const getTagNamePart = (fullTag: string) => isGroupedTag(fullTag) ? fullTag.split(':')[1] : fullTag;
  const [tagName, setTagName] = useState(getTagNamePart(tag));
  const [tagGroup, setTagGroup] = useState(isGrouped ? getTagGroup(tag) : '');  


  // Update state when tag prop changes or dialog opens
  useEffect(() => {
    if (open && tag) {
      setNewTag(tag);
      setTagName(getTagNamePart(tag));
      setTagGroup(isGroupedTag(tag) ? getTagGroup(tag) : '');
      setError(null);

      // Use initialDefinition if provided, otherwise fetch
      if (initialDefinition !== undefined) {
        setDefinition(initialDefinition);
        setOriginalDefinition(initialDefinition);
      } else {
        fetchDefinition(tag);
      }
    }
  }, [tag, open, fetchDefinition, initialDefinition]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleSubmit(e as React.FormEvent);
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const trimmedTag = tag.trim();

      if (onTagUpdated) {
        // Use the provided onTagUpdated callback with empty string to delete
        const result = await onTagUpdated(trimmedTag, '');

        if (result.success) {
          onDelete(trimmedTag, result.tradesUpdated || 0);
          onClose();
        } else {
          setError('Failed to delete tag');
        }
      } else {
        setError('No tag update handler provided');
      }
    } catch (error) {
      logger.error('Error deleting tag:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsDeleting(false);
    }
  };



  // Create a safe onClose function that checks if submission or deletion is in progress
  const safeOnClose = () => {
    if (!isSubmitting && !isDeleting) {
      onClose();
    }
  };

  return (
    <BaseDialog
      open={open}
      onClose={safeOnClose}
      maxWidth="sm"
      fullWidth
      title="Edit Tag"
      primaryButtonText={isSubmitting ? 'Updating...' : 'Update Tag'}
      primaryButtonAction={handleFormSubmit}
      isSubmitting={isSubmitting || isDeleting}
      cancelButtonText="Cancel"
      cancelButtonAction={safeOnClose}
      hideCloseButton={isSubmitting || isDeleting}
      actions={
        onDelete && (
          <Button
            variant="outlined"
            color="error"
            startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            onClick={handleDelete}
            disabled={isSubmitting || isDeleting}
            sx={{ mr: 1 }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Tag'}
          </Button>
        )
      }
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 1,
          mt: 1,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Typography variant="body2" color="text.secondary">
            This will update all trades that use this tag across all years in the calendar.
          </Typography>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`
          }}>
            <Typography variant="body2" fontWeight={500}>Current tag:</Typography>
            <Chip
              label={formatTagForDisplay(tag)}
              size="small"
              sx={{
                ...getTagChipStyles(tag, theme),
                fontWeight: 600,
                boxShadow: theme.shadows[1]
              }}
            />
          </Box>
        </Box>



        {isGrouped ? (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}> 
              <TextField
                label="Group"
             value={tagGroup}
              onChange={(e) => {
                const newGroupName = e.target.value;
                // Prevent multiple colons in group name
                if ((newGroupName.match(/:/g) || []).length > 0) {
                  return;
                }
                setTagGroup(newGroupName);
                setNewTag(`${newGroupName}:${tagName}`);
              }}
              fullWidth
              autoFocus
              error={!!error}
              helperText={error}
              disabled={isSubmitting}
              size="medium"
              sx={{
                '& .MuiFormHelperText-root': {
                  color: theme.palette.error.main,
                  fontWeight: 500,
                  marginTop: 1
                }
              }}
            />

            <TextField
              label="Tag Name"
              value={tagName}
              onChange={(e) => {
                const newTagName = e.target.value;
                // Prevent multiple colons in tag name
                if ((newTagName.match(/:/g) || []).length > 0) {
                  return;
                }
                setTagName(newTagName);
                setNewTag(`${tagGroup}:${newTagName}`);
              }}
              fullWidth
              autoFocus
              error={!!error}
              helperText={error}
              disabled={isSubmitting}
              size="medium"
              sx={{
                '& .MuiFormHelperText-root': {
                  color: theme.palette.error.main,
                  fontWeight: 500,
                  marginTop: 1
                }
              }}
            />
          </Box>
        ) : (
          <TextField
            label="Tag Name"
            value={newTag}
            onChange={(e) => {
              const value = e.target.value;
              // Prevent multiple colons in tag
              if ((value.match(/:/g) || []).length > 1) {
                return;
              }
              setNewTag(value);
              setTagName(value);
            }}
            fullWidth
            autoFocus
            error={!!error}
            helperText={error}
            disabled={isSubmitting}
            size="medium"
            sx={{
              '& .MuiFormHelperText-root': {
                color: theme.palette.error.main,
                fontWeight: 500,
                marginTop: 1
              }
            }}
          />
        )}

        {/* Tag Definition - helps AI understand custom tags */}
        <TextField
          label="Definition (optional)"
          value={definition}
          onChange={(e) => {
            if (e.target.value.length <= 1024) {
              setDefinition(e.target.value);
            }
          }}
          fullWidth
          multiline
          rows={2}
          disabled={isSubmitting || isLoadingDefinition}
          placeholder="What does this tag mean? e.g., 'Trade taken at 0.62 Fibonacci retracement level'"
          size="medium"
          inputProps={{ maxLength: 1024 }}
          InputProps={{
            startAdornment: isLoadingDefinition ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : undefined
          }}
          helperText={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AIIcon sx={{ fontSize: 14 }} />
              This definition helps the AI assistant understand your custom tags
            </Box>
          }
          sx={{
            '& .MuiInputBase-input': {
              ...scrollbarStyles(theme)
            },
            '& .MuiFormHelperText-root': {
              color: theme.palette.text.secondary,
              display: 'flex',
              alignItems: 'center'
            }
          }}
        />
      </Box>
    </BaseDialog>
  );
};

export default TagEditDialog;
