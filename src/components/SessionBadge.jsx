import { Globe2 } from 'lucide-react';
import { Badge } from './ui/Badge';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { isExtension } from '../utils/platziClient';

export const SessionBadge = ({ cookie: propCookie }) => {
  const { t } = useI18n();
  const storedCookie = useAuthStore(state => state.cookie);
  const cookie = propCookie ?? storedCookie;
  const isExt = isExtension();
  const hasStoredCookie = Boolean(cookie?.trim() && !cookie.includes('mock_session_cookie'));

  if (isExt) {
    return (
      <Badge variant="muted" className="gap-2" title={t('session.extensionTitle')}>
        <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('session.extensionMode')}
      </Badge>
    );
  }

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
      {t('session.saved')}
    </Badge>
  );
};
