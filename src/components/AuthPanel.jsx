import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle, Cookie, LogOut, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { useI18n } from '../i18n';

export const AuthPanel = ({ isOpen, onClose, onOpenTutorial, triggerRef, embedded = false }) => {
  const { loginWithCookie, logout } = useAuth();
  const cookie = useAuthStore(state => state.cookie);
  const panelRef = useRef(null);
  const [cookieStr, setCookieStr] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = triggerRef?.current;
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    if (!embedded) document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      if (!embedded) document.removeEventListener('keydown', handleKeyDown);
      if (!embedded) trigger?.focus({ preventScroll: true });
    };
  }, [embedded, isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const isMockCookie = Boolean(cookie?.includes('mock_session_cookie'));
  const hasStoredCookie = Boolean(cookie?.trim() && !isMockCookie);

  const handleCookieLogin = event => {
    event.preventDefault();
    const value = cookieStr.trim();
    if (!value) return;
    loginWithCookie(value);
    setIsEditing(false);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 3000);
  };

  const openTutorial = () => {
    onClose?.();
    onOpenTutorial?.();
  };

  return (
    <div
      className={embedded ? 'w-full' : 'fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/55 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6'}
      onClick={event => !embedded && event.target === event.currentTarget && onClose()}
    >
      <section
        id="auth-panel"
        ref={panelRef}
        role={embedded ? undefined : 'dialog'}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="auth-panel-title"
        tabIndex={embedded ? undefined : -1}
        className={embedded ? 'w-full rounded-lg border border-border bg-card p-5 shadow-[var(--panel-shadow)] animate-slide-up sm:p-6' : 'max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-[var(--panel-shadow)] animate-state-change focus:outline-none sm:rounded-2xl sm:p-6'}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t('auth.sessionEyebrow')}</p>
            <h2 id="auth-panel-title" className="mt-1 text-xl font-semibold text-foreground">{t('auth.sessionTitle')}</h2>
          </div>
          {!embedded && (
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('auth.closeDialog')}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="mt-6">
          {hasStoredCookie && !isEditing ? (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/50 p-4">
              <div className="flex items-center gap-3">
                <Cookie className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-card-foreground">{t('auth.savedCookie')}</h3>
                    <Badge variant="muted">{t('auth.unverified')}</Badge>
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">{t('auth.savedCookieDescription')}</p>
                </div>
              </div>
              <code className="block truncate rounded-md bg-background px-3 py-2 font-mono text-xs text-card-foreground" title={t('auth.savedCookieTitle')}>
                {cookie?.substring(0, 12)}••••••••••••
              </code>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setCookieStr(cookie || ''); setIsEditing(true); }}>
                  {t('auth.editCookie')}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { logout(); setCookieStr(''); setIsEditing(false); }}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t('auth.disconnect')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isMockCookie && <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{t('auth.invalidCookie')}</p></div>}
              <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/50 px-3 py-3"><Cookie className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-medium text-card-foreground">{t('auth.notConfigured')}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('auth.pasteCookieDescription')}</p></div></div>
              <form onSubmit={handleCookieLogin} className="flex flex-col gap-2">
                <label htmlFor="platzi-cookie" className="text-xs font-medium text-card-foreground">{t('auth.cookieLabel')}</label>
                <textarea id="platzi-cookie" value={cookieStr} onChange={event => setCookieStr(event.target.value)} className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={t('auth.cookiePlaceholder')} rows="3" required />
                <Button type="submit" className="self-start sm:self-end">{t('auth.saveCookie')}</Button>
              </form>
              {showSuccess && <div role="status" className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success animate-state-change"><CheckCircle className="h-4 w-4" aria-hidden="true" />{t('auth.cookieSaved')}</div>}
              <div className="flex items-start gap-3 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" /><p>{t('auth.freeOnly')}</p></div>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <Button type="button" variant="outline" className="w-full justify-start" onClick={openTutorial}>
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('auth.getCookie')}
          </Button>
        </div>
      </section>
    </div>
  );
};
