import { useState, useCallback } from 'react';

interface NoteNavState {
  noteId: string;
  title: string;
}

interface UseNoteNavigationResult {
  /** The currently displayed note ID (null = original) */
  currentNoteId: string | null;
  /** Whether we're viewing a linked note (not the original) */
  isNavigated: boolean;
  /** Navigate to a linked note */
  navigateTo: (noteId: string, title: string) => void;
  /** Go back to previous note in stack */
  goBack: () => void;
  /** Reset navigation (when dialog closes) */
  reset: () => void;
  /** Current stack depth (for display) */
  stackDepth: number;
}

export const useNoteNavigation = (): UseNoteNavigationResult => {
  const [navStack, setNavStack] = useState<NoteNavState[]>([]);

  const currentNoteId =
    navStack.length > 0
      ? navStack[navStack.length - 1].noteId
      : null;

  const isNavigated = navStack.length > 0;

  const navigateTo = useCallback(
    (noteId: string, title: string) => {
      setNavStack((prev) => [...prev, { noteId, title }]);
    },
    []
  );

  const goBack = useCallback(() => {
    setNavStack((prev) => prev.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setNavStack([]);
  }, []);

  return {
    currentNoteId,
    isNavigated,
    navigateTo,
    goBack,
    reset,
    stackDepth: navStack.length,
  };
};
