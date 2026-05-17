import React, { useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  useTheme,
  alpha,
  Button,
  Switch,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  Collapse,
} from '@mui/material';
import { dialogProps } from '../../../styles/dialogStyles';
import { Z_INDEX } from '../../../styles/zIndex';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Tag as TagIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ExpandLess as ExpandLessIcon,
  KeyboardArrowRight as ChevronRightIcon,
  AutoAwesome as SparkleIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import Shimmer from '../../Shimmer';
import TagFormDialog from '../../TagFormDialog';
import TagSuggestionReviewDialog from '../../TagSuggestionReviewDialog';
import TagSelectionDialog, { SelectableItem } from '../../TagSelectionDialog';
import {
  getTagColor,
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
} from '../../../utils/tagColors';
import { Calendar } from '../../../types/calendar';
import { useTagsPanelState } from '../../../contexts/TagsPanelStateContext';

export interface TagManagementContentProps {
  allTags: string[];
  calendarId: string;
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  requiredTagGroups?: string[];
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
  // Calendar owner's user ID (for fetching tag definitions in read-only mode)
  calendarOwnerId?: string;
  isActive?: boolean;
  /** Show footer with Add Tag button (panel mode). Hidden in drawer mode. */
  showFooter?: boolean;
  /** Called once with a function to trigger the create dialog from outside */
  onCreateReady?: (triggerCreate: () => void) => void;
  /**
   * Optional override — when set, parent controls what "Suggest definitions"
   * does (e.g. routing through a custom flow). When omitted, the component
   * opens its internal AI review dialog. Pass `null` semantics through
   * `isReadOnly` to suppress the affordance entirely.
   */
  onSuggestDefinitions?: (tags: string[]) => void;
}

/**
 * Compact coverage donut — SVG, 1-stroke arc, percentage in center.
 * Used by the coverage card and the "all tags" KPI strip.
 */
