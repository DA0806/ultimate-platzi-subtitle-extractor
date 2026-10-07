import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isExtension } from '../utils/platziClient.js';

const EXTENSION_TOKEN = 'ext_browser_session';

const safeExtensionUser = (user) => user && ({
  name: user.name,
  email: user.email,
  isBrowserAccess: Boolean(user.isBrowserAccess),
});

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      cookie: null,
      user: null, // Optional identity returned by a real authentication provider
      
      login: (token, cookie, user) => set({
        token: isExtension() ? EXTENSION_TOKEN : token,
        cookie: isExtension() ? null : cookie,
        user,
      }),
      
      logout: () => set({ token: null, cookie: null, user: null }),
      
      updateUser: (user) => set((state) => ({ user: { ...state.user, ...user } })),
    }),
    {
      name: 'platzi_session',
      partialize: (state) => isExtension()
        ? { token: state.token === EXTENSION_TOKEN ? EXTENSION_TOKEN : null, cookie: null, user: safeExtensionUser(state.user) }
        : { token: state.token, cookie: state.cookie, user: state.user },
      version: 1,
      migrate: (persistedState) => isExtension()
        ? {
          token: persistedState?.token === EXTENSION_TOKEN ? EXTENSION_TOKEN : null,
          cookie: null,
          user: safeExtensionUser(persistedState?.user),
        }
        : persistedState,
      merge: (persistedState, currentState) => {
        if (!isExtension()) {
          return { ...currentState, ...persistedState };
        }

        const persistedUser = persistedState?.user;
        return {
          ...currentState,
          token: persistedState?.token === EXTENSION_TOKEN ? EXTENSION_TOKEN : null,
          cookie: null,
          user: safeExtensionUser(persistedUser),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!isExtension() || typeof localStorage === 'undefined') return;
        try {
          localStorage.setItem('platzi_session', JSON.stringify({
            state: {
              token: state?.token === EXTENSION_TOKEN ? EXTENSION_TOKEN : null,
              cookie: null,
              user: safeExtensionUser(state?.user),
            },
            version: 1,
          }));
        } catch {
          // Ignore unavailable browser storage; credentials stay out of memory.
        }
      },
    }
  )
);
