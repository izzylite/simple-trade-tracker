/**
 * TagsPanelStateContext
 *
 * Owns every piece of state that backs the tag-management panel so it
 * survives the lg↔︎drawer breakpoint handoff (TagManagementContent
 * unmounts in one slot and remounts in another). Fetching tag
 * definitions + the per-prop sync effects also live here so swapping
 * the host doesn't trigger a re-fetch flicker or lose the user's
 * search query, expanded groups, or open dialogs.
 *
 * Mounted once inside TradeCalendarPage above both the inline panel
 * and the <lg drawer. Calendar-level inputs (calendarId, allTags,
 * requiredTagGroups, isReadOnly, calendarOwnerId, callbacks) flow in
 * as provider props so the effects see the latest values.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';
import { tagService } from '../services/tagService';
import { useAuthState } from './AuthStateContext';
import { isGroupedTag, getTagGroup } from '../utils/tagColors';

interface TagsPanelStateContextValue {
  // Filter inputs
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  selectedTagGroup: string;
  setSelectedTagGroup: React.Dispatch<React.SetStateAction<string>>;

  // Per-group collapsed map (default = collapsed)
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (group: string) => void;

  // Dialog state
  tagToEdit: string | null;
  setTagToEdit: React.Dispatch<React.SetStateAction<string | null>>;
  tagToView: string | null;
  setTagToView: React.Dispatch<React.SetStateAction<string | null>>;
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  suggestTags: string[] | null;
  setSuggestTags: React.Dispatch<React.SetStateAction<string[] | null>>;
  isRequiredDialogOpen: boolean;
  setIsRequiredDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Required-groups mirror (locally edited, synced from props)
  localRequiredGroups: string[];
  handleRequiredTagGroupsChange: (groups: string[]) => void;

  // Definitions
  tagDefinitions: Record<string, string>;
  definitionsLoading: boolean;
  definitionsLoaded: boolean;
  fetchTagDefinitions: () => Promise<void>;

  // Activate signal — host marks itself active so we fetch defs once
  setActive: (active: boolean) => void;

  // Wrapped callbacks that also touch local state
  handleTagEditSuccess: (oldTag: string, newTag: string, tradesUpdated: number) => void;
  handleTagDelete: (deletedTag: string, tradesUpdated: number) => void;
  handleTagCreated: (newTag: string) => Promise<void>;
  handleSuggest: (tagsToSuggest: string[]) => void;
}

const TagsPanelStateContext = createContext<TagsPanelStateContextValue | null>(
  null,
);

interface ProviderProps {
  calendarId: string | undefined;
  allTags: string[];
  requiredTagGroups: string[];
  isReadOnly: boolean;
  calendarOwnerId?: string;
  onTagUpdated?: (
    oldTag: string,
    newTag: string,
  ) => Promise<{ success: boolean; tradesUpdated: number }>;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar,
  ) => Promise<Calendar | undefined>;
  onSuggestDefinitions?: (tags: string[]) => void;
  children: ReactNode;
}

export const TagsPanelStateProvider: React.FC<ProviderProps> = ({
  calendarId,
  allTags,
  requiredTagGroups,
  isReadOnly,
  calendarOwnerId,
  onTagUpdated,
  onUpdateCalendarProperty,
  onSuggestDefinitions,
  children,
}) => {
  const { user } = useAuthState();

  // ── Filter inputs ───────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');

  // ── Per-group collapsed map ─────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  // ── Dialog state ────────────────────────────────────────────────────────
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [tagToView, setTagToView] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [suggestTags, setSuggestTags] = useState<string[] | null>(null);
  const [isRequiredDialogOpen, setIsRequiredDialogOpen] = useState(false);

  // ── Required-groups mirror ──────────────────────────────────────────────
  const [localRequiredGroups, setLocalRequiredGroups] =
    useState<string[]>(requiredTagGroups);

  // ── Definitions ─────────────────────────────────────────────────────────
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, string>>(
    {},
  );
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsLoaded, setDefinitionsLoaded] = useState(false);

  // ── Active signal (set by the currently-mounted host) ───────────────────
  const [isActive, setIsActive] = useState(false);
  const setActive = useCallback((active: boolean) => {
    setIsActive(active);
  }, []);

  /**
   * Groups start collapsed (a fresh entry resolves to `true`), so the
   * panel opens as a tight scannable list rather than a 1000-line
   * scroll. First click on a group flips it to expanded.
   */
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !(prev[group] ?? true),
    }));
  }, []);

  // Keep local mirror in sync when the prop changes.
  useEffect(() => {
    setLocalRequiredGroups(requiredTagGroups);
  }, [requiredTagGroups]);

  /**
   * Fetch tag definitions.
   * In read-only mode, fetch from the calendar owner's definitions.
   */
  const fetchTagDefinitions = useCallback(async () => {
    const userId = isReadOnly ? calendarOwnerId : user?.id;
    if (!userId) return;

    setDefinitionsLoading(true);
    try {
      const definitions = await tagService.fetchTagDefinitions(userId);
      setTagDefinitions(definitions);
      setDefinitionsLoaded(true);
    } catch (err) {
      logger.error('Error fetching tag definitions:', err);
    } finally {
      setDefinitionsLoading(false);
    }
  }, [user?.id, isReadOnly, calendarOwnerId]);

  // Fetch definitions when the panel becomes active.
  useEffect(() => {
    if (isActive) {
      fetchTagDefinitions();
    }
  }, [isActive, fetchTagDefinitions]);

  // Reset selected tag group if it no longer exists in the available
  // groups (e.g. user deleted the last tag in that group).
  useEffect(() => {
    if (!selectedTagGroup) return;
    const stillExists = allTags.some(
      (tag) => isGroupedTag(tag) && getTagGroup(tag) === selectedTagGroup,
    );
    if (!stillExists) {
      setSelectedTagGroup('');
    }
  }, [allTags, selectedTagGroup]);

  // ── Wrapped callbacks ───────────────────────────────────────────────────
  const handleRequiredTagGroupsChange = useCallback(
    (groups: string[]) => {
      setLocalRequiredGroups(groups);
      if (onUpdateCalendarProperty && calendarId) {
        onUpdateCalendarProperty(calendarId, (calendar) => ({
          ...calendar,
          required_tag_groups: groups,
        }));
      }
    },
    [onUpdateCalendarProperty, calendarId],
  );

  const handleTagEditSuccess = useCallback(
    (oldTag: string, newTag: string, tradesUpdated: number) => {
      logger.log(
        `Tag update completed: ${oldTag} -> ${newTag}, ${tradesUpdated} trades updated`,
      );

      const oldGroup = isGroupedTag(oldTag) ? getTagGroup(oldTag) : null;
      const newGroup = isGroupedTag(newTag) ? getTagGroup(newTag) : null;

      if (
        oldGroup &&
        newGroup &&
        oldGroup !== newGroup &&
        selectedTagGroup === oldGroup
      ) {
        setSelectedTagGroup(newGroup);
      }

      if (onTagUpdated) {
        onTagUpdated(oldTag, newTag);
      }
    },
    [onTagUpdated, selectedTagGroup],
  );

  const handleTagDelete = useCallback(
    (deletedTag: string, tradesUpdated: number) => {
      logger.log(
        `Tag deletion completed: ${deletedTag}, ${tradesUpdated} trades updated`,
      );

      const deletedGroup = isGroupedTag(deletedTag)
        ? getTagGroup(deletedTag)
        : null;

      if (deletedGroup && selectedTagGroup === deletedGroup) {
        const otherTagsInGroup = allTags.filter(
          (tag) =>
            tag !== deletedTag &&
            isGroupedTag(tag) &&
            getTagGroup(tag) === deletedGroup,
        );
        if (otherTagsInGroup.length === 0) {
          setSelectedTagGroup('');
        }
      }

      if (onTagUpdated) {
        onTagUpdated(deletedTag, '');
      }
    },
    [onTagUpdated, selectedTagGroup, allTags],
  );

  const handleTagCreated = useCallback(
    async (newTag: string) => {
      if (onUpdateCalendarProperty && calendarId) {
        await onUpdateCalendarProperty(calendarId, (calendar) => {
          const currentTags = calendar.tags || [];
          if (currentTags.includes(newTag)) return calendar;
          return {
            ...calendar,
            tags: [...currentTags, newTag],
          };
        });
        fetchTagDefinitions();
      }
    },
    [onUpdateCalendarProperty, calendarId, fetchTagDefinitions],
  );

  const handleSuggest = useCallback(
    (tagsToSuggest: string[]) => {
      if (isReadOnly || tagsToSuggest.length === 0) return;
      if (onSuggestDefinitions) {
        onSuggestDefinitions(tagsToSuggest);
        return;
      }
      setSuggestTags(tagsToSuggest);
    },
    [isReadOnly, onSuggestDefinitions],
  );

  const value = useMemo<TagsPanelStateContextValue>(
    () => ({
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
    }),
    [
      searchTerm,
      selectedTagGroup,
      collapsedGroups,
      toggleGroup,
      tagToEdit,
      tagToView,
      isCreateDialogOpen,
      suggestTags,
      isRequiredDialogOpen,
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
    ],
  );

  return (
    <TagsPanelStateContext.Provider value={value}>
      {children}
    </TagsPanelStateContext.Provider>
  );
};

export const useTagsPanelState = (): TagsPanelStateContextValue => {
  const ctx = useContext(TagsPanelStateContext);
  if (!ctx) {
    throw new Error(
      'useTagsPanelState must be used within TagsPanelStateProvider',
    );
  }
  return ctx;
};
