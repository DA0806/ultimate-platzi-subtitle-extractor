import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'dark', // 'dark' or 'light'
      preferredLang: 'es', // default language to extract or 'all'
      
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      
      setPreferredLang: (lang) => set({ preferredLang: lang }),
    }),
    {
      name: 'platzi_settings',
    }
  )
);
