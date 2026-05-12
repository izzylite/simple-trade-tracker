/**
 * Route chunk preloading. Each lazy page in `App.tsx` corresponds to a
 * dynamic import; this registry mirrors those imports so consumers (e.g.
 * SideNav) can warm the chunk on hover/focus before the user actually
 * clicks. Subsequent clicks resolve from the cached promise — perceived
 * navigation drops from "fetch + parse + mount" to just "mount".
 *
 * Promises are cached (one-shot per key) so repeated hovers don't refetch.
 * The actual lazy() boundaries in App.tsx still own rendering — this just
 * starts the network earlier.
 */
type Loader = () => Promise<unknown>;

const LOADERS: Array<{ match: (path: string) => boolean; load: Loader }> = [
  {
    match: (p) => p === '/' || p === '/dashboard' || p.startsWith('/calendar/'),
    load: () => import('../pages/TradeCalendarPage'),
  },
  {
    match: (p) => p.startsWith('/performance'),
    load: () => import('../pages/PerformancePage'),
  },
  {
    match: (p) => p.startsWith('/notes'),
    load: () => import('../pages/NotesPage'),
  },
  {
    match: (p) => p.startsWith('/events'),
    load: () => import('../pages/EconomicEventsPage'),
  },
  {
    match: (p) => p.startsWith('/about'),
    load: () => import('../pages/AboutPage'),
  },
];

const cache = new Map<Loader, Promise<unknown>>();

export const preloadRoute = (path: string): void => {
  const entry = LOADERS.find((l) => l.match(path));
  if (!entry) return;
  if (!cache.has(entry.load)) {
    cache.set(entry.load, entry.load().catch(() => {
      // Failed preload shouldn't poison the cache forever — let the real
      // navigation retry the import via React.lazy.
      cache.delete(entry.load);
    }));
  }
};
