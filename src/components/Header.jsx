import { useState } from 'react';
import { Moon, Sun, UserCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { SessionBadge } from './SessionBadge';
import { AuthPanel } from './AuthPanel';

export const Header = () => {
  const user = useAuthStore(state => state.user);
  const { theme, toggleTheme } = useSettingsStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <>
      <header className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-md border-b border-neutral-200 dark:border-dark-600 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <h1 className="text-neutral-900 dark:text-white font-bold tracking-tight text-xl">
              UP<span className="text-platzi-green">SE</span>
            </h1>
            <div className="hidden sm:block h-6 w-px bg-neutral-300 dark:bg-dark-600"></div>
            <div className="hidden sm:block">
              <SessionBadge user={user} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-dark-700 transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={() => setIsAuthOpen(true)}
              className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-dark-700 transition-colors duration-200 flex items-center justify-center overflow-hidden"
              aria-label="User profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="User" className="w-6 h-6 rounded-full" />
              ) : (
                <UserCircle className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      <AuthPanel isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};
