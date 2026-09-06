import { useEffect } from 'react';
import { XCircle, CheckCircle, Info } from 'lucide-react';
import { useI18n } from '../i18n';

// Un simple sistema de Toast no global para la demo.
// En una app real se usaría algo como react-hot-toast o un store global de toasts.

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  const { t } = useI18n();
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: 'bg-popover border border-success/30 text-success',
    error: 'bg-popover border border-destructive/30 text-destructive',
    info: 'bg-popover border border-accent/30 text-accent',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl animate-toast-in ${styles[type]}`}
    >
      {icons[type]}
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('toast.close')}
        className="ml-2 rounded-md transition-opacity duration-micro ease-motion hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};
