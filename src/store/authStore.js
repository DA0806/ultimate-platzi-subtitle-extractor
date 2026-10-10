import { create } from 'zustand';
import { useSubtitleStore } from './subtitleStore.js';

const LEGACY_SESSION_KEY = 'platzi_session';

const safeExtensionUser = (user) => user && ({
  name: user.name,
  email: user.email,
  isBrowserAccess: Boolean(user.isBrowserAccess),
});

// Remove the legacy key without reading its contents. Session authority is never persisted.
try {
  globalThis.localStorage?.removeItem(LEGACY_SESSION_KEY);
} catch {
  // Storage can be unavailable in private or extension contexts.
}

export const useAuthStore = create((set) => ({
  sessionEpoch: 0,
  sessionStatus: 'unknown',
  token: null,
  cookie: null,
  user: null,

  invalidateSession: () => {
    set((state) => ({
      sessionEpoch: (state.sessionEpoch || 0) + 1,
      sessionStatus: 'session_invalid',
      token: null,
      cookie: null,
    }));
    useSubtitleStore.getState().purgeExtractedContent();
  },

  setSessionStatus: (sessionStatus) => set({ sessionStatus }),

  // Kept as a display compatibility action; its arguments never grant authority.
  login: (_token, _cookie, user) => set({
    token: null,
    cookie: null,
    user: safeExtensionUser(user),
    sessionStatus: 'unknown',
  }),

  logout: () => {
    set((state) => ({
      token: null,
      cookie: null,
      user: null,
      sessionStatus: 'unauthenticated',
      sessionEpoch: (state.sessionEpoch || 0) + 1,
    }));
    useSubtitleStore.getState().purgeExtractedContent();
  },

  updateUser: (user) => set((state) => ({ user: { ...state.user, ...safeExtensionUser(user) } })),
}));
