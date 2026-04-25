import { useCallback, useEffect, useState } from 'react';

export type NotesViewMode = 'card' | 'tag';

const STORAGE_KEY = 'notes.viewMode';

function readInitial(): NotesViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'tag' ? 'tag' : 'card';
  } catch {
    return 'card';
  }
}

export function useNotesViewMode(): [NotesViewMode, (mode: NotesViewMode) => void] {
  const [mode, setMode] = useState<NotesViewMode>(readInitial);

  const update = useCallback((next: NotesViewMode) => {
    setMode(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore quota errors */ }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'card' || e.newValue === 'tag')) {
        setMode(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return [mode, update];
}
