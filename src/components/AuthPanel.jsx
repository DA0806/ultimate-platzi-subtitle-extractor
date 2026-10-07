import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle, Cookie, ExternalLink, Globe2, LogOut, Moon, Sun, Trash2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { InterfaceLanguageSelect } from './InterfaceLanguageSelect';
import { useI18n } from '../i18n';
import { isExtension } from '../utils/platziClient';
import { clearAppStorage } from '../utils/appStorage.js';

export const AuthPanel = ({
  isOpen,
  onClose,
  onOpenTutorial,
  triggerRef,
  embedded = false,
}) => {
  const { loginWithCookie, logout } = useAuth();
  const cookie = useAuthStore(state => state.cookie);
  const theme = useSettingsStore(state => state.theme);
  const toggleTheme = useSettingsStore(state => state.toggleTheme);
  const panelRef = useRef(null);
  const [cookieStr, setCookieStr] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { t, language } = useI18n();

  useEffect(() => {
    if (!isOpen || embedded) return undefined;

    // 1. Lock background scrolling while open and restore on unmount/close
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const trigger = triggerRef?.current;

    // 2. Focus containment helper
    const getFocusableElements = () => {
      if (!panelRef.current) return [];
      const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(panelRef.current.querySelectorAll(selector))
        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
    };

    // 3. Initial focus inside dialog
    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        panelRef.current?.focus({ preventScroll: true });
      }
    });

    // 4. Keyboard handlers: Escape to close, Tab/Shift+Tab containment
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

  const isExt = isExtension();
  const isMockCookie = Boolean(cookie?.includes('mock_session_cookie'));
  const hasStoredCookie = !isExt && Boolean(cookie?.trim() && !isMockCookie);

  const handleCookieLogin = event => {
    event.preventDefault();
    const value = cookieStr.trim();
    if (!value) return;
    loginWithCookie(value);
    setIsEditing(false);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 3000);
  };

  const clearOwnData = () => {
    const confirmed = window.confirm(t('settings.clearConfirm'));
    if (!confirmed) return;
    logout();
    clearAppStorage();
    window.location.reload();
  };

  // If embedded in SetupWizard (web mode), render only the cookie input section
  if (embedded) {
    return (
      <section
        id="auth-panel"
        aria-label={t('auth.sessionTitle')}
        className="w-full rounded-lg border border-border bg-card p-5 animate-slide-up sm:p-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/50 px-3 py-3">
            <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-card-foreground">{t('auth.notConfigured')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('auth.pasteCookieDescription')}</p>
            </div>
          </div>
          <form onSubmit={handleCookieLogin} className="flex flex-col gap-2">
            <label htmlFor="platzi-cookie-embedded" className="text-xs font-medium text-card-foreground">
              {t('auth.cookieLabel')}
            </label>
            <textarea
              id="platzi-cookie-embedded"
              value={cookieStr}
              onChange={event => setCookieStr(event.target.value)}
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('auth.cookiePlaceholder')}
              rows="3"
              required
            />
            <Button type="submit" className="self-start sm:self-end">
              {t('auth.saveCookie')}
            </Button>
          </form>
          {showSuccess && (
            <div role="status" className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success animate-state-change">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              {t('auth.cookieSaved')}
            </div>
          )}
          {onOpenTutorial && (
            <div className="border-t border-border pt-4">
              <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onOpenTutorial}>
                <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                {t('auth.getCookie')}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 backdrop-blur-[2px] animate-fade-in sm:p-4"
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
        {/* Persistent Non-Scrolling Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5 pb-4 sm:p-6 sm:pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t('settings.eyebrow')}</p>
            <h2 id="settings-dialog-title" className="mt-1 text-xl font-semibold text-foreground">{t('settings.title')}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('settings.close')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Single Scrollable Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 pt-4 sm:p-6 sm:pt-4">
          {/* General Preferences Group */}
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

          {/* Platzi Access Group */}
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t('settings.platziGroup')}</h3>
            <div className="mt-3">
              {isExt ? (
                <div className="rounded-lg border border-border/80 bg-secondary/30 p-4">
                  <div className="flex items-start gap-3">
                    <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-foreground">{t('settings.extAccessTitle')}</h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.extAccessDesc')}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://platzi.com/', '_blank', 'noopener,noreferrer')}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('setup.openPlatzi')}
                    </Button>
                  </div>
                </div>
              ) : hasStoredCookie && !isEditing ? (
                <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex items-center gap-3">
                    <Cookie className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-medium text-card-foreground">{t('auth.savedCookie')}</h4>
                        <Badge variant="muted">{t('auth.unverified')}</Badge>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{t('auth.savedCookieDescription')}</p>
                    </div>
                  </div>
                  <code className="block truncate rounded-md bg-background px-3 py-2 font-mono text-xs text-card-foreground">
                    {cookie?.substring(0, 12)}••••••••••••
                  </code>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setCookieStr(cookie || ''); setIsEditing(true); }}
                    >
                      {t('auth.editCookie')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { logout(); setCookieStr(''); setIsEditing(false); }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {t('auth.disconnect')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
                  {isMockCookie && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <p>{t('auth.invalidCookie')}</p>
                    </div>
                  )}
                  <form onSubmit={handleCookieLogin} className="flex flex-col gap-2">
                    <label htmlFor="platzi-cookie-modal" className="text-xs font-medium text-card-foreground">
                      {t('auth.cookieLabel')}
                    </label>
                    <textarea
                      id="platzi-cookie-modal"
                      value={cookieStr}
                      onChange={event => setCookieStr(event.target.value)}
                      className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={t('auth.cookiePlaceholder')}
                      rows="2"
                      required
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {onOpenTutorial && (
                        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-primary" onClick={() => { onClose?.(); onOpenTutorial(); }}>
                          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('auth.getCookie')}
                        </Button>
                      )}
                      <Button type="submit" size="sm">
                        {t('auth.saveCookie')}
                      </Button>
                    </div>
                  </form>
                  {showSuccess && (
                    <div role="status" className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success animate-state-change">
                      <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('auth.cookieSaved')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reset Data Group */}
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
