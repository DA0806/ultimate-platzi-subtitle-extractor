import { Cookie } from 'lucide-react';
import { Badge } from './ui/Badge';
import { useI18n } from '../i18n';

export const SessionBadge = ({ cookie }) => {
  const { t } = useI18n();
  const hasStoredCookie = Boolean(cookie?.trim() && !cookie.includes('mock_session_cookie'));

  if (!hasStoredCookie) {
    return (
      <Badge variant="muted" className="gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        {t('session.none')}
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
