import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Badge } from './ui/Badge';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';

export const SessionBadge = () => {
  const { t } = useI18n();
  const sessionStatus = useAuthStore(state => state.sessionStatus);

  if (sessionStatus === 'authenticated') {
    return (
      <Badge variant="success" className="gap-1.5" title={t('session.authenticated')}>
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {t('session.authenticated')}
      </Badge>
    );
  }

  if (sessionStatus === 'session_invalid') {
    return (
      <Badge variant="destructive" className="gap-1.5" title={t('extractionNotice.sessionInvalidated')}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {t('session.none')}
      </Badge>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <Badge variant="muted" className="gap-1.5" title={t('session.unauthenticated')}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        {t('session.unauthenticated')}
      </Badge>
    );
  }

  // Default: unknown (distinto de unauthenticated)
  return (
    <Badge variant="muted" className="gap-1.5" title={t('session.unknown')}>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {t('session.unknown')}
    </Badge>
  );
};
