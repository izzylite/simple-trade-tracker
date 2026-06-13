import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

/**
 * Shared open/close state for the mobile navigation drawer.
 *
 * The hamburger trigger lives in `AppHeader` while the drawer itself (the
 * `SideNav` rail rendered as a temporary `Drawer`) lives in `AppLayout` — they
 * are siblings in `App.tsx`, so the open state has to live above both. This
 * context is that shared owner.
 */
interface MobileNavContextValue {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export const MobileNavProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  const openNav = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);
  const toggleNav = useCallback(() => setOpen((prev) => !prev), []);

  const value = useMemo<MobileNavContextValue>(
    () => ({ open, openNav, closeNav, toggleNav }),
    [open, openNav, closeNav, toggleNav]
  );

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
};

/** Throws if used outside a provider. */
export const useMobileNav = (): MobileNavContextValue => {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error('useMobileNav must be used within a MobileNavProvider');
  }
  return ctx;
};

/**
 * Non-throwing variant — `AppHeader` renders on public routes too, where the
 * provider may not be mounted. Returns null instead of throwing in that case.
 */
export const useMobileNavOptional = (): MobileNavContextValue | null =>
  useContext(MobileNavContext);
