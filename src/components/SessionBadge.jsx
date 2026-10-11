import { AlertCircle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import { Badge } from './ui/Badge';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore.js';

export const SessionBadge = () => {
  const { t } = useI18n();
  const sessionStatus = useAuthStore(state => state.sessionStatus);
  const isVerifying = useAuthStore(state => state.isVerifying);
  const lastDiagnostic = useAuthStore(state => state.lastDiagnostic);
  const user = useAuthStore(state => state.user);
  const planLabel = user?.plan || user?.userType;

  if (isVerifying) {
    return (
      <Badge variant="muted" className="gap-1.5" title={t('session.verifying')}>
        <Loader2 className="h-3.5 w-3.5 animate-spin-slow" aria-hidden="true" />
        {t('session.verifying')}
      </Badge>
    );
  }

  if (sessionStatus === 'authenticated') {
    return (
      <Badge variant="success" className="gap-1.5" title={t('session.authenticated')}>
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {planLabel ? `${t('session.authenticated')} (${planLabel})` : t('session.authenticated')}
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
  const reason = lastDiagnostic?.reason;
  const safeReason = [
    'HTTP_404', 'HTTP_403', 'HTTP_401', 'HTTP_429', 'HTTP_OTHER', 'TIMEOUT', 'ABORTED',
    'NETWORK_ERROR', 'READ_BODY_FAILED', 'EXTENSION_ONLY_AUTH', 'NON_JSON_CONTENT_TYPE', 'INVALID_JSON', 'INVALID_ROOT_SCHEMA',
    'INVALID_USER_ID', 'REDIRECT_INVALID', 'STALE_REQUEST', 'SESSION_EPOCH_MISMATCH',
    'ACCOUNT_CHANGED',
  ].includes(reason) ? reason : null;
  const reasonLabel = safeReason ? t(`session.diagnostic.${safeReason}`) : t('session.unknown');

  return (
    <Badge variant="muted" className="gap-1.5" title={reasonLabel}>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {t('session.unknown')}
    </Badge>
  );
};
