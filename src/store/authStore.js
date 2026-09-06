import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      cookie: null,
      user: null, // Optional identity returned by a real authentication provider
      
      login: (token, cookie, user) => set({ token, cookie, user }),
      
      logout: () => set({ token: null, cookie: null, user: null }),
      
      updateUser: (user) => set((state) => ({ user: { ...state.user, ...user } })),
    }),
    {
      name: 'platzi_session',
    }
  )
);