const CoverageDonut: React.FC<{
  ratio: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}> = ({ ratio, size = 64, stroke = 6, showLabel = true }) => {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, ratio)) * c;
  const percent = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={alpha(theme.palette.primary.main, 0.18)}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.palette.primary.main}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${filled} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'text.primary',
              fontFeatureSettings: "'tnum' on, 'lnum' on",
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {percent}
            <Box
              component="span"
              sx={{
                fontSize: '0.55rem',
                color: 'text.secondary',
                fontWeight: 600,
                ml: '1px',
                position: 'relative',
                top: '-0.05em',
              }}
            >
              %
            </Box>
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const TagManagementContent: React.FC<TagManagementContentProps> = ({
  allTags,
  calendarId,
  onTagUpdated,
  requiredTagGroups = [],
  onUpdateCalendarProperty,
  isReadOnly = false,
  calendarOwnerId,
  isActive,
  showFooter = true,
  onCreateReady,
  onSuggestDefinitions,
}) => {
  const theme = useTheme();
  const {
    searchTerm,
    setSearchTerm,
    selectedTagGroup,
    setSelectedTagGroup,
    collapsedGroups,
    toggleGroup,
    tagToEdit,
    setTagToEdit,
    tagToView,
    setTagToView,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    suggestTags,
    setSuggestTags,
    isRequiredDialogOpen,
    setIsRequiredDialogOpen,
    localRequiredGroups,
    handleRequiredTagGroupsChange,
    tagDefinitions,
    definitionsLoading,
    definitionsLoaded,
    fetchTagDefinitions,
    setActive,
    handleTagEditSuccess,
    handleTagDelete,
    handleTagCreated,
    handleSuggest,
  } = useTagsPanelState();

  // Suggestions are available unless we're in read-only mode (shared calendar).
  const suggestionsAvailable = !isReadOnly;

  // Signal active status to the provider so it fetches definitions once.
  useEffect(() => {
    setActive(!!isActive);
  }, [isActive, setActive]);

  // Expose create trigger to parent (for drawer headerActions)
  useEffect(() => {
    if (onCreateReady) {
      onCreateReady(() => setIsCreateDialogOpen(true));
    }
  }, [onCreateReady, setIsCreateDialogOpen]);

  // Get all unique tag groups
  const tagGroups = useMemo(() => {
    return getUniqueTagGroups(allTags);
  }, [allTags]);

  // Filter tags based on search term and selected group
  const filteredTags = useMemo(() => {
    let filtered = allTags;

    // Filter by group if selected
    if (selectedTagGroup) {
      filtered = filtered.filter(tag =>
        isGroupedTag(tag) && getTagGroup(tag) === selectedTagGroup
      );
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tag =>
        tag.toLowerCase().includes(term) ||
        formatTagForDisplay(tag).toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [allTags, searchTerm, selectedTagGroup]);

  // Group tags by their group
  const groupedTags = useMemo(() => {
    const groups: Record<string, string[]> = {};

    filteredTags.forEach(tag => {
      if (isGroupedTag(tag)) {
        const group = getTagGroup(tag);
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(tag);
      } else {
        if (!groups['Ungrouped']) {
          groups['Ungrouped'] = [];
        }
        groups['Ungrouped'].push(tag);
      }
    });

    return groups;
  }, [filteredTags]);

  const groupEntries = Object.entries(groupedTags);
  const isDark = theme.palette.mode === 'dark';

  // Coverage metrics — how much of the user's vocabulary has definitions.
  // The kit is "coverage-first": this is the panel's hero KPI.
  const tagsWithDefs = useMemo(
    () => allTags.filter((t) => !!tagDefinitions[t] && tagDefinitions[t].trim() !== ''),
    [allTags, tagDefinitions],
  );
  const missingTags = useMemo(
    () => allTags.filter((t) => !tagDefinitions[t] || tagDefinitions[t].trim() === ''),
    [allTags, tagDefinitions],
  );
  const coverageRatio = allTags.length > 0 ? tagsWithDefs.length / allTags.length : 0;

  // Per-group coverage — drives the "X/Y" progress in each group header.
  const groupCoverage = useMemo(() => {
    const map = new Map<string, { defined: number; total: number }>();
    Object.entries(groupedTags).forEach(([group, tags]) => {
      const defined = tags.filter(
        (t) => !!tagDefinitions[t] && tagDefinitions[t].trim() !== '',
      ).length;
      map.set(group, { defined, total: tags.length });
    });
    return map;
  }, [groupedTags, tagDefinitions]);

  const requiredPreviewCount = 4;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Scrollable content.
          `display: flex, flexDirection: column` is required so the group-list
          container's `flex: 1` actually claims the leftover vertical space —
          which is what lets the empty-state card center its icon + title in
          the optical middle of the panel instead of hugging the search row. */}
      <Box
        sx={{
          px: 2,
          pt: 2,
          pb: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          minHeight: 0,
          ...scrollbarStyles(theme),
        }}
      >
        {/* Coverage card — the hero KPI for "coverage-first" mission control.
            Renders even when allTags is empty so the user has a clear entry
            point (the + Tag CTA) instead of staring at a barren panel. */}
        {!isReadOnly && (
          <Box
            sx={{
              mb: 2,
              p: 1.75,
              borderRadius: '12px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.015),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
              {allTags.length > 0 ? (
                <CoverageDonut ratio={coverageRatio} size={64} stroke={6} />
              ) : (
                // No tags yet — render a tag-icon tile in place of the donut
                // so the card still has a visual anchor on the left.
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '14px',
                    bgcolor: theme.palette.custom.tintViolet.soft,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'primary.light',
                    flexShrink: 0,
                  }}
                >
                  <TagIcon sx={{ fontSize: '1.6rem' }} />
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: 'text.primary' }}
                >
                  Tag vocabulary
                </Typography>
                {allTags.length > 0 ? (
                  <>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        color: 'text.secondary',
                        mt: 0.25,
                        fontFeatureSettings: "'tnum' on, 'lnum' on",
                      }}
                    >
                      <Box
                        component="span"
                        sx={{ fontWeight: 700, color: 'text.primary' }}
                      >
                        {tagsWithDefs.length}
                      </Box>{' '}
                      of{' '}
                      <Box
                        component="span"
                        sx={{ fontWeight: 700, color: 'text.primary' }}
                      >
                        {allTags.length}
                      </Box>{' '}
                      tags have definitions.
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}
                    >
                      Orion uses these to analyze your trades.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        color: 'text.secondary',
                        mt: 0.25,
                      }}
                    >
                      No tags yet. Add your first to start building.
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}
                    >
                      Tags categorize trades so Orion can spot patterns.
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* CTA row — three states:
                  (a) no tags     → single full-width primary "+ Add first tag"
                  (b) some missing → Suggest definitions + small Tag button
                  (c) all defined → none (no work to surface)                */}
            {allTags.length === 0 ? (
              <Box sx={{ mt: 1.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: '0.9rem' }} />}
                  onClick={() => setIsCreateDialogOpen(true)}
                  sx={{
                    height: 36,
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: 'none',
                  }}
                >
                  Add your first tag
                </Button>
              </Box>
            ) : missingTags.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  disabled={!suggestionsAvailable}
                  startIcon={<SparkleIcon sx={{ fontSize: '0.85rem' }} />}
                  onClick={() => handleSuggest(missingTags)}
                  sx={{
                    flex: 1,
                    height: 36,
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: 'none',
                  }}
                >
                  Suggest definitions for{' '}
                  <Box
                    component="span"
                    sx={{ ml: 0.5, fontFeatureSettings: "'tnum' on, 'lnum' on" }}
                  >
                    {missingTags.length}
                  </Box>{' '}
                  tags
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: '0.85rem' }} />}
                  onClick={() => setIsCreateDialogOpen(true)}
                  sx={{
                    height: 36,
                    px: 1.5,
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: theme.palette.divider,
                    color: 'text.secondary',
                    flexShrink: 0,
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.4),
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  Tag
                </Button>
              </Box>
            ) : null}
          </Box>
        )}

        {/* Required tags — compact horizontal row when populated, vertical
            onboarding brief when the user has no tags yet. Clicking the row
            opens the group-picker dialog (when there are tags to pick from). */}
        {!isReadOnly && (
          <Box
            onClick={() => {
              if (allTags.length > 0) setIsRequiredDialogOpen(true);
            }}
            sx={{
              mb: 2,
              p: 1.25,
              borderRadius: '12px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.015),
              display: 'flex',
              alignItems: allTags.length === 0 ? 'flex-start' : 'flex-start',
              flexDirection: allTags.length === 0 ? 'column' : 'row',
              gap: allTags.length === 0 ? 0.75 : 1.25,
              cursor: allTags.length > 0 ? 'pointer' : 'default',
              transition: 'background 120ms',
              '&:hover':
                allTags.length > 0
                  ? { bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.04 : 0.03) }
                  : undefined,
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.625,
                flexShrink: 0,
                minHeight: 22,
              }}
            >
              <StarIcon sx={{ fontSize: '0.9rem', color: '#f59e0b' }} />
              <Typography
                sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.primary' }}
              >
                Required for new trades
              </Typography>
            </Box>
            {allTags.length === 0 ? (
              // Onboarding brief — explains *why* a trader should mark groups
              // required, so the feature doesn't feel like idle chrome before
              // any tags exist.
              <Typography
                sx={{
                  fontSize: '0.74rem',
                  color: 'text.secondary',
                  lineHeight: 1.55,
                }}
              >
                Mark a tag group as required and every new trade must include
                at least one tag from it — so your data stays consistent and
                Orion can compare like with like.
              </Typography>
            ) : (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                justifyContent: 'flex-end',
                alignContent: 'flex-start',
              }}
            >
              {localRequiredGroups.length === 0 ? (
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                  None — toggle a group below
                </Typography>
              ) : (
                <>
                  {localRequiredGroups.slice(0, requiredPreviewCount).map((group) => {
                    const color = getTagColor(group);
                    return (
                      <Box
                        key={group}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          px: 1,
                          borderRadius: '6px',
                          bgcolor: alpha(color, isDark ? 0.18 : 0.14),
                          border: `1px solid ${alpha(color, 0.3)}`,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: color,
                            lineHeight: 1,
                          }}
                        >
                          {group}
                        </Typography>
                      </Box>
                    );
                  })}
                  {localRequiredGroups.length > requiredPreviewCount && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 22,
                        px: 1,
                        borderRadius: '6px',
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'text.secondary',
                          lineHeight: 1,
                          fontFeatureSettings: "'tnum' on, 'lnum' on",
                        }}
                      >
                        +{localRequiredGroups.length - requiredPreviewCount}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Box>
            )}
          </Box>
        )}

        {isReadOnly && (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', lineHeight: 1.55, mb: 2 }}
          >
            View tags and their definitions to better understand this trader's terminology.
          </Typography>
        )}

        {/* Search + filter */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search tags…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '0.95rem', color: 'text.disabled' }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: '8px',
                fontSize: '0.82rem',
                bgcolor: alpha(isDark ? '#fff' : '#000', 0.03),
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={selectedTagGroup}
              onChange={(e) => setSelectedTagGroup(e.target.value)}
              displayEmpty
              startAdornment={
                <InputAdornment position="start">
                  <FilterListIcon sx={{ fontSize: '0.95rem', color: 'text.disabled' }} />
                </InputAdornment>
              }
              sx={{
                borderRadius: '8px',
                fontSize: '0.82rem',
                bgcolor: alpha(isDark ? '#fff' : '#000', 0.03),
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              }}
            >
              <MenuItem value="" sx={{ fontSize: '0.82rem' }}>All</MenuItem>
              {tagGroups.map((group) => (
                <MenuItem key={group} value={group} sx={{ fontSize: '0.82rem' }}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Group cards — each group is its own card with a 1px violet edge
            accent. DESIGN.md forbids accent stripes wider than 1px on list
            items, so the kit's 3px is rendered here as 1px + tint background.
            `flex: 1` so when there's no content (empty state), the inner
            placeholder card can stretch and vertically center its message. */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            minHeight: 0,
          }}
        >
          {groupEntries.length > 0 ? (
            groupEntries.map(([group, tags]) => {
              const collapsed = collapsedGroups[group] ?? true;
              const color = getTagColor(group);
              const required = localRequiredGroups.includes(group);
              const cov = groupCoverage.get(group);
              const groupMissing = tags.filter(
                (t) => !tagDefinitions[t] || tagDefinitions[t].trim() === '',
              );

              return (
                <Box
                  key={group}
                  sx={{
                    borderRadius: '12px',
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {/* Group header — single row, NOT a <button> wrapper.
                      A button containing the Switch (also a button) is invalid
                      HTML and the browser collapses the layout. */}
                  <Box
                    onClick={() => toggleGroup(group)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1.1,
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': {
                        bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.02),
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        // Color every named group with its tag color so the
                        // panel reads as a topic legend. Required vs not is
                        // conveyed by the Switch position, not by graying out
                        // non-required group names.
                        color: group === 'Ungrouped' ? 'text.primary' : color,
                        letterSpacing: '-0.005em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: '1 1 auto',
                        minWidth: 0,
                      }}
                    >
                      {group}
                    </Typography>
                    {group !== 'Ungrouped' && !isReadOnly && (
                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <Switch
                          checked={required}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...localRequiredGroups, group]
                              : localRequiredGroups.filter((g) => g !== group);
                            handleRequiredTagGroupsChange(updated);
                          }}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    )}
                    {/* Right-side meta cluster — every element has a fixed
                        width so rows line up across groups regardless of
                        whether the digit count is 1, 2, or 3 chars. */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexShrink: 0,
                      }}
                    >
                      <Box sx={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                        {cov && cov.total > 0 && (
                          <CoverageDonut
                            ratio={cov.defined / cov.total}
                            size={20}
                            stroke={3}
                            showLabel={false}
                          />
                        )}
                      </Box>
                      <Typography
                        sx={{
                          width: 42,
                          textAlign: 'right',
                          fontSize: '0.75rem',
                          color:
                            cov && cov.defined === cov.total
                              ? 'success.main'
                              : 'text.secondary',
                          fontWeight: 600,
                          fontFeatureSettings: "'tnum' on, 'lnum' on",
                        }}
                      >
                        {cov && cov.total > 0 ? `${cov.defined}/${cov.total}` : ''}
                      </Typography>
                      <Typography
                        sx={{
                          width: 50,
                          textAlign: 'right',
                          fontSize: '0.75rem',
                          color: 'text.disabled',
                          fontFeatureSettings: "'tnum' on, 'lnum' on",
                        }}
                      >
                        {tags.length} tags
                      </Typography>
                      <Box sx={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                        {collapsed ? (
                          <ChevronRightIcon
                            sx={{ fontSize: '1.1rem', color: 'text.disabled' }}
                          />
                        ) : (
                          <ExpandLessIcon
                            sx={{ fontSize: '1.1rem', color: 'text.disabled' }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Group body */}
                  <Collapse in={!collapsed} timeout="auto" unmountOnExit>
                    <Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
                      {tags.map((tag, ti) => {
                        const definition = tagDefinitions[tag];
                        const hasDef = !!definition && definition.trim() !== '';
                        const showShimmer = definitionsLoading && !definitionsLoaded;
                        const isLastInGroup = ti === tags.length - 1;
                        return (
                          <Box
                            key={tag}
                            onClick={() => setTagToView(tag)}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              px: 1.5,
                              py: 1.25,
                              cursor: 'pointer',
                              borderBottom: isLastInGroup
                                ? 0
                                : `1px solid ${theme.palette.divider}`,
                              transition: 'background 120ms',
                              '&:hover': {
                                bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.02 : 0.02),
                              },
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {/* Tag chip + No-definition status */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    height: 22,
                                    px: 1,
                                    borderRadius: '6px',
                                    bgcolor: alpha(isDark ? '#fff' : '#000', isDark ? 0.06 : 0.05),
                                    border: `1px solid ${theme.palette.divider}`,
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      color: 'text.primary',
                                      lineHeight: 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {formatTagForDisplay(tag, true)}
                                  </Typography>
                                </Box>
                                {!hasDef && !showShimmer && (
                                  <Box
                                    component="span"
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.375,
                                      height: 18,
                                      px: 0.75,
                                      borderRadius: '4px',
                                      bgcolor: alpha('#f59e0b', isDark ? 0.18 : 0.14),
                                      border: `1px solid ${alpha('#f59e0b', 0.3)}`,
                                    }}
                                  >
                                    <Box
                                      component="span"
                                      sx={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: '50%',
                                        bgcolor: '#f59e0b',
                                      }}
                                    />
                                    <Typography
                                      sx={{
                                        fontSize: '0.66rem',
                                        fontWeight: 600,
                                        color: '#f59e0b',
                                        lineHeight: 1,
                                      }}
                                    >
                                      No definition
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                              {/* Definition line — only rendered when a
                                  definition exists or shimmer is loading.
                                  When the tag has no definition, the
                                  amber "No definition" badge above already
                                  communicates the state; no second line. */}
                              {showShimmer ? (
                                <Box sx={{ mt: 0.75 }}>
                                  <Shimmer
                                    height={8}
                                    borderRadius={4}
                                    intensity="low"
                                    sx={{ mb: 0.4 }}
                                  />
                                  <Shimmer height={8} borderRadius={4} intensity="low" />
                                </Box>
                              ) : hasDef ? (
                                <Typography
                                  sx={{
                                    mt: 0.5,
                                    fontSize: '0.75rem',
                                    color: 'text.secondary',
                                    lineHeight: 1.5,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {definition}
                                </Typography>
                              ) : null}
                            </Box>

                            {/* Per-tag actions */}
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                flexShrink: 0,
                              }}
                            >
                              {!hasDef && !showShimmer && suggestionsAvailable && (
                                <Box
                                  component="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSuggest([tag]);
                                  }}
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.375,
                                    bgcolor: 'transparent',
                                    border: 0,
                                    font: 'inherit',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: 'primary.light',
                                    cursor: 'pointer',
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: '4px',
                                    '&:hover': {
                                      color: 'primary.main',
                                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    },
                                  }}
                                >
                                  <SparkleIcon sx={{ fontSize: '0.75rem' }} />
                                  Suggest
                                </Box>
                              )}
                              {!isReadOnly && (
                                <Box
                                  component="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTagToEdit(tag);
                                  }}
                                  sx={{
                                    bgcolor: 'transparent',
                                    border: 0,
                                    font: 'inherit',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    color: 'primary.light',
                                    cursor: 'pointer',
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: '4px',
                                    '&:hover': {
                                      color: 'primary.main',
                                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    },
                                  }}
                                >
                                  Edit
                                </Box>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                      {/* Group footer suggest — when many tags in this group lack defs */}
                      {suggestionsAvailable &&
                        groupMissing.length >= 3 && (
                          <Box
                            sx={{
                              borderTop: `1px solid ${theme.palette.divider}`,
                              px: 1.5,
                              py: 1,
                              display: 'flex',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <Box
                              component="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSuggest(groupMissing);
                              }}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                bgcolor: 'transparent',
                                border: 0,
                                font: 'inherit',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                color: 'primary.light',
                                cursor: 'pointer',
                                px: 0.75,
                                py: 0.25,
                                borderRadius: '6px',
                                '&:hover': {
                                  color: 'primary.main',
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                },
                              }}
                            >
                              <SparkleIcon sx={{ fontSize: '0.78rem' }} />
                              Suggest {groupMissing.length} in this group
                            </Box>
                          </Box>
                        )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })
          ) : (
            (() => {
              // Distinguish "no tags at all" (cold onboarding) from
              // "no tags match current filter" (active filter state).
              const isFiltering = !!searchTerm || !!selectedTagGroup;
              const showOnboarding = allTags.length === 0 && !isFiltering;
              return (
                <Box
                  sx={{
                    // Fill the remaining vertical space so the icon + title
                    // + description land in the optical center of the panel,
                    // not at the top edge of a hugging box.
                    flex: 1,
                    minHeight: 240,
                    px: 3,
                    py: 5,
                    borderRadius: '12px',
                    border: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      bgcolor: showOnboarding
                        ? theme.palette.custom.tintViolet.soft
                        : alpha(theme.palette.text.primary, 0.05),
                      border: `1px solid ${
                        showOnboarding
                          ? alpha(theme.palette.primary.main, 0.25)
                          : theme.palette.divider
                      }`,
                      display: 'grid',
                      placeItems: 'center',
                      color: showOnboarding ? 'primary.light' : 'text.disabled',
                      mb: 0.5,
                    }}
                  >
                    {showOnboarding ? (
                      <TagIcon sx={{ fontSize: '1.4rem' }} />
                    ) : (
                      <SearchIcon sx={{ fontSize: '1.3rem' }} />
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'text.primary',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {showOnboarding
                      ? isReadOnly
                        ? 'No tags yet'
                        : 'Start your vocabulary'
                      : 'No matches'}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      color: 'text.secondary',
                      lineHeight: 1.55,
                      maxWidth: 320,
                    }}
                  >
                    {showOnboarding
                      ? isReadOnly
                        ? "This trader hasn't added any tags to this calendar."
                        : 'Tags categorize trades by setup, mistake, or strategy. Use the + Tag button above to create your first one.'
                      : 'Try a different search term or clear the filter to see all tags.'}
                  </Typography>
                  {!showOnboarding && isFiltering && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedTagGroup('');
                      }}
                      sx={{
                        mt: 1.25,
                        height: 30,
                        px: 1.5,
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderColor: theme.palette.divider,
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: alpha(theme.palette.primary.main, 0.4),
                          color: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                        },
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </Box>
              );
            })()
          )}
        </Box>
      </Box>
      {/* end scrollable content */}

      {/* The footer "Add Tag" was removed — the coverage card already exposes
          a "+ Tag" affordance, and the parent panel/drawer's `onCreateReady`
          hook lets host chrome trigger creation from a header button. */}

      {tagToEdit && (
        <TagFormDialog
          open={!!tagToEdit}
          onClose={(changed) => {
            setTagToEdit(null);
            if (changed) fetchTagDefinitions();
          }}
          editTag={tagToEdit}
          calendarId={calendarId}
          allTags={allTags}
          onEditSuccess={handleTagEditSuccess}
          onDelete={handleTagDelete}
          onTagUpdated={onTagUpdated}
          initialDefinition={tagDefinitions[tagToEdit] || ''}
        />
      )}

      <TagFormDialog
        open={isCreateDialogOpen}
        onClose={(created) => {
          setIsCreateDialogOpen(false);
          if (created) fetchTagDefinitions();
        }}
        calendarId={calendarId}
        allTags={allTags}
        onTagCreated={handleTagCreated}
      />

      {suggestTags && suggestTags.length > 0 && (
        <TagSuggestionReviewDialog
          open={!!suggestTags}
          tags={suggestTags}
          existingDefinitions={tagDefinitions}
          onClose={() => setSuggestTags(null)}
          onSaved={() => {
            setSuggestTags(null);
            fetchTagDefinitions();
          }}
        />
      )}

      {/* Required-groups picker. Items derived from tag groups; per-group meta
          shows the tag count so users can see how many tags they're committing
          to require at least one of. Color-coded chips match the group theme. */}
      <TagSelectionDialog
        open={isRequiredDialogOpen}
        onClose={() => setIsRequiredDialogOpen(false)}
        title="Required for new trades"
        description="Mark a tag group as required and every new trade must include at least one tag from it."
        icon={<StarIcon sx={{ fontSize: 18, color: '#f59e0b' }} />}
        accent="warning"
        selectedLabel="Required"
        actionVerb="Require"
        items={tagGroups.map<SelectableItem>((group) => {
          const groupTagCount = allTags.filter(
            (t) => isGroupedTag(t) && getTagGroup(t) === group,
          ).length;
          const color = getTagColor(`${group}:_`);
          return {
            id: group,
            label: group,
            meta: `${groupTagCount} tag${groupTagCount === 1 ? '' : 's'}`,
            chipSx: {
              bgcolor: alpha(color, isDark ? 0.18 : 0.14),
              color,
              border: `1px solid ${alpha(color, 0.3)}`,
              fontWeight: 600,
            },
          };
        })}
        selected={localRequiredGroups}
        onChange={handleRequiredTagGroupsChange}
        searchPlaceholder="Search groups…"
        emptyText="No tag groups yet — create grouped tags (e.g. Setup:Order Block) first."
      />

      {/* Tag View Dialog */}
      {(() => {
        const isDarkTv = theme.palette.mode === 'dark';
        const violet = theme.palette.primary.main;
        const violetSoft = alpha(violet, isDarkTv ? 0.18 : 0.14);
        const violetBorder = alpha(violet, isDarkTv ? 0.35 : 0.28);
        const surfaceInset = isDarkTv
          ? 'rgba(255,255,255,0.03)'
          : alpha(theme.palette.text.primary, 0.03);
        const hairline = isDarkTv ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
        const MONO_FONT_TV = "'JetBrains Mono', ui-monospace, monospace";
        const monoLabelSx = {
          fontFamily: MONO_FONT_TV,
          fontSize: '0.62rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: alpha(theme.palette.text.secondary, 0.85),
        };
        return (
          <Dialog
            open={!!tagToView}
            onClose={() => setTagToView(null)}
            maxWidth="sm"
            fullWidth
            {...dialogProps}
            sx={{ zIndex: Z_INDEX.DIALOG }}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: 2,
                  border: `1px solid ${hairline}`,
                  boxShadow: theme.shadows[10],
                  backgroundImage: 'none',
                  overflow: 'hidden',
                },
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 1.75,
                borderBottom: `1px solid ${hairline}`,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: violetSoft,
                  color: violet,
                  border: `1px solid ${violetBorder}`,
                  flexShrink: 0,
                }}
              >
                <TagIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                  Tag details
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.3,
                  }}
                >
                  Read-only view of this tag and its definition
                </Typography>
              </Box>
              <IconButton
                onClick={() => setTagToView(null)}
                size="small"
                sx={{ color: theme.palette.text.secondary }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Body */}
            <Box
              sx={{
                px: 2.5,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                ...scrollbarStyles(theme),
                overflowY: 'auto',
                maxHeight: '70vh',
              }}
            >
              {tagToView && (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography sx={monoLabelSx}>Tag</Typography>
                    <Box>
                      <Chip
                        label={formatTagForDisplay(tagToView, true)}
                        sx={{
                          ...getTagChipStyles(tagToView, theme),
                          fontSize: '0.95rem',
                          height: 32,
                          '& .MuiChip-label': { px: 1.75 },
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography sx={monoLabelSx}>Definition</Typography>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1.5,
                        border: `1px solid ${hairline}`,
                        backgroundColor: surfaceInset,
                      }}
                    >
                      <Typography
                        sx={{
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.88rem',
                          lineHeight: 1.55,
                          color: tagDefinitions[tagToView]
                            ? theme.palette.text.primary
                            : alpha(theme.palette.text.secondary, 0.8),
                          fontStyle: tagDefinitions[tagToView] ? 'normal' : 'italic',
                        }}
                      >
                        {tagDefinitions[tagToView] || 'No definition available for this tag.'}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Box>

            {/* Footer */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                px: 2.5,
                py: 1.5,
                borderTop: `1px solid ${hairline}`,
                backgroundColor: isDarkTv
                  ? 'rgba(255,255,255,0.02)'
                  : alpha(theme.palette.text.primary, 0.02),
              }}
            >
              <Button
                onClick={() => setTagToView(null)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                Close
              </Button>
              {!isReadOnly && tagToView && (
                <Button
                  onClick={() => {
                    setTagToEdit(tagToView);
                    setTagToView(null);
                  }}
                  variant="contained"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    backgroundColor: violet,
                    color: '#fff',
                    borderRadius: 1.25,
                    px: 1.75,
                    py: 0.75,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                      boxShadow: 'none',
                    },
                  }}
                >
                  Edit tag
                </Button>
              )}
            </Box>
          </Dialog>
        );
      })()}
    </Box>
  );
};

export default TagManagementContent;
