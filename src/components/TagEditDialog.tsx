import React, { useState, useEffect } from 'react';
import {
  TextField,
  Typography,
  Box,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import * as calendarService from '../services/calendarService';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../utils/tagColors';
import { BaseDialog } from './common';

interface TagEditDialogProps {
  open: boolean;
  onClose: () => void;
  tag: string;
  calendarId: string;
  onSuccess?: (oldTag: string, newTag: string, tradesUpdated: number) => void;
}

const TagEditDialog: React.FC<TagEditDialogProps> = ({
  open,
  onClose,
  tag,
  calendarId,
  onSuccess
}) => {
  const theme = useTheme();
  const [newTag, setNewTag] = useState(tag);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (newTag === tag) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      tag = tag.trim();
      const result = await calendarService.updateTag(calendarId, tag, newTag);

      if (result.success) {
        if (onSuccess) {
          onSuccess(tag, newTag, result.tradesUpdated);
        }
        onClose();
      } else {
        setError('Failed to update tag');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
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


  // Update state when tag prop changes
  useEffect(() => {
    setNewTag(tag);
    setTagName(getTagNamePart(tag));
    setError(null);
  }, [tag]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleSubmit(e as React.FormEvent);
  };



  // Create a safe onClose function that checks if submission is in progress
  const safeOnClose = () => {
    if (!isSubmitting) {
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
      isSubmitting={isSubmitting}
      cancelButtonText="Cancel"
      cancelButtonAction={safeOnClose}
      hideCloseButton={isSubmitting}
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
      </Box>
    </BaseDialog>
  );
};

export default TagEditDialog;
