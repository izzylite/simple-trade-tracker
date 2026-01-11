import React, { useState, useEffect } from 'react';
import {
    TextField,
    Typography,
    Box,
    alpha,
    useTheme,
    CircularProgress
} from '@mui/material';
import { AutoAwesome as AIIcon } from '@mui/icons-material';
import { formatTagWithCapitalizedGroup } from '../utils/tagColors';
import { BaseDialog } from './common';
import { logger } from '../utils/logger';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { tagService } from '../services/tagService';
import { useAuthState } from '../contexts/AuthStateContext';

interface TagCreateDialogProps {
    open: boolean;
    onClose: (created?: boolean) => void;
    calendarId: string;
    allTags: string[];
    onTagCreated?: (newTag: string) => Promise<void>;
}

const TagCreateDialog: React.FC<TagCreateDialogProps> = ({
    open,
    onClose,
    calendarId,
    allTags,
    onTagCreated
}) => {
    const theme = useTheme();
    const { user } = useAuthState();
    const [tagName, setTagName] = useState('');
    const [tagGroup, setTagGroup] = useState('');
    const [definition, setDefinition] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setTagName('');
            setTagGroup('');
            setDefinition('');
            setError(null);
        }
    }, [open]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const trimmedTagName = tagName.trim();
        if (!trimmedTagName) {
            setError('Tag name is required');
            return;
        }

        // Capitalize the group name and build full tag
        const trimmedGroup = tagGroup.trim();
        const fullTag = trimmedGroup
            ? formatTagWithCapitalizedGroup(`${trimmedGroup}:${trimmedTagName}`)
            : trimmedTagName;

        // Check if tag already exists
        if (allTags.includes(fullTag)) {
            setError('This tag already exists');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Save definition if provided
            if (definition.trim() && user?.id) {
                await tagService.saveTagDefinition(user.id, fullTag, definition);
            }

            // 2. Add tag to calendar
            if (onTagCreated) {
                await onTagCreated(fullTag);
            }

            onClose(true);
        } catch (err) {
            logger.error('Error creating tag:', err);
            setError(err instanceof Error ? err.message : 'Failed to create tag');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BaseDialog
            open={open}
            onClose={() => !isSubmitting && onClose()}
            maxWidth="sm"
            fullWidth
            title="Create New Tag"
            primaryButtonText={isSubmitting ? 'Creating...' : 'Create Tag'}
            primaryButtonAction={handleSubmit}
            isSubmitting={isSubmitting}
            cancelButtonText="Cancel"
            cancelButtonAction={() => onClose()}
            hideCloseButton={isSubmitting}
        >
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Add a new tag to your calendar. You can also group it by category for better organization.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        label="Group (optional)"
                        value={tagGroup}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value.includes(':')) return;
                            setTagGroup(value);
                        }}
                        fullWidth
                        placeholder="e.g. Strategy"
                        disabled={isSubmitting}
                    />
                    <TextField
                        label="Tag Name"
                        value={tagName}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value.includes(':')) return;
                            setTagName(value);
                        }}
                        fullWidth
                        required
                        autoFocus
                        error={!!error}
                        helperText={error}
                        placeholder="e.g. Breakout"
                        disabled={isSubmitting}
                    />
                </Box>

                <TextField
                    label="Definition (optional)"
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    disabled={isSubmitting}
                    placeholder="What does this tag mean? Helps the AI analyze your trades."
                    inputProps={{ maxLength: 2024 }}
                    helperText={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AIIcon sx={{ fontSize: 14 }} />
                            Help the AI understand your trading context
                        </Box>
                    }
                    sx={{
                        '& .MuiInputBase-input': {
                            ...scrollbarStyles(theme)
                        }
                    }}
                />
            </Box>
        </BaseDialog>
    );
};

export default TagCreateDialog;
