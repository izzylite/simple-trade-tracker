import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Checkbox,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoAwesome as AIIcon,
  Refresh as RefreshIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { dialogProps } from 'styles/dialogStyles';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';
import { tagService, TagSuggestion } from '../services/tagService';
import { useAuthState } from 'contexts/AuthStateContext';
import { formatTagForDisplay, getTagColor } from 'utils/tagColors';
import { logger } from 'utils/logger';

interface TagSuggestionReviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** Tags to draft definitions for. */
  tags: string[];
  /** Existing user definitions — passed as voice examples to the model. */
  existingDefinitions?: Record<string, string>;
  /** Called once all accepted definitions are saved. */
  onSaved?: (savedTags: string[]) => void;
}

interface ReviewRow {
  tag: string;
  definition: string;
  accepted: boolean;
}

const TagSuggestionReviewDialog: React.FC<TagSuggestionReviewDialogProps> = ({
  open,
  onClose,
  tags,
  existingDefinitions,
  onSaved,
}) => {
  const theme = useTheme();
  const {
    isDark,
    violet,
    surfaceInset,
    hairline,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoLabelSx,
    primaryButtonSx,
    ghostButtonSx,
  } = useDialogTokens();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();
  const { user } = useAuthState();

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stale-response guard. Each fetch increments the token; only the latest
  // request is allowed to mutate state. Protects against rapid regenerate or
  // close-then-reopen races where an older fetch resolves after a newer one.
  const fetchTokenRef = useRef(0);

  // Build voice examples — up to 5 existing definitions from this trader.
  // Exclude tags we're being asked to define so the prompt doesn't tell the
  // model "here's how you defined X" right before asking it to define X.
  const voiceExamples = useMemo<TagSuggestion[]>(() => {
    if (!existingDefinitions) return [];
    const targetSet = new Set(tags);
    return Object.entries(existingDefinitions)
      .filter(([tag, def]) => def && def.trim() !== '' && !targetSet.has(tag))
      .slice(0, 5)
      .map(([tag, definition]) => ({ tag, definition }));
  }, [existingDefinitions, tags]);

  const fetchSuggestions = async () => {
    if (tags.length === 0) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const suggestions = await tagService.suggestTagDefinitions(tags, voiceExamples);
      if (fetchTokenRef.current !== token) return; // stale
      setRows(
        suggestions.map((s) => ({
          tag: s.tag,
          definition: s.definition,
          accepted: s.definition.trim() !== '',
        }))
      );
    } catch (err) {
      if (fetchTokenRef.current !== token) return; // stale
      const msg = err instanceof Error ? err.message : 'Failed to generate suggestions';
      setError(msg);
      setRows([]);
    } finally {
      if (fetchTokenRef.current === token) setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSuggestions();
    } else {
      // Invalidate any in-flight fetch and reset surface state.
      fetchTokenRef.current++;
      setRows([]);
      setError(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!user?.id) {
      setError('You must be signed in.');
      return;
    }
    const toSave = rows.filter((r) => r.accepted && r.definition.trim() !== '');
    if (toSave.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        toSave.map((r) => tagService.saveTagDefinition(user.id, r.tag, r.definition))
      );
      onSaved?.(toSave.map((r) => r.tag));
      onClose();
    } catch (err) {
      logger.error('Failed to save tag definitions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save definitions');
    } finally {
      setSaving(false);
    }
  };

  const acceptedCount = rows.filter((r) => r.accepted && r.definition.trim() !== '').length;

  return (
    <Dialog
      open={open}
      onClose={() => !saving && !loading && onClose()}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: { ...paperSx, ...fullScreenPaperSx },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
          <AIIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Review AI-drafted definitions
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
            }}
          >
            {loading
              ? `Drafting ${tags.length} definition${tags.length === 1 ? '' : 's'}…`
              : `Edit anything you want to keep, uncheck what you don't.`}
          </Typography>
        </Box>
        <IconButton
          onClick={() => !saving && !loading && onClose()}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          maxHeight: fullScreen ? undefined : '60vh',
          ...(fullScreen ? { flex: 1, minHeight: 0 } : {}),
          overflowY: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              gap: 1.5,
            }}
          >
            <CircularProgress size={28} sx={{ color: violet }} />
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              Generating definitions…
            </Typography>
          </Box>
        ) : error ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              px: 3,
              gap: 1.5,
              textAlign: 'center',
            }}
          >
            <ErrorIcon sx={{ fontSize: 32, color: 'error.main' }} />
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
              Couldn't generate suggestions
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 360 }}>
              {error}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={fetchSuggestions}
              sx={{
                mt: 1,
                textTransform: 'none',
                borderRadius: 1.25,
                fontWeight: 600,
              }}
            >
              Try again
            </Button>
          </Box>
        ) : (
          <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {rows.map((row, idx) => {
              const tagColor = getTagColor(row.tag);
              const empty = row.definition.trim() === '';
              const isSingle = rows.length === 1;
              return (
                <Box
                  key={row.tag}
                  sx={{
                    display: 'flex',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: `1px solid ${hairline}`,
                    backgroundColor: surfaceInset,
                  }}
                >
                  {/* Checkbox only when there's more than one — single-tag
                      reviews don't need a selection toggle (Cancel covers it). */}
                  {!isSingle && (
                    <Checkbox
                      checked={row.accepted}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, accepted: e.target.checked } : r
                          )
                        )
                      }
                      disabled={saving || empty}
                      size="small"
                      sx={{
                        color: alpha(theme.palette.text.secondary, 0.6),
                        p: 0,
                        mt: 0.5,
                        alignSelf: 'flex-start',
                        '&.Mui-checked': { color: violet },
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1,
                        py: 0.3,
                        borderRadius: 999,
                        mb: 0.9,
                        fontFamily: MONO_FONT,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: tagColor,
                        backgroundColor: alpha(tagColor, isDark ? 0.18 : 0.14),
                        border: `1px solid ${alpha(tagColor, isDark ? 0.4 : 0.32)}`,
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: tagColor,
                          flexShrink: 0,
                        }}
                      />
                      {formatTagForDisplay(row.tag, true)}
                    </Box>
                    {empty ? (
                      <Typography
                        sx={{
                          fontSize: '0.78rem',
                          color: 'text.disabled',
                          fontStyle: 'italic',
                        }}
                      >
                        AI couldn't draft a definition for this tag.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ ...monoLabelSx, fontSize: '0.62rem' }}>
                          Definition
                        </Typography>
                        <TextField
                          value={row.definition}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, definition: e.target.value } : r
                              )
                            )
                          }
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={5}
                          disabled={saving || !row.accepted}
                          inputProps={{ maxLength: 2024 }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1.5,
                              backgroundColor: isDark
                                ? 'rgba(0,0,0,0.18)'
                                : alpha(theme.palette.background.paper, 0.7),
                              '& fieldset': { borderColor: hairline },
                              '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
                              '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
                            },
                            '& .MuiOutlinedInput-input': {
                              fontSize: '0.82rem',
                              lineHeight: 1.5,
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          ...footerSx,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          pb: fullScreen ? SAFE_AREA_BOTTOM : undefined,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'text.secondary',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {loading || error || rows.length <= 1
            ? ''
            : `${acceptedCount} of ${rows.length} selected`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!loading && !error && rows.length > 0 && (
            <Button
              onClick={fetchSuggestions}
              disabled={saving}
              startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                color: 'text.secondary',
              }}
            >
              Regenerate
            </Button>
          )}
          <Button
            onClick={() => !saving && onClose()}
            disabled={saving}
            sx={ghostButtonSx}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !!error || acceptedCount === 0}
            variant="contained"
            endIcon={
              saving ? (
                <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
              ) : undefined
            }
            sx={primaryButtonSx}
          >
            {saving
              ? 'Saving…'
              : rows.length <= 1 || acceptedCount === 0
                ? 'Save'
                : `Save ${acceptedCount}`}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default TagSuggestionReviewDialog;
