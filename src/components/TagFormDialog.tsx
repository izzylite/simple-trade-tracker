import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    TextField,
    Typography,
    Box,
    Button,
    IconButton,
    Checkbox,
    FormControlLabel,
    alpha,
    useTheme,
    CircularProgress,
} from '@mui/material';
import { useDialogTokens, MONO_FONT } from '../styles/dialogTokens';
import {
    Close as CloseIcon,
    AutoAwesome as AIIcon,
    Add as AddIcon,
    ArrowForward as ArrowIcon,
    Edit as EditIcon,
    DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import {
    formatTagWithCapitalizedGroup,
    getTagGroup,
    isGroupedTag,
    getTagColor,
} from '../utils/tagColors';
import { logger } from '../utils/logger';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { tagService } from '../services/tagService';
import { useAuthState } from '../contexts/AuthStateContext';
import { Z_INDEX } from '../styles/zIndex';
import { dialogProps } from '../styles/dialogStyles';

interface TagFormDialogProps {
    open: boolean;
    /** `changed` is true if anything was saved (used by the panel to refresh). */
    onClose: (changed?: boolean) => void;
    calendarId: string;
    allTags: string[];

    /** Edit mode: pass the tag being edited. Omit for create mode. */
    editTag?: string;
    /** Pre-loaded definition in edit mode (skips the fetch). */
    initialDefinition?: string;

    // Create-mode callback
    onTagCreated?: (newTag: string) => Promise<void>;

    // Edit-mode callbacks
    onTagUpdated?: (
        oldTag: string,
        newTag: string,
    ) => Promise<{ success: boolean; tradesUpdated: number }>;
    onEditSuccess?: (oldTag: string, newTag: string, tradesUpdated: number) => void;
    onDelete?: (deletedTag: string, tradesUpdated: number) => void;
}

const TagFormDialog: React.FC<TagFormDialogProps> = ({
    open,
    onClose,
    calendarId: _calendarId,
    allTags,
    editTag,
    initialDefinition,
    onTagCreated,
    onTagUpdated,
    onEditSuccess,
    onDelete,
}) => {
    const theme = useTheme();
    const {
        isDark,
        violet, violetSoft, violetSofter, violetBorder,
        surfaceInset, hairline,
        paperSx, headerSx, iconAvatarSx, footerSx,
        monoLabelSx, optionalSx, inputSx,
        primaryButtonSx, ghostButtonSx,
    } = useDialogTokens();
    const { user } = useAuthState();

    const isEdit = !!editTag;

    // Seed values when editing — derived once per open so user typing isn't
    // clobbered by re-renders.
    const seedName = useMemo(() => {
        if (!editTag) return '';
        return isGroupedTag(editTag) ? editTag.split(':')[1] : editTag;
    }, [editTag]);
    const seedGroup = useMemo(() => {
        if (!editTag) return '';
        return isGroupedTag(editTag) ? getTagGroup(editTag) : '';
    }, [editTag]);

    const [tagName, setTagName] = useState('');
    const [tagGroup, setTagGroup] = useState('');
    const [otherActive, setOtherActive] = useState(false);
    const [customGroup, setCustomGroup] = useState('');
    const [definition, setDefinition] = useState('');
    const [originalDefinition, setOriginalDefinition] = useState('');
    const [createAnother, setCreateAnother] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const existingGroups = useMemo(() => {
        const groups = new Set<string>();
        allTags.forEach(t => {
            if (isGroupedTag(t)) groups.add(getTagGroup(t));
        });
        return Array.from(groups).sort();
    }, [allTags]);

    // Reset / seed on open. Edit mode pre-fills; create mode clears.
    useEffect(() => {
        if (!open) return;
        if (isEdit) {
            setTagName(seedName);
            // If the edited tag's group is in the chip list, pick it; otherwise
            // fall back to "Other" so the user can see the actual group name.
            if (seedGroup && existingGroups.includes(seedGroup)) {
                setTagGroup(seedGroup);
                setOtherActive(false);
                setCustomGroup('');
            } else if (seedGroup) {
                setTagGroup('');
                setOtherActive(true);
                setCustomGroup(seedGroup);
            } else {
                setTagGroup('');
                setOtherActive(false);
                setCustomGroup('');
            }
            setDefinition(initialDefinition ?? '');
            setOriginalDefinition(initialDefinition ?? '');
        } else {
            setTagName('');
            setTagGroup('');
            setOtherActive(false);
            setCustomGroup('');
            setDefinition('');
            setOriginalDefinition('');
        }
        setConfirmDelete(false);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editTag, initialDefinition]);

    const effectiveGroup = (otherActive ? customGroup : tagGroup).trim();
    const trimmedName = tagName.trim();
    const previewTag = trimmedName
        ? (effectiveGroup
            ? formatTagWithCapitalizedGroup(`${effectiveGroup}:${trimmedName}`)
            : trimmedName)
        : '';
    const previewGroup = effectiveGroup
        ? formatTagWithCapitalizedGroup(`${effectiveGroup}:x`).split(':')[0]
        : '';

    // Local optionalSx uses 0.68rem (hook default is 0.66rem) — preserve variation.
    const optionalSxLocal = { ...optionalSx, fontSize: '0.68rem' };

    const chipStyle = (color: string, selected: boolean) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        userSelect: 'none' as const,
        transition: 'all 120ms ease',
        backgroundColor: selected ? violetSoft : surfaceInset,
        color: selected ? violet : theme.palette.text.primary,
        border: `1px solid ${selected ? violetBorder : hairline}`,
        '&:hover': {
            backgroundColor: selected ? violetSoft : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
        },
        '& .dot': {
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
        },
    });

    const previewChipSx = (tag: string) => {
        const color = getTagColor(tag);
        return {
            display: 'inline-flex',
            alignItems: 'center',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontFamily: MONO_FONT,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: color,
            backgroundColor: alpha(color, isDark ? 0.18 : 0.14),
            border: `1px solid ${alpha(color, isDark ? 0.4 : 0.32)}`,
        };
    };

    const busy = isSubmitting || isDeleting || isDrafting;

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (busy) return;

        if (!trimmedName) {
            setError(isEdit ? 'Tag name cannot be empty' : 'Tag name is required');
            return;
        }

        const fullTag = formatTagWithCapitalizedGroup(previewTag);

        if (isEdit && editTag) {
            const tagChanged = fullTag !== editTag;
            const definitionChanged = definition.trim() !== originalDefinition.trim();

            if (!tagChanged && !definitionChanged) {
                onClose();
                return;
            }

            // Block rename to a name already in use by another tag.
            if (tagChanged && allTags.includes(fullTag)) {
                setError('Another tag already uses this name');
                return;
            }

            setIsSubmitting(true);
            setError(null);

            try {
                if (tagChanged && onTagUpdated) {
                    const result = await onTagUpdated(editTag, fullTag);
                    if (!result.success) {
                        setError('Failed to update tag');
                        return;
                    }
                    if (user?.id) {
                        // Move the definition row from the old tag_name to the new one.
                        // saveTagDefinition would have orphaned the old row (keyed by name)
                        // and its "skip if unchanged" guard would also have no-op'd when
                        // the user renamed without editing the definition.
                        await tagService.renameTagDefinition(
                            user.id,
                            editTag,
                            fullTag,
                            definition,
                        );
                    }
                    onEditSuccess?.(editTag, fullTag, result.tradesUpdated || 0);
                } else if (definitionChanged && user?.id) {
                    await tagService.saveTagDefinition(
                        user.id,
                        editTag,
                        definition,
                        originalDefinition,
                    );
                }
                onClose(true);
            } catch (err) {
                logger.error('Error updating tag:', err);
                setError(err instanceof Error ? err.message : 'Failed to update tag');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Create mode
        if (allTags.includes(fullTag)) {
            setError('This tag already exists');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            if (definition.trim() && user?.id) {
                await tagService.saveTagDefinition(user.id, fullTag, definition);
            }
            if (onTagCreated) {
                await onTagCreated(fullTag);
            }
            if (createAnother) {
                setTagName('');
                setDefinition('');
                setError(null);
                setIsSubmitting(false);
                return;
            }
            onClose(true);
        } catch (err) {
            logger.error('Error creating tag:', err);
            setError(err instanceof Error ? err.message : 'Failed to create tag');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDraftWithOrion = async () => {
        if (!trimmedName || busy) return;
        setIsDrafting(true);
        setError(null);

        const fullTag = effectiveGroup ? `${effectiveGroup}:${trimmedName}` : trimmedName;

        try {
            let voiceExamples: { tag: string; definition: string }[] = [];
            if (user?.id) {
                try {
                    const existing = await tagService.fetchTagDefinitions(user.id);
                    voiceExamples = Object.entries(existing)
                        .filter(([tag, def]) => def && def.trim() !== '' && tag !== fullTag)
                        .slice(0, 5)
                        .map(([tag, def]) => ({ tag, definition: def }));
                } catch {
                    // Non-fatal — drafting can proceed without examples.
                }
            }

            const suggestions = await tagService.suggestTagDefinitions(
                [fullTag],
                voiceExamples,
            );
            const drafted = suggestions[0]?.definition?.trim();
            if (!drafted) {
                setError("Orion couldn't draft a definition. Try a more specific name.");
                return;
            }
            setDefinition(drafted);
        } catch (err) {
            logger.error('Draft with Orion failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to draft definition');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleDelete = async () => {
        if (!editTag || !onTagUpdated || !onDelete || busy) return;
        // Two-step confirmation: first click arms confirmDelete, second commits.
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setIsDeleting(true);
        setError(null);
        try {
            const result = await onTagUpdated(editTag, '');
            if (!result.success) {
                setError('Failed to delete tag');
                return;
            }
            // Drop the definition row too; otherwise it lingers and would
            // re-attach if the same tag name is created later.
            if (user?.id) {
                await tagService.deleteTagDefinition(user.id, editTag);
            }
            onDelete(editTag, result.tradesUpdated || 0);
            onClose();
        } catch (err) {
            logger.error('Error deleting tag:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete tag');
        } finally {
            setIsDeleting(false);
            setConfirmDelete(false);
        }
    };

    const title = isEdit ? 'Edit tag' : 'New tag';
    const subtitle = isEdit
        ? 'Renaming updates every trade that uses this tag'
        : previewGroup
            ? `Adds to your ${previewGroup} calendar vocabulary`
            : 'Adds to your calendar vocabulary';

    const primaryLabel = isEdit
        ? (isSubmitting ? 'Saving…' : 'Save changes')
        : (isSubmitting ? 'Creating…' : 'Create tag');

    return (
        <Dialog
            open={open}
            onClose={() => !busy && onClose()}
            maxWidth="sm"
            fullWidth
            {...dialogProps}
            sx={{ zIndex: Z_INDEX.NESTED_DIALOG }}
            slotProps={{
                paper: { sx: paperSx },
            }}
        >
            {/* Header */}
            <Box sx={headerSx}>
                <Box sx={iconAvatarSx}>
                    {isEdit ? <EditIcon sx={{ fontSize: 18 }} /> : <AddIcon sx={{ fontSize: 18 }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                        {title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}>
                        {subtitle}
                    </Typography>
                </Box>
                <IconButton
                    onClick={() => !busy && onClose()}
                    size="small"
                    sx={{ color: theme.palette.text.secondary }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* Body */}
            <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                    px: 2.5,
                    py: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2.25,
                    ...scrollbarStyles(theme),
                    overflowY: 'auto',
                    maxHeight: '70vh',
                }}
            >
                {/* Preview row */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        border: `1px solid ${hairline}`,
                        backgroundColor: surfaceInset,
                        minHeight: 44,
                    }}
                >
                    <Typography sx={{ ...monoLabelSx, fontSize: '0.62rem' }}>Preview</Typography>
                    {previewTag ? (
                        <>
                            <Box sx={previewChipSx(previewTag)}>{trimmedName}</Box>
                            {effectiveGroup && (
                                <>
                                    <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.78rem' }}>
                                        in
                                    </Typography>
                                    <Box sx={previewChipSx(effectiveGroup)}>{previewGroup}</Box>
                                </>
                            )}
                        </>
                    ) : (
                        <Typography sx={{ color: theme.palette.text.disabled, fontFamily: MONO_FONT, fontSize: '0.78rem' }}>
                            Type a name to preview
                        </Typography>
                    )}
                </Box>

                {/* Name */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography sx={monoLabelSx}>
                        Name
                        <Box component="span" sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}>*</Box>
                    </Typography>
                    <TextField
                        value={tagName}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v.includes(':')) return;
                            setTagName(v);
                            if (error) setError(null);
                        }}
                        fullWidth
                        autoFocus
                        error={!!error}
                        placeholder="e.g. 1H Order Block"
                        disabled={busy}
                        size="small"
                        sx={{
                            ...inputSx,
                            '& .MuiOutlinedInput-input': {
                                py: 1.25,
                                fontSize: '0.9rem',
                                fontWeight: 500,
                            },
                        }}
                    />
                    {error && (
                        <Typography sx={{ fontSize: '0.75rem', color: theme.palette.error.main, mt: 0.25 }}>
                            {error}
                        </Typography>
                    )}
                </Box>

                {/* Group */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography sx={monoLabelSx}>
                        Group
                        <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>· Optional</Box>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {existingGroups.map((g) => {
                            const selected = !otherActive && tagGroup === g;
                            return (
                                <Box
                                    key={g}
                                    sx={chipStyle(getTagColor(`${g}:_`), selected)}
                                    onClick={() => {
                                        if (busy) return;
                                        setOtherActive(false);
                                        setTagGroup(selected ? '' : g);
                                    }}
                                >
                                    <Box component="span" className="dot" />
                                    {g}
                                </Box>
                            );
                        })}
                        <Box
                            sx={{
                                ...chipStyle(theme.palette.text.secondary, otherActive),
                                '& .dot': { display: 'none' },
                            }}
                            onClick={() => {
                                if (busy) return;
                                setOtherActive(prev => !prev);
                                setTagGroup('');
                            }}
                        >
                            <AddIcon sx={{ fontSize: 14, mr: -0.25 }} />
                            Other
                        </Box>
                    </Box>
                    {otherActive && (
                        <TextField
                            value={customGroup}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v.includes(':')) return;
                                setCustomGroup(v);
                            }}
                            placeholder="New group name"
                            size="small"
                            disabled={busy}
                            sx={{
                                ...inputSx,
                                mt: 0.5,
                                '& .MuiOutlinedInput-input': {
                                    py: 1,
                                    fontSize: '0.85rem',
                                },
                            }}
                        />
                    )}
                </Box>

                {/* Definition */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography sx={monoLabelSx}>
                            Definition
                            <Box component="span" sx={{ ...optionalSxLocal, ml: 0.5 }}>· Optional</Box>
                        </Typography>
                        <Button
                            size="small"
                            onClick={handleDraftWithOrion}
                            disabled={busy || !trimmedName}
                            startIcon={
                                isDrafting ? (
                                    <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} />
                                ) : (
                                    <AIIcon sx={{ fontSize: 14 }} />
                                )
                            }
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                color: violet,
                                backgroundColor: violetSofter,
                                border: `1px solid ${violetBorder}`,
                                borderRadius: 1,
                                px: 1.25,
                                py: 0.25,
                                minHeight: 0,
                                '&:hover': { backgroundColor: violetSoft },
                                '&.Mui-disabled': {
                                    color: alpha(violet, 0.45),
                                    borderColor: alpha(violet, 0.18),
                                    backgroundColor: alpha(violet, 0.05),
                                },
                            }}
                        >
                            {isDrafting ? 'Drafting…' : 'Draft with Orion'}
                        </Button>
                    </Box>

                    <TextField
                        value={definition}
                        onChange={(e) => setDefinition(e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                        disabled={busy}
                        placeholder="A 1-hour Order Block is the last opposing candle before a strong impulsive move…"
                        inputProps={{ maxLength: 2024 }}
                        sx={{
                            ...inputSx,
                            '& .MuiOutlinedInput-input': {
                                fontSize: '0.85rem',
                                ...scrollbarStyles(theme),
                            },
                        }}
                    />

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1,
                            px: 1.25,
                            py: 1,
                            borderRadius: 1.25,
                            border: `1px solid ${hairline}`,
                            backgroundColor: surfaceInset,
                        }}
                    >
                        <AIIcon sx={{ fontSize: 14, color: violet, mt: 0.25 }} />
                        <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.5 }}>
                            Definitions let Orion explain your strategy back to you in trade reviews. Aim for one sentence + an example.
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Footer */}
            <Box sx={{ ...footerSx, justifyContent: 'space-between' }}>
                {isEdit ? (
                    onDelete && onTagUpdated ? (
                        <Button
                            onClick={handleDelete}
                            disabled={busy}
                            startIcon={
                                isDeleting ? (
                                    <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} />
                                ) : (
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                )
                            }
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                color: confirmDelete ? theme.palette.error.contrastText : theme.palette.error.main,
                                backgroundColor: confirmDelete
                                    ? theme.palette.error.main
                                    : alpha(theme.palette.error.main, 0.08),
                                border: `1px solid ${alpha(theme.palette.error.main, confirmDelete ? 1 : 0.3)}`,
                                borderRadius: 1.25,
                                px: 1.5,
                                py: 0.5,
                                '&:hover': {
                                    backgroundColor: confirmDelete
                                        ? theme.palette.error.dark
                                        : alpha(theme.palette.error.main, 0.16),
                                },
                            }}
                        >
                            {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete'}
                        </Button>
                    ) : (
                        <Box />
                    )
                ) : (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={createAnother}
                                onChange={(e) => setCreateAnother(e.target.checked)}
                                disabled={busy}
                                size="small"
                                sx={{
                                    color: alpha(theme.palette.text.secondary, 0.6),
                                    '&.Mui-checked': { color: violet },
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                                Create another after
                            </Typography>
                        }
                        sx={{ ml: -0.75 }}
                    />
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                        onClick={() => !busy && onClose()}
                        disabled={busy}
                        sx={ghostButtonSx}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={busy || !trimmedName}
                        variant="contained"
                        endIcon={!isEdit ? <ArrowIcon sx={{ fontSize: 14 }} /> : undefined}
                        sx={primaryButtonSx}
                    >
                        {primaryLabel}
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
};

export default TagFormDialog;
