import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SatellitePosition, UserProfile, ObserverLocation, SatelliteSummary } from '../types';

interface SatelliteStore {
  // Auth
  token: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;

  // Selected satellite
  selectedNoradId: string | null;
  setSelectedSatellite: (noradId: string | null) => void;

  // Live positions (noradId → position)
  positions: Record<string, SatellitePosition>;
  updatePosition: (noradId: string, pos: SatellitePosition) => void;

  // Tracked satellites
  trackedIds: string[];
  addTracked: (noradId: string) => void;
  removeTracked: (noradId: string) => void;

  // Observer location
  observerLocation: ObserverLocation | null;
  setObserverLocation: (loc: ObserverLocation | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Category filter
  categoryFilter: string | null;
  setCategoryFilter: (cat: string | null) => void;

  // Favorites
  favorites: SatelliteSummary[];
  addFavorite: (sat: SatelliteSummary) => void;
  removeFavorite: (noradId: string) => void;
  isFavorite: (noradId: string) => boolean;

  // ── V2: Notification unread count (lightweight — full data lives in useNotifications hook) ──
  unreadNotificationCount: number;
  setUnreadNotificationCount: (count: number) => void;
  incrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

export const useStore = create<SatelliteStore>()(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────────────────────
      token: null,
      user: null,
      setAuth: (token, user) => {
        // Store under BOTH keys:
        //   'sattrack_token' → persisted by zustand (partialize below)
        //   'token'          → read by trackingApi.ts getToken() for V2 API calls
        localStorage.setItem('sattrack_token', token);
        localStorage.setItem('token', token);
        set({ token, user });
      },
      clearAuth: () => {
        localStorage.removeItem('sattrack_token');
        localStorage.removeItem('token');
        set({ token: null, user: null, unreadNotificationCount: 0 });
      },

      // ── Satellite selection ──────────────────────────────────────────────
      selectedNoradId: '25544',
      setSelectedSatellite: (noradId) => set({ selectedNoradId: noradId }),

      // ── Live positions ───────────────────────────────────────────────────
      positions: {},
      updatePosition: (noradId, pos) =>
        set((state) => ({
          positions: { ...state.positions, [noradId]: pos },
        })),

      // ── Multi-tracking ───────────────────────────────────────────────────
      trackedIds: ['25544', '20580'],
      addTracked: (noradId) =>
        set((state) => ({
          trackedIds: state.trackedIds.includes(noradId)
            ? state.trackedIds
            : [...state.trackedIds, noradId].slice(0, 10),
        })),
      removeTracked: (noradId) =>
        set((state) => ({
          trackedIds: state.trackedIds.filter((id) => id !== noradId),
        })),

      // ── Observer ─────────────────────────────────────────────────────────
      observerLocation: null,
      setObserverLocation: (loc) => set({ observerLocation: loc }),

      // ── Search ───────────────────────────────────────────────────────────
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      // ── Category filter ──────────────────────────────────────────────────
      categoryFilter: null,
      setCategoryFilter: (cat) => set({ categoryFilter: cat }),

      // ── Favorites ────────────────────────────────────────────────────────
      favorites: [],
      addFavorite: (sat) =>
        set((state) => ({
          favorites: state.favorites.some((f) => f.noradId === sat.noradId)
            ? state.favorites
            : [...state.favorites, sat],
        })),
      removeFavorite: (noradId) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.noradId !== noradId),
        })),
      isFavorite: (noradId) =>
        get().favorites.some((f) => f.noradId === noradId),

      // ── V2: Unread notification count ─────────────────────────────────────
      // Kept in store so the Layout bell badge can read it without
      // mounting the full useNotifications hook on every page.
      // The useUnreadCount hook in hooks/index.ts keeps this in sync.
      unreadNotificationCount: 0,
      setUnreadNotificationCount: (count) =>
        set({ unreadNotificationCount: count }),
      incrementUnreadCount: () =>
        set((state) => ({
          unreadNotificationCount: state.unreadNotificationCount + 1,
        })),
      clearUnreadCount: () =>
        set({ unreadNotificationCount: 0 }),
    }),
    {
      name: 'sattrack-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist what should survive a page refresh.
      // Positions are volatile — they get refreshed on mount anyway.
      // unreadNotificationCount is persisted so the badge survives a reload.
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        trackedIds: state.trackedIds,
        observerLocation: state.observerLocation,
        favorites: state.favorites,
        selectedNoradId: state.selectedNoradId,
        unreadNotificationCount: state.unreadNotificationCount,
      }),
    }
  )
);