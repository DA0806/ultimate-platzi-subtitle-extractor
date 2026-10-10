import { useEffect, useRef } from 'react';
import { ExternalLink, Globe2, Moon, RefreshCw, Sun, Trash2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { SessionBadge } from './SessionBadge';
import { InterfaceLanguageSelect } from './InterfaceLanguageSelect';
import { useI18n } from '../i18n';
import { clearAppStorage } from '../utils/appStorage.js';

export const AuthPanel = ({
  isOpen,
  onClose,
  triggerRef,
  embedded = false,
}) => {
  const { recheckSession, logout } = useAuth();
  const theme = useSettingsStore(state => state.theme);
  const toggleTheme = useSettingsStore(state => state.toggleTheme);
  const panelRef = useRef(null);
  const { t, language } = useI18n();

  useEffect(() => {
    if (!isOpen || embedded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const trigger = triggerRef?.current;

    const getFocusableElements = () => {
      if (!panelRef.current) return [];
      const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(panelRef.current.querySelectorAll(selector))
        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
    };

    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        panelRef.current?.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !panelRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !panelRef.current.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [embedded, isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const clearOwnData = () => {
    const confirmed = window.confirm(t('settings.clearConfirm'));
    if (!confirmed) return;
    logout();
    clearAppStorage();
    window.location.reload();
  };

  const renderSessionSection = () => (
    <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h4 className="text-sm font-medium text-foreground">{t('settings.extAccessTitle')}</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('session.checkNotice')}</p>
          </div>
        </div>
        <div className="shrink-0">
          <SessionBadge />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.open('https://platzi.com/', '_blank', 'noopener,noreferrer')}
          className="gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {t('session.openPlatzi')}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={recheckSession}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('session.recheck')}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <section
        id="auth-panel"
        aria-label={t('auth.sessionTitle')}
        className="w-full rounded-lg border border-border bg-card p-5 animate-slide-up sm:p-6"
      >
        {renderSessionSection()}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/60 p-3 backdrop-blur-[2px] animate-fade-in sm:p-4"
      onClick={event => event.target === event.currentTarget && onClose?.()}
    >
      <section
        id="settings-dialog"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-[var(--panel-shadow)] animate-state-change focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5 pb-4 sm:p-6 sm:pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t('settings.eyebrow')}</p>
            <h2 id="settings-dialog-title" className="mt-1 text-xl font-semibold text-foreground">{t('settings.title')}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('settings.close')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 pt-4 sm:p-6 sm:pt-4">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('settings.generalGroup')}</h3>
            <div className="mt-3 space-y-3 rounded-lg border border-border/80 bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('language.interface')}</p>
                  <p className="text-xs text-muted-foreground">{language === 'en' ? t('language.english') : t('language.spanish')}</p>
                </div>
                <InterfaceLanguageSelect />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('settings.theme')}</p>
                  <p className="text-xs text-muted-foreground">{theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className="gap-2"
                  aria-label={t('header.changeTheme')}
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4" aria-hidden="true" />
                      {t('settings.themeLight')}
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" aria-hidden="true" />
                      {t('settings.themeDark')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('settings.platziGroup')}</h3>
            <div className="mt-3">
              {renderSessionSection()}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('settings.storageGroup')}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.storageDesc')}</p>
            <a
              href="https://github.com/DA0806/ultimate-platzi-subtitle-extractor/blob/feat/browser-extension/docs/PRIVACY_POLICY.md"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm text-primary underline-offset-2 hover:underline"
            >
              {language === 'en' ? 'Read privacy policy' : 'Leer política de privacidad'}
            </a>
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={clearOwnData}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('settings.clearStorage')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
