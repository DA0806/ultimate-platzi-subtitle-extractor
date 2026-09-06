import { useCallback, useRef, useState } from 'react';
import { FileText, Moon, Settings, Sun } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { SessionBadge } from './SessionBadge';
import { AuthPanel } from './AuthPanel';
import { InterfaceLanguageSelect } from './InterfaceLanguageSelect';
import { useI18n } from '../i18n';

const HEADER_ACTION_CLASS = 'border border-border/90 bg-card/80 text-foreground hover:border-primary/50 hover:bg-card hover:!text-foreground';

export const Header = ({ onNavigateToTutorial }) => {
  const cookie = useAuthStore(state => state.cookie);
  const theme = useSettingsStore(state => state.theme);
  const toggleTheme = useSettingsStore(state => state.toggleTheme);
  const { t } = useI18n();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const sessionButtonRef = useRef(null);
  const handleCloseAuth = useCallback(() => setIsAuthOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md transition-colors duration-state ease-motion">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-sm font-semibold tracking-[0.18em] text-foreground">UPSE</h1>
              <p className="truncate text-xs text-muted-foreground">{t('header.subtitle')}</p>
            </div>
            <div className="ml-3 hidden border-l border-border pl-4 sm:block">
              <SessionBadge cookie={cookie} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InterfaceLanguageSelect />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={HEADER_ACTION_CLASS}
              onClick={toggleTheme}
              aria-label={t('header.changeTheme')}
            >
              {theme === 'dark' ? (
                <Sun key="sun" className="h-4 w-4 animate-theme-icon" aria-hidden="true" />
              ) : (
                <Moon key="moon" className="h-4 w-4 animate-theme-icon" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={HEADER_ACTION_CLASS}
              ref={sessionButtonRef}
              onClick={() => setIsAuthOpen(open => !open)}
              aria-label={isAuthOpen ? t('header.closeSessionSettings') : t('header.openSessionSettings')}
              aria-controls="auth-panel"
              aria-expanded={isAuthOpen}
            >
              <Settings className="h-4 w-4 transition-transform duration-micro ease-motion hover:rotate-6" aria-hidden="true" />
            </Button>

          </div>
        </div>
      </header>
      <AuthPanel
        isOpen={isAuthOpen}
        onClose={handleCloseAuth}
        onOpenTutorial={onNavigateToTutorial}
        triggerRef={sessionButtonRef}
      />
    </>
  );
};
