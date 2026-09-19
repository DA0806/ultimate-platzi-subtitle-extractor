import { Cookie } from 'lucide-react';
import { Badge } from './ui/Badge';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';

export const SessionBadge = ({ cookie: propCookie, isAutoDetected: propIsAutoDetected }) => {
  const { t, language } = useI18n();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const storedCookie = useAuthStore(state => state.cookie);
  const cookie = propCookie ?? storedCookie;

  const hasStoredCookie = Boolean(cookie?.trim() && !cookie.includes('mock_session_cookie'));
  const isAutoDetected = propIsAutoDetected ?? Boolean(
    hasStoredCookie && (
      user?.isAutoDetected ||
      user?.email === 'Sesión detectada del navegador' ||
      (typeof token === 'string' && token.startsWith('ext_'))
    )
  );

  if (!hasStoredCookie) {
    return (
      <Badge variant="muted" className="gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        {t('session.none')}
      </Badge>
    );
  }

  if (isAutoDetected) {
    const label = language === 'en' ? 'Platzi session active' : 'Sesión Platzi activa';
    const title = language === 'en'
      ? 'Platzi session automatically detected from browser'
      : 'Sesión de Platzi detectada automáticamente desde el navegador';

    return (
      <Badge variant="primary" className="gap-2 border-primary/30 bg-primary/15 text-primary" title={title}>
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="muted" className="gap-2" title={t('session.savedTitle')}>
      <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
      {t('session.saved')}
    </Badge>
  );
};
